// 진단 엔진 코어 — v1.4 §5의 9개 진단 항목.
// 입력 OfferSKU → Diagnosis.
// 1) 4-tuple 매칭 시 실 판매·재고 데이터 진단
// 2) 매칭 실패 시 v12 휴리스틱 fallback
// 3) 키즈 자동 제외
//
// 점수 산식은 oracle/v12-functions의 calcScore와 동일 — 회귀 100% 보장.

import { calcScore, gradeLabel, gradeCls } from '../_oracle/v12-functions.mjs';
import { computePricing } from './price.js';

// ── 휴리스틱 진단 ───────────────────────────────────────────────────
// v12 calcScore와 1:1 매핑. 회귀 베이스라인과 비교하기 위함.
export function heuristicDiagnose(offer) {
  // v12 calcScore가 받는 r 형태로 변환
  const r = {
    name: offer.style,         // v12에서 r.name = 모델명
    color: offer.color,
    category: offer.category,
    gender: offer.gender,
    product: offer.product || '',
    sports: offer.sports || '',
    jsc: offer.jsc,
    rrp: offer.rrp,
    season: offer.season
  };
  const score = calcScore(r, offer.brand);
  return {
    ...score,
    label: gradeLabel(score.total),
    cls: gradeCls(score.total)
  };
}

// ── 4-tuple 매칭 ────────────────────────────────────────────────────
// salesHistory: [{ brandId, style, color, size, sales: [{ week, qty }] }]
// 단순 일치 → 부분 일치 fallback
export function match4Tuple(offer, salesHistory) {
  const exact = salesHistory.find(h =>
    h.brandId === offer.brandId &&
    h.style.toUpperCase() === (offer.style || '').toUpperCase() &&
    h.color.toUpperCase() === (offer.color || '').toUpperCase() &&
    h.size === offer.size
  );
  if (exact) return { matched: 'exact', record: exact };

  // size 무시한 brand+style+color 매칭 (사이즈는 시계열 합산용)
  const partial = salesHistory.filter(h =>
    h.brandId === offer.brandId &&
    h.style.toUpperCase() === (offer.style || '').toUpperCase() &&
    h.color.toUpperCase() === (offer.color || '').toUpperCase()
  );
  if (partial.length > 0) return { matched: 'partial-no-size', records: partial };

  // brand+style 매칭 (color도 다를 때)
  const styleOnly = salesHistory.filter(h =>
    h.brandId === offer.brandId &&
    h.style.toUpperCase() === (offer.style || '').toUpperCase()
  );
  if (styleOnly.length > 0) return { matched: 'partial-style', records: styleOnly };

  return { matched: false };
}

// ── 셀스루 산출 (4w/8w/16w 기준, 단순 합산 평균) ──────────────────
function aggregateSellThrough(records) {
  const inventoryAvg = records.reduce((s, r) => s + (r.invStart || 100), 0) / records.length;
  const last4  = sumSales(records, 4);
  const last8  = sumSales(records, 8);
  const last16 = sumSales(records, 16);
  return {
    w4:  inventoryAvg ? Math.min(100, (last4 / inventoryAvg) * 100) : 0,
    w8:  inventoryAvg ? Math.min(100, (last8 / inventoryAvg) * 100) : 0,
    w16: inventoryAvg ? Math.min(100, (last16 / inventoryAvg) * 100) : 0
  };
}

function sumSales(records, weeks) {
  let total = 0;
  for (const r of records) {
    const arr = r.sales || [];
    const last = arr.slice(-weeks);
    for (const e of last) total += e.qty || 0;
  }
  return total;
}

// ── 9개 진단 항목 (실 데이터 기반) ────────────────────────────────
function buildDiagnosisItems(matchResult, offer, inventory, incoming) {
  const items = {};

  if (matchResult.matched && matchResult.records) {
    items.sellThrough = aggregateSellThrough(matchResult.records);
    const recentInv = (inventory || []).find(i =>
      i.brandId === offer.brandId &&
      i.style.toUpperCase() === (offer.style || '').toUpperCase()
    );
    const recentInc = (incoming || []).find(i =>
      i.brandId === offer.brandId &&
      i.style.toUpperCase() === (offer.style || '').toUpperCase()
    );
    items.inventoryStatus = {
      onHand:   recentInv?.onHand ?? 0,
      incoming: recentInc?.qty ?? 0,
      avgSold:  matchResult.records.reduce((s, r) => s + (r.avgSold || 0), 0) / matchResult.records.length
    };
  }

  // 결정시한 — 도착예정월 기준 단순 추정
  if (offer.arrivalMonth) {
    const today = new Date();
    const [y, m] = offer.arrivalMonth.split('-').map(Number);
    const arrival = new Date(y, m - 1, 1);
    const weeks = Math.ceil((arrival - today) / (7 * 24 * 3600 * 1000));
    items.decisionDeadline = {
      weeks,
      tier: weeks <= 1 ? '🚨' : weeks <= 4 ? '⏰' : '🟢'
    };
  }

  // 리스크 신호
  const risks = [];
  if (offer.color && /NEON|FLUOR|HIGHLIGHTER/.test(offer.color.toUpperCase())) risks.push('컬러 비인기 (네온)');
  if (offer.color && /AOP|MULTI|FLORAL|LEOPARD|CAMO/.test(offer.color.toUpperCase())) risks.push('컬러 비인기 (멀티/프린트)');
  if (offer.gender === 'KIDS') risks.push('키즈 — 해외 매입 제외');
  if (offer.season && /S2[0-3]|F2[0-3]|SS2[0-3]|FW2[0-3]/.test(offer.season.toUpperCase())) risks.push('구시즌 (24시즌 이전)');
  if (risks.length) items.riskSignals = risks;

  return items;
}

// ── 메인 진단 함수 ──────────────────────────────────────────────────
/**
 * @param {OfferSKU} offer
 * @param {object} ctx — { salesHistory?, inventory?, incoming?, centerPriceDB? }
 * @returns {Diagnosis}
 */
export function diagnose(offer, ctx = {}) {
  const heuristic = heuristicDiagnose(offer);
  const matchResult = match4Tuple(offer, ctx.salesHistory || []);
  const matched = !!matchResult.matched;
  const fallbackHeuristic = !matched;

  const diagnosisItems = buildDiagnosisItems(matchResult, offer, ctx.inventory, ctx.incoming);
  const pricing = computePricing(offer, ctx.centerPriceDB);

  return {
    skuId: offer.skuId,
    batchId: offer.batchId,
    matched,
    fallbackHeuristic,
    matchType: matchResult.matched || null,
    heuristic,
    diagnosisItems: Object.keys(diagnosisItems).length ? diagnosisItems : undefined,
    pricing,
    diagnosedAt: new Date().toISOString()
  };
}
