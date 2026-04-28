// 가격 산출 — 내부 우선(CENTER_PRICE_DB) + RRP 기반 추정 fallback.
// 1) 중심가 DB 매칭 → 'db' 소스
// 2) DB 미수록 + 알려진 브랜드(brand_tier_db) + RRP 있음 → 'rrp_synth' 소스
// 3) 모두 실패 → customerPsychPriceKrw=0, source=null

import { lookupCenterPrice } from './center-price.js';
import BRAND_SCORE from '../data/brand-score-rules.json' with { type: 'json' };

// 환율(v12 보존). 단일 환율 통일은 v14+에서 결정.
const FX_JSC = 1740;
const FX_RRP = 1700;
const COST_MULT  = 2.0;
const TARGET_IMU = 0.65;
// 추정 고객심리가 = RRP × FX × 0.55 (한국 리테일 통상 인지가 ~55% of MSRP)
const RRP_PSYCH_FACTOR = 0.55;

const TIER_KEYS_UPPER = new Set(
  Object.keys(BRAND_SCORE.brand_tier_db || {}).map(k => String(k).toUpperCase())
);

function isKnownTierBrand(rawBrand) {
  if (!rawBrand) return false;
  const u = String(rawBrand).toUpperCase().trim();
  if (!u) return false;
  if (TIER_KEYS_UPPER.has(u)) return true;
  // 부분 매칭 — 영문 약어/접미 차이 흡수
  for (const k of TIER_KEYS_UPPER) {
    if (k.length >= 4 && (u.includes(k) || k.includes(u))) return true;
  }
  return false;
}

/**
 * @param {OfferSKU} offer
 * @param {object} centerPriceDB
 * @param {object} offerMcMap — data/offer-mc-map.json (없으면 by_cat 매칭 우회)
 * @returns {Diagnosis['pricing']}
 */
export function computePricing(offer, centerPriceDB, offerMcMap = null) {
  const jsc = parseFloat(offer.jsc) || 0;
  const rrp = parseFloat(offer.rrp) || 0;

  // 1) 내부가 — 중심가 DB 조회 (가능하면)
  let centerPriceFound = false;
  let customerPsychPriceKrw = 0;
  let psychPriceSource = null;
  if (centerPriceDB && offer.brand) {
    const found = lookupCenterPrice(centerPriceDB, offer, offerMcMap);
    if (found != null) {
      centerPriceFound = true;
      customerPsychPriceKrw = found;
      psychPriceSource = 'db';
    }
  }

  // 2) RRP 기반 추정 fallback — DB 미수록 + tier db에 등록된 브랜드 + RRP 있음
  if (!centerPriceFound && rrp > 0 && isKnownTierBrand(offer.brand)) {
    customerPsychPriceKrw = Math.round(rrp * FX_RRP * RRP_PSYCH_FACTOR);
    psychPriceSource = 'rrp_synth';
  }

  // 랜디드 코스트·목표가 (JSC 기준)
  const landedCostKrw  = jsc ? jsc * FX_JSC * COST_MULT : 0;
  const targetPriceKrw = landedCostKrw ? landedCostKrw / TARGET_IMU : 0;
  const psychRatio     = (customerPsychPriceKrw > 0 && targetPriceKrw > 0)
    ? targetPriceKrw / customerPsychPriceKrw
    : 0;

  let note = null;
  if (psychPriceSource === 'rrp_synth') note = 'RRP 기반 추정 (중심가 DB 미수록)';
  else if (!psychPriceSource)            note = '중심가 DB · brand_tier_db 모두 미수록 — 외부 참조 필요';

  return {
    landedCostKrw: Math.round(landedCostKrw),
    targetPriceKrw: Math.round(targetPriceKrw),
    customerPsychPriceKrw,
    psychRatio: Number(psychRatio.toFixed(3)),
    centerPriceFound,
    psychPriceSource,
    rrpKrw: rrp ? Math.round(rrp * FX_RRP) : 0,
    note
  };
}
