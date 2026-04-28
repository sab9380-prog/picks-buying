// brand-normalize.js 테스트.
// node --experimental-json-modules 없이 Node 22+에서 import attributes 지원.
import { strict as assert } from 'node:assert';
import { normalizeBrandId, isKnownBrand, _internal } from './brand-normalize.js';

let passed = 0, failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.log('  ✗', name, '\n   ', e.message); failed++; }
};

console.log('── 영문 표기 → adidas ──');
t('"ADIDAS" → adidas', () => assert.equal(normalizeBrandId('ADIDAS'), 'adidas'));
t('"adidas" → adidas', () => assert.equal(normalizeBrandId('adidas'), 'adidas'));
t('"Adidas Originals" → adidas', () => assert.equal(normalizeBrandId('Adidas Originals'), 'adidasoriginals'));
t('"Adidas" → adidas', () => assert.equal(normalizeBrandId('Adidas'), 'adidas'));

console.log('── 한글 → adidas ──');
t('"아디다스" → adidas', () => assert.equal(normalizeBrandId('아디다스'), 'adidas'));
t('"아디다스(ADIDAS)" → adidas', () => assert.equal(normalizeBrandId('아디다스(ADIDAS)'), 'adidas'));

console.log('── NIKE / 나이키 ──');
t('"NIKE" → nike', () => assert.equal(normalizeBrandId('NIKE'), 'nike'));
t('"나이키" → nike', () => assert.equal(normalizeBrandId('나이키'), 'nike'));
t('"Nike Inc" → nike', () => assert.equal(normalizeBrandId('Nike Inc'), 'nikeinc'));
t('"Nike" → nike', () => assert.equal(normalizeBrandId('Nike'), 'nike'));

console.log('── NEW BALANCE / 뉴발란스 ──');
t('"NEW BALANCE" → newbalance', () => assert.equal(normalizeBrandId('NEW BALANCE'), 'newbalance'));
t('"New Balance" → newbalance', () => assert.equal(normalizeBrandId('New Balance'), 'newbalance'));
t('"뉴발란스" → newbalance', () => assert.equal(normalizeBrandId('뉴발란스'), 'newbalance'));
t('"NEWBALANCE" → newbalance', () => assert.equal(normalizeBrandId('NEWBALANCE'), 'newbalance'));

console.log('── 기타 브랜드 ──');
t('"버버리" → burberry', () => assert.equal(normalizeBrandId('버버리'), 'burberry'));
t('"BURBERRY" → burberry', () => assert.equal(normalizeBrandId('BURBERRY'), 'burberry'));
t('"라코스테" → lacoste', () => assert.equal(normalizeBrandId('라코스테'), 'lacoste'));
t('"Acne Studios" → acnestudios', () => assert.equal(normalizeBrandId('Acne Studios'), 'acnestudios'));
t('"아크네스튜디오" → acnestudios', () => assert.equal(normalizeBrandId('아크네스튜디오'), 'acnestudios'));
t('"Polo Ralph Lauren" → poloralphlauren', () => assert.equal(normalizeBrandId('Polo Ralph Lauren'), 'poloralphlauren'));

console.log('── 빈 값/엣지 ──');
t('빈 문자열 → ""', () => assert.equal(normalizeBrandId(''), ''));
t('null → ""', () => assert.equal(normalizeBrandId(null), ''));
t('undefined → ""', () => assert.equal(normalizeBrandId(undefined), ''));
t('whitespace → ""', () => assert.equal(normalizeBrandId('   '), ''));

console.log('── isKnownBrand ──');
t('adidas는 알려진 브랜드', () => assert.equal(isKnownBrand('adidas'), true));
t('nike는 알려진 브랜드', () => assert.equal(isKnownBrand('nike'), true));
t('xyzunknown는 미등록', () => assert.equal(isKnownBrand('xyzunknown'), false));

console.log('── 내부 canonical ──');
t('canonical 공백·괄호 제거', () => assert.equal(_internal.canonical('Adidas (Originals)'), 'adidasoriginals'));
t('canonical 한자 → 그대로', () => assert.equal(_internal.canonical('아디다스'), '아디다스'));

console.log(`\n총 ${passed + failed}건 — ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
