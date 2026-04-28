// 30 SKU 샘플에서 customerPsychPriceKrw가 산출되는 비율을 측정.
// Phase 2 수정 전: <10% (offerMcMap 미전달 + brandId 매칭 부재)
// Phase 2 수정 후: ≥50% (offerMcMap 전달 + brandId 정규화 + RRP 추정 fallback)
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { diagnose } from '../engine/diagnose.js';
import { normalizeBrandId } from '../shared/brand-normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSampleOffers() {
  const buf = readFileSync(resolve(__dirname, '_mock/sample-offer.xlsx'));
  const wb  = XLSX.read(buf);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  return rows.map((r, i) => ({
    skuId: 'CPC-' + i,
    batchId: 'CPC-BATCH',
    brand: r.BRAND,
    brandId: normalizeBrandId(r.BRAND),
    style: r.STYLE,
    color: r.COLOR,
    size: String(r.SIZE),
    category: r.CATEGORY,
    gender: r.GENDER,
    product: r.PRODUCT_TYPE,
    sports: '',
    jsc: r.JSC,
    rrp: r.RRP,
    qty: r.QTY,
    season: r.SEASON,
    channel: r.CHANNEL,
    arrivalMonth: r.ARRIVAL
  }));
}

function loadDb(name) {
  return JSON.parse(readFileSync(resolve(__dirname, `../data/${name}.json`), 'utf8'));
}

test('center-price coverage — 매칭률 ≥ 50%', () => {
  const offers = loadSampleOffers();
  const centerPriceDB = loadDb('center-price-db');
  const offerMcMap   = loadDb('offer-mc-map').entries;

  let filled = 0;
  let dbHit = 0;
  let synth = 0;
  for (const o of offers) {
    const d = diagnose(o, { centerPriceDB, offerMcMap });
    if (d.pricing.customerPsychPriceKrw > 0) filled += 1;
    if (d.pricing.psychPriceSource === 'db')        dbHit += 1;
    if (d.pricing.psychPriceSource === 'rrp_synth') synth += 1;
  }
  const rate = filled / offers.length;
  console.log(`  30 SKU customerPsychPriceKrw 산출: ${filled}/${offers.length} = ${(rate * 100).toFixed(1)}%`);
  console.log(`    └ db: ${dbHit}, rrp_synth: ${synth}`);
  assert.ok(rate >= 0.5,
    `매칭률 ${(rate * 100).toFixed(1)}% — 50% 미만 (Phase 2 회복 목표 미달)`);
});

test('center-price coverage — offerMcMap 통과 시 매칭이 늘어남', () => {
  const offers = loadSampleOffers();
  const centerPriceDB = loadDb('center-price-db');
  const offerMcMap   = loadDb('offer-mc-map').entries;

  // offerMcMap 없을 때
  let withoutMap = 0;
  for (const o of offers) {
    const d = diagnose(o, { centerPriceDB });  // offerMcMap 미전달
    if (d.pricing.customerPsychPriceKrw > 0) withoutMap += 1;
  }
  // offerMcMap 있을 때
  let withMap = 0;
  for (const o of offers) {
    const d = diagnose(o, { centerPriceDB, offerMcMap });
    if (d.pricing.customerPsychPriceKrw > 0) withMap += 1;
  }
  console.log(`  offerMcMap 없을 때: ${withoutMap}, 있을 때: ${withMap}`);
  // 양쪽 결과는 같거나 with가 더 많아야 함 (regression 안 됨을 검증)
  assert.ok(withMap >= withoutMap,
    `offerMcMap 전달 후 매칭이 줄어듦 (${withoutMap} → ${withMap}) — 회귀`);
});

test('center-price coverage — psychRatio가 채워지는 SKU 비율 ≥ 50%', () => {
  const offers = loadSampleOffers();
  const centerPriceDB = loadDb('center-price-db');
  const offerMcMap   = loadDb('offer-mc-map').entries;

  let psychRatioFilled = 0;
  for (const o of offers) {
    const d = diagnose(o, { centerPriceDB, offerMcMap });
    if (d.pricing.psychRatio > 0) psychRatioFilled += 1;
  }
  const rate = psychRatioFilled / offers.length;
  console.log(`  psychRatio 산출: ${psychRatioFilled}/${offers.length} = ${(rate * 100).toFixed(1)}%`);
  assert.ok(rate >= 0.5,
    `psychRatio 산출률 ${(rate * 100).toFixed(1)}% — 50% 미만`);
});
