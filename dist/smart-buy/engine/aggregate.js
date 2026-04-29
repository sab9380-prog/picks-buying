// 매입조건·통계 집계 — 대시보드(전체 오퍼) 탭 전용.
// diagnoses + offers → OfferAggregate.
//
// KPI(가중평균/단순평균), 등급분포, 7종 통계, 가격버킷, 위험·가격모순 카운트.

// 종합 등급(오퍼 단위) 라벨 — index.html 그라데이션 g-XX 클래스와 매핑.
function overallGradeOf(weightedScore) {
  if (weightedScore >= 80) return { label: '최우선 매입 오퍼', cls: '80' };
  if (weightedScore >= 70) return { label: '적극 검토 오퍼',   cls: '70' };
  if (weightedScore >= 60) return { label: '선별 매입 오퍼',   cls: '60' };
  if (weightedScore >= 50) return { label: '신중 검토 오퍼',   cls: '50' };
  return { label: '전반 패스 오퍼', cls: '0' };
}

function priceBucketJsc(eur) {
  if (eur < 50)   return '0-50';
  if (eur < 100)  return '50-100';
  if (eur < 200)  return '100-200';
  if (eur < 500)  return '200-500';
  return '500+';
}

function priceBucketRrp(eur) {
  if (eur < 100)  return '0-100';
  if (eur < 300)  return '100-300';
  if (eur < 1000) return '300-1000';
  return '1000+';
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function bumpKv(map, key, qty) {
  if (!map[key]) map[key] = { count: 0, qty: 0 };
  map[key].count += 1;
  map[key].qty   += qty;
}

/**
 * @param {Diagnosis[]} diagnoses — diagnose() 결과 배열 (heuristic, pricing 포함)
 * @param {OfferSKU[]}  offers    — diagnoses와 같은 길이/순서를 가정. 비워두면 d.offer 사용.
 * @returns {OfferAggregate}
 */
export function aggregateOffer(diagnoses, offers = null) {
  const items = diagnoses.map((d, i) => ({
    d,
    o: (offers && offers[i]) || d.offer || {}
  }));

  const totalSkus = items.length;
  let totalQty   = 0;
  let jscSumEur  = 0;
  let rrpSumEur  = 0;
  let weightedScoreNum = 0;   // Σ score × qty
  let simpleScoreSum   = 0;
  let simpleBuyRateSum = 0;
  let simpleBuyRateCnt = 0;
  let riskCount = 0;
  let pricingMismatchCount = 0;

  const arrivalMonths = {};
  const channels = {};
  const byCategory = {};
  const byGender   = {};
  const bySize     = {};
  const byColor    = {};
  const bySeason   = {};
  const qtyValues  = [];
  const priceBuckets = {
    jsc: { '0-50': 0, '50-100': 0, '100-200': 0, '200-500': 0, '500+': 0 },
    rrp: { '0-100': 0, '100-300': 0, '300-1000': 0, '1000+': 0 }
  };
  const gradeDistribution = {};

  for (const { d, o } of items) {
    const qty   = Number(o.qty)   || 0;
    const jsc   = Number(o.jsc)   || 0;
    const rrp   = Number(o.rrp)   || 0;
    const score = Number(d.heuristic?.total) || 0;

    totalQty  += qty;
    jscSumEur += jsc * qty;
    rrpSumEur += rrp * qty;
    weightedScoreNum += score * qty;
    simpleScoreSum   += score;

    if (jsc > 0 && rrp > 0) {
      simpleBuyRateSum += jsc / rrp;
      simpleBuyRateCnt += 1;
    }

    if (o.arrivalMonth) {
      arrivalMonths[o.arrivalMonth] = (arrivalMonths[o.arrivalMonth] || 0) + qty;
    }
    if (o.channel) {
      channels[o.channel] = (channels[o.channel] || 0) + qty;
    }

    bumpKv(byCategory, o.category || '미상', qty);
    bumpKv(byGender,   o.gender   || '미상', qty);
    if (o.size)   bumpKv(bySize,  String(o.size),  qty);
    if (o.color)  bumpKv(byColor, String(o.color), qty);
    bumpKv(bySeason,   o.season   || '미상', qty);

    qtyValues.push(qty);

    if (jsc > 0) priceBuckets.jsc[priceBucketJsc(jsc)] += 1;
    if (rrp > 0) priceBuckets.rrp[priceBucketRrp(rrp)] += 1;

    // 등급 분포 — heuristic.label/cls 그대로 (50건 회귀의 등급)
    const lbl = d.heuristic?.label || '미상';
    if (!gradeDistribution[lbl]) gradeDistribution[lbl] = { count: 0, qty: 0, cls: d.heuristic?.cls || '0' };
    gradeDistribution[lbl].count += 1;
    gradeDistribution[lbl].qty   += qty;

    if (d.diagnosisItems?.riskSignals?.length) riskCount += 1;
    if (d.pricing?.psychRatio && d.pricing.psychRatio > 1.0) pricingMismatchCount += 1;
  }

  const weightedBuyRate = rrpSumEur > 0 ? jscSumEur / rrpSumEur : 0;
  const simpleBuyRate   = simpleBuyRateCnt > 0 ? simpleBuyRateSum / simpleBuyRateCnt : 0;
  const weightedScore   = totalQty > 0 ? weightedScoreNum / totalQty : 0;
  const simpleScore     = totalSkus > 0 ? simpleScoreSum / totalSkus : 0;

  const sortedQty = [...qtyValues].sort((a, b) => a - b);
  const qtyDistribution = {
    p25:  Math.round(percentile(sortedQty, 0.25)),
    p50:  Math.round(percentile(sortedQty, 0.50)),
    p75:  Math.round(percentile(sortedQty, 0.75)),
    max:  sortedQty.length ? sortedQty[sortedQty.length - 1] : 0,
    mean: totalSkus > 0 ? Math.round(qtyValues.reduce((a, b) => a + b, 0) / totalSkus) : 0
  };

  return {
    totalSkus,
    totalQty,
    jscSumEur:  Math.round(jscSumEur),
    rrpSumEur:  Math.round(rrpSumEur),
    weightedBuyRate: Number(weightedBuyRate.toFixed(4)),
    simpleBuyRate:   Number(simpleBuyRate.toFixed(4)),
    arrivalMonths,
    channels,
    weightedScore: Number(weightedScore.toFixed(2)),
    simpleScore:   Number(simpleScore.toFixed(2)),
    overallGrade:  overallGradeOf(weightedScore),
    gradeDistribution,
    byCategory,
    byGender,
    bySize,
    byColor,
    bySeason,
    qtyDistribution,
    priceBuckets,
    riskCount,
    pricingMismatchCount
  };
}
