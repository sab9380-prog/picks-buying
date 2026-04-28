// aggregate.js 단위 테스트.
// 빈 입력 / 단일 / 가중≠단순 / 가격버킷 / 등급경계.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { aggregateOffer } from './aggregate.js';

// ── 헬퍼: diagnose 모양의 mock 만들기 ────────────────────────────
function mockDiag({ score = 75, label = '적극 권장', cls = '70',
                    psychRatio = 0, risks = [] } = {}) {
  return {
    skuId: 'X', batchId: 'B',
    matched: false, fallbackHeuristic: true,
    heuristic: {
      brand: 0, color: 0, size: 0, price: 0, season: 0,
      keywordBonus: 0, total: score, label, cls,
      keywordMatched: []
    },
    diagnosisItems: risks.length ? { riskSignals: risks } : undefined,
    pricing: { psychRatio, centerPriceFound: psychRatio > 0 }
  };
}

function mockOffer({ qty = 100, jsc = 50, rrp = 100,
                     category = 'FOOTWEAR', gender = 'MEN', size = '42',
                     color = 'BLACK', season = 'SS26',
                     channel = 'OCEAN-OS', arrivalMonth = '2026-06' } = {}) {
  return { qty, jsc, rrp, category, gender, size, color, season, channel, arrivalMonth };
}

// ── 1. 빈 입력 ─────────────────────────────────────────────────
test('aggregate: 빈 입력 → 모든 합계 0, 분모 0 처리', () => {
  const a = aggregateOffer([], []);
  assert.equal(a.totalSkus, 0);
  assert.equal(a.totalQty, 0);
  assert.equal(a.jscSumEur, 0);
  assert.equal(a.rrpSumEur, 0);
  assert.equal(a.weightedBuyRate, 0);
  assert.equal(a.simpleBuyRate, 0);
  assert.equal(a.weightedScore, 0);
  assert.equal(a.simpleScore, 0);
  assert.equal(a.riskCount, 0);
  assert.equal(a.pricingMismatchCount, 0);
  assert.equal(a.overallGrade.cls, '0');
  assert.deepEqual(a.qtyDistribution, { p25: 0, p50: 0, p75: 0, max: 0, mean: 0 });
});

// ── 2. 단일 SKU → 단순/가중 평균 동일 ──────────────────────────
test('aggregate: 단일 SKU → 가중·단순 평균 동일', () => {
  const a = aggregateOffer(
    [mockDiag({ score: 70 })],
    [mockOffer({ qty: 100, jsc: 50, rrp: 100 })]
  );
  assert.equal(a.totalSkus, 1);
  assert.equal(a.totalQty, 100);
  assert.equal(a.weightedScore, a.simpleScore);
  assert.equal(a.weightedScore, 70);
  assert.equal(a.weightedBuyRate, 0.5);
  assert.equal(a.simpleBuyRate, 0.5);
  assert.equal(a.qtyDistribution.p50, 100);
  assert.equal(a.qtyDistribution.max, 100);
});

// ── 3. 다중 + 다양한 qty → 가중≠단순 ────────────────────────────
test('aggregate: 가중평균이 단순평균과 다른 경우 (qty 편향)', () => {
  // 점수 90 (qty 1000) + 점수 30 (qty 10)
  // 단순 = (90+30)/2 = 60
  // 가중 = (90*1000 + 30*10) / 1010 ≈ 89.4
  const a = aggregateOffer(
    [mockDiag({ score: 90 }), mockDiag({ score: 30 })],
    [mockOffer({ qty: 1000 }), mockOffer({ qty: 10 })]
  );
  assert.equal(a.simpleScore, 60);
  assert.ok(a.weightedScore > 89 && a.weightedScore < 90,
            `weightedScore should be ~89.4, got ${a.weightedScore}`);
});

// ── 4. priceBuckets 분류 ────────────────────────────────────────
test('aggregate: priceBuckets — 경계 정확성', () => {
  const a = aggregateOffer(
    [mockDiag(), mockDiag(), mockDiag(), mockDiag(), mockDiag()],
    [
      mockOffer({ jsc: 49, rrp: 99 }),   // 0-50, 0-100
      mockOffer({ jsc: 50, rrp: 100 }),  // 50-100, 100-300
      mockOffer({ jsc: 99, rrp: 299 }),  // 50-100, 100-300
      mockOffer({ jsc: 100, rrp: 300 }), // 100-200, 300-1000
      mockOffer({ jsc: 600, rrp: 1500 })  // 500+, 1000+
    ]
  );
  assert.equal(a.priceBuckets.jsc['0-50'], 1);
  assert.equal(a.priceBuckets.jsc['50-100'], 2);
  assert.equal(a.priceBuckets.jsc['100-200'], 1);
  assert.equal(a.priceBuckets.jsc['500+'], 1);
  assert.equal(a.priceBuckets.rrp['0-100'], 1);
  assert.equal(a.priceBuckets.rrp['100-300'], 2);
  assert.equal(a.priceBuckets.rrp['300-1000'], 1);
  assert.equal(a.priceBuckets.rrp['1000+'], 1);
});

// ── 5. overallGrade 경계값 ──────────────────────────────────────
test('aggregate: overallGrade 라벨 경계 (49/50/59/60/69/70/79/80)', () => {
  const cases = [
    { score: 49, expected: '0' },
    { score: 50, expected: '50' },
    { score: 59, expected: '50' },
    { score: 60, expected: '60' },
    { score: 69, expected: '60' },
    { score: 70, expected: '70' },
    { score: 79, expected: '70' },
    { score: 80, expected: '80' }
  ];
  for (const c of cases) {
    const a = aggregateOffer(
      [mockDiag({ score: c.score })],
      [mockOffer({ qty: 1 })]
    );
    assert.equal(a.overallGrade.cls, c.expected, `score=${c.score} → cls=${c.expected}`);
  }
});

// ── 6. 통계 7종 — 카테고리/성별/사이즈/컬러/시즌/도착월/채널 ──
test('aggregate: 7종 통계 카운트·수량 누적', () => {
  const a = aggregateOffer(
    [mockDiag(), mockDiag(), mockDiag()],
    [
      mockOffer({ category: 'FOOTWEAR', gender: 'MEN',   qty: 10 }),
      mockOffer({ category: 'FOOTWEAR', gender: 'WOMEN', qty: 20 }),
      mockOffer({ category: 'APPAREL',  gender: 'MEN',   qty: 30 })
    ]
  );
  assert.equal(a.byCategory['FOOTWEAR'].count, 2);
  assert.equal(a.byCategory['FOOTWEAR'].qty, 30);
  assert.equal(a.byCategory['APPAREL'].count, 1);
  assert.equal(a.byCategory['APPAREL'].qty, 30);
  assert.equal(a.byGender['MEN'].qty, 40);
  assert.equal(a.byGender['WOMEN'].qty, 20);
  assert.equal(a.arrivalMonths['2026-06'], 60);
  assert.equal(a.channels['OCEAN-OS'], 60);
});

// ── 7. 위험·가격모순 카운트 ─────────────────────────────────────
test('aggregate: riskCount + pricingMismatchCount', () => {
  const a = aggregateOffer(
    [
      mockDiag({ risks: ['컬러 비인기 (네온)'] }),
      mockDiag({ psychRatio: 1.2 }),
      mockDiag({ risks: ['키즈'], psychRatio: 1.5 }),
      mockDiag({ psychRatio: 0.8 })
    ],
    [mockOffer(), mockOffer(), mockOffer(), mockOffer()]
  );
  assert.equal(a.riskCount, 2);
  assert.equal(a.pricingMismatchCount, 2); // 1.2 + 1.5
});

// ── 8. 등급 분포 — 카운트·수량 ──────────────────────────────────
test('aggregate: gradeDistribution 카운트·수량 누적', () => {
  const a = aggregateOffer(
    [
      mockDiag({ score: 85, label: '최우선 매입', cls: '80' }),
      mockDiag({ score: 75, label: '적극 권장',   cls: '70' }),
      mockDiag({ score: 75, label: '적극 권장',   cls: '70' })
    ],
    [
      mockOffer({ qty: 100 }),
      mockOffer({ qty: 50 }),
      mockOffer({ qty: 30 })
    ]
  );
  assert.equal(a.gradeDistribution['최우선 매입'].count, 1);
  assert.equal(a.gradeDistribution['최우선 매입'].qty, 100);
  assert.equal(a.gradeDistribution['적극 권장'].count, 2);
  assert.equal(a.gradeDistribution['적극 권장'].qty, 80);
});

// ── 9. qtyDistribution 분위수 ───────────────────────────────────
test('aggregate: qtyDistribution p25/p50/p75/max/mean', () => {
  // qty: 10, 20, 30, 40, 50  →  p25=20, p50=30, p75=40, max=50, mean=30
  const diags = [10, 20, 30, 40, 50].map(() => mockDiag());
  const offers = [10, 20, 30, 40, 50].map(q => mockOffer({ qty: q }));
  const a = aggregateOffer(diags, offers);
  assert.equal(a.qtyDistribution.p25, 20);
  assert.equal(a.qtyDistribution.p50, 30);
  assert.equal(a.qtyDistribution.p75, 40);
  assert.equal(a.qtyDistribution.max, 50);
  assert.equal(a.qtyDistribution.mean, 30);
});
