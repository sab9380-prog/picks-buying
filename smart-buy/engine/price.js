// 가격 산출 — 내부 우선(CENTER_PRICE_DB) + 외부 참조(픽스 calcPP) 병행.
// 신규 브랜드(중심가 DB 미수록) → "데이터 없음" 표시.

import { offerToMcKey, lookupCenterPrice } from './center-price.js';

// 환율(v12 보존). 단일 환율 통일은 v14+에서 결정.
const FX_JSC = 1740;
const FX_RRP = 1700;
const COST_MULT  = 2.0;
const TARGET_IMU = 0.65;

/**
 * @returns {Diagnosis['pricing']}
 */
export function computePricing(offer, centerPriceDB) {
  const jsc = parseFloat(offer.jsc) || 0;
  const rrp = parseFloat(offer.rrp) || 0;

  // 내부가 — 중심가 DB 조회 (가능하면)
  let centerPriceFound = false;
  let customerPsychPriceKrw = 0;
  if (centerPriceDB && offer.brand) {
    const found = lookupCenterPrice(centerPriceDB, offer);
    if (found != null) {
      centerPriceFound = true;
      customerPsychPriceKrw = found;
    }
  }

  // 랜디드 코스트·목표가 (JSC 기준)
  const landedCostKrw  = jsc ? jsc * FX_JSC * COST_MULT : 0;
  const targetPriceKrw = landedCostKrw ? landedCostKrw / TARGET_IMU : 0;
  const psychRatio     = (centerPriceFound && customerPsychPriceKrw > 0)
    ? targetPriceKrw / customerPsychPriceKrw
    : 0;

  return {
    landedCostKrw: Math.round(landedCostKrw),
    targetPriceKrw: Math.round(targetPriceKrw),
    customerPsychPriceKrw,
    psychRatio: Number(psychRatio.toFixed(3)),
    centerPriceFound,
    rrpKrw: rrp ? Math.round(rrp * FX_RRP) : 0,
    note: centerPriceFound
      ? null
      : '중심가 DB에 해당 브랜드/카테고리 데이터 없음 — 외부 참조 필요'
  };
}
