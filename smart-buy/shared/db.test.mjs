// IndexedDB CRUD 라운드트립 테스트 — fake-indexeddb 환경에서.
import 'fake-indexeddb/auto';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  openDB, putBrand, getBrand, listBrands,
  putOffer, putOffersBulk, getOffer, getOffersByBatch, listOffers,
  putDiagnosis, getDiagnosis, listDiagnosesByBatch,
  putDecision, listDecisions, getDecisionsBySku,
  putStaticAsset, getStaticAsset, clearAll
} from './db.js';
import { STORE } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../data');

let passed = 0, failed = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.log('  ✗', name, '\n   ', e.message); failed++; }
};

const db = await openDB();
console.log('── DB 초기화 ──');
await t('5 store 모두 존재', () => {
  const names = Array.from(db.objectStoreNames);
  for (const s of Object.values(STORE)) {
    assert.ok(names.includes(s), `${s} 누락`);
  }
});

await clearAll(db);

console.log('── brands_master ──');
await t('brand put/get 라운드트립', async () => {
  await putBrand(db, { id: 'adidas', raw: 'ADIDAS', tierScore: 24 });
  const r = await getBrand(db, 'adidas');
  assert.equal(r.tierScore, 24);
});
await t('listBrands 빈 → 1건', async () => {
  const list = await listBrands(db);
  assert.equal(list.length, 1);
});

console.log('── offers ──');
await t('offer put/get', async () => {
  await putOffer(db, { batchId: 'B1', skuId: 'B1-001', brandId: 'adidas', brand: 'ADIDAS', style: 'SAMBA', color: 'BLACK', size: '42', category: 'FOOTWEAR', gender: 'MEN' });
  const r = await getOffer(db, 'B1-001');
  assert.equal(r.style, 'SAMBA');
});
await t('putOffersBulk 100건', async () => {
  const arr = Array.from({ length: 100 }, (_, i) => ({
    batchId: 'B-BULK',
    skuId: 'B-BULK-' + String(i).padStart(3, '0'),
    brandId: i % 2 === 0 ? 'nike' : 'adidas',
    brand: i % 2 === 0 ? 'NIKE' : 'ADIDAS',
    style: 'STYLE-' + i, color: 'BLACK', size: '42',
    category: 'FOOTWEAR', gender: 'MEN'
  }));
  const n = await putOffersBulk(db, arr);
  assert.equal(n, 100);
});
await t('getOffersByBatch 인덱스 조회', async () => {
  const arr = await getOffersByBatch(db, 'B-BULK');
  assert.equal(arr.length, 100);
});
await t('listOffers 총 101건', async () => {
  const arr = await listOffers(db);
  assert.equal(arr.length, 101);
});

console.log('── diagnoses ──');
await t('diagnosis put/get', async () => {
  await putDiagnosis(db, {
    skuId: 'B1-001', batchId: 'B1', matched: false,
    fallbackHeuristic: true,
    heuristic: { brand: 30, color: 20, size: 20, price: 20, season: 10, total: 100, keywordBonus: 5, keywordMatched: ['헤리티지·레트로(+5)'], label: '최우선 매입', cls: '80' },
    diagnosedAt: new Date().toISOString()
  });
  const r = await getDiagnosis(db, 'B1-001');
  assert.equal(r.heuristic.total, 100);
});
await t('listDiagnosesByBatch', async () => {
  const arr = await listDiagnosesByBatch(db, 'B1');
  assert.equal(arr.length, 1);
});

console.log('── decisions ──');
await t('decision put + listDecisions', async () => {
  await putDecision(db, {
    decisionId: 'D-1',
    skuId: 'B1-001', batchId: 'B1',
    decision: 'BUY',
    diagnosisSnapshot: { skuId: 'B1-001', batchId: 'B1', matched: false, fallbackHeuristic: true, heuristic: { brand: 30, color: 20, size: 20, price: 20, season: 10, total: 100, keywordBonus: 5, keywordMatched: ['헤리티지·레트로(+5)'], label: '최우선 매입', cls: '80' }, diagnosedAt: new Date().toISOString() },
    decidedAt: new Date().toISOString()
  });
  const list = await listDecisions(db);
  assert.equal(list.length, 1);
  assert.equal(list[0].decision, 'BUY');
});
await t('getDecisionsBySku 인덱스', async () => {
  const arr = await getDecisionsBySku(db, 'B1-001');
  assert.equal(arr.length, 1);
});

console.log('── static_assets (수동 시드) ──');
await t('13개 JSON 시드 + 조회', async () => {
  const files = [
    'center-price-db', 'brand-size-db', 'model-keyword-rules',
    'color-trend-rules', 'brand-score-rules', 'offer-mc-map',
    'price-rules', 'season-rules', 'size-rules',
    'grade-labels', 'kids-exclusion', 'category-inference', 'channels'
  ];
  for (const f of files) {
    const json = JSON.parse(readFileSync(resolve(DATA, `${f}.json`), 'utf8'));
    await putStaticAsset(db, f, json);
  }
  const r = await getStaticAsset(db, 'center-price-db');
  assert.ok(r.brands, 'center-price-db.brands 누락');
  const r2 = await getStaticAsset(db, 'channels');
  assert.equal(r2.channels.length, 4);
});

console.log('── clearAll ──');
await t('clearAll 후 빈 상태', async () => {
  await clearAll(db);
  const arr = await listOffers(db);
  assert.equal(arr.length, 0);
});

console.log(`\n총 ${passed + failed}건 — ${passed} pass, ${failed} fail`);
db.close();
if (failed > 0) process.exit(1);
