// 핵심 회귀 테스트: 50 SKU 베이스라인을 diagnose.js로 재산출 → v12 결과 100% 일치 확인.
// 휴리스틱 부분만 비교 (실 BI 데이터가 mock이라 9개 진단 항목은 비교 대상 아님).
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose } from './diagnose.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE = JSON.parse(readFileSync(
  resolve(__dirname, '../test/v12-baseline.json'), 'utf8'
));

let passed = 0, failed = 0;
const diffs = [];

console.log(`── ${BASELINE.baseline.length}건 회귀 검증 ──`);
for (const tc of BASELINE.baseline) {
  // input은 v12 calcScore가 받는 형태. diagnose는 OfferSKU 기대.
  // input의 brand/name/color/category/gender/jsc/rrp/season/sports/product를 OfferSKU 형태로 변환.
  const offer = {
    skuId: 'TEST-' + (passed + failed),
    batchId: 'BASELINE',
    brand: tc.input.brand,
    brandId: '', // 정규화 필요 없음 — 휴리스틱은 brand 원본 사용
    style: tc.input.name,
    color: tc.input.color,
    size: tc.input.size || '',
    category: tc.input.category,
    gender: tc.input.gender,
    product: tc.input.product,
    sports: tc.input.sports,
    jsc: tc.input.jsc,
    rrp: tc.input.rrp,
    season: tc.input.season
  };
  const d = diagnose(offer); // ctx 없이 (휴리스틱만)
  const exp = tc.expected;
  const got = d.heuristic;

  const fields = ['brand', 'color', 'size', 'price', 'season', 'total', 'keywordBonus', 'label', 'cls'];
  let ok = true;
  for (const f of fields) {
    if (JSON.stringify(got[f]) !== JSON.stringify(exp[f])) {
      diffs.push({ sku: offer.style, field: f, expected: exp[f], got: got[f] });
      ok = false;
    }
  }
  if (ok) { passed++; }
  else    { failed++; }
}

if (diffs.length) {
  console.log('\n── 차이 리포트 ──');
  for (const d of diffs.slice(0, 20)) {
    console.log(`  ✗ [${d.sku}] ${d.field}: 기대=${JSON.stringify(d.expected)}, 실제=${JSON.stringify(d.got)}`);
  }
  if (diffs.length > 20) console.log(`  ... 외 ${diffs.length - 20}건`);
}

console.log(`\n총 ${passed + failed}건 — ${passed} pass, ${failed} fail`);
console.log(`회귀 일치율: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
if (failed > 0) {
  console.error('\n❌ 회귀 100% 미달 — Phase 5 품질 게이트 실패');
  process.exit(1);
}
