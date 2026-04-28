// oracle 함수 sanity test — Phase 1 품질 게이트.
import { strict as assert } from 'node:assert';
import {
  euRange, getSizeDB, normBrand, getBrandScore, BRAND_TIER_DB,
  sBrand, sColor, sSize, sPrice, sSeason,
  applyKeywordBonus, calcScore,
  gradeLabel, gradeCls,
  inferCat, inferGender, inferSeason, inferProductType, normCat
} from './v12-functions.mjs';

let passed = 0, failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.log('  ✗', name, '\n   ', e.message); failed++; }
};

console.log('── helpers ──');
t('euRange(36,39) returns 7 entries', () => assert.equal(euRange(36, 39).length, 7));
t('euRange(35.5, 38.5) returns 7 entries', () => assert.equal(euRange(35.5, 38.5).length, 7));
t('normBrand strips parens·case', () => assert.equal(normBrand('Adidas (Originals)'), 'ADIDAS ORIGINALS'));
t('normCat strips underscores', () => assert.equal(normCat('남성_캐쥬얼_반팔티'), '남성캐쥬얼반팔티'));

console.log('── BRAND_SIZE_DB ──');
t('getSizeDB(ADIDAS) → ADIDAS', () => assert.equal(getSizeDB('ADIDAS Originals'), getSizeDB('ADIDAS')));
t('getSizeDB(NIKE) returns NIKE entry', () => assert.equal(getSizeDB('NIKE').fit, 'normal'));
t('getSizeDB(NEW BALANCE) runs_large fit', () => assert.equal(getSizeDB('NEW BALANCE').fit, 'runs_large'));
t('getSizeDB(unknown) → ADIDAS default', () => assert.equal(getSizeDB('UNKNOWN_X'), getSizeDB('ADIDAS')));

console.log('── BRAND_TIER_DB ──');
t('BURBERRY = 30', () => assert.equal(BRAND_TIER_DB['BURBERRY'], 30));
t('NIKE = 26', () => assert.equal(BRAND_TIER_DB['NIKE'], 26));
t('getBrandScore(adidas) finds 24', () => assert.equal(getBrandScore('ADIDAS'), 24));
t('getBrandScore(아디다스) finds 24', () => assert.equal(getBrandScore('아디다스'), 24));
t('getBrandScore(unknown) returns null', () => assert.equal(getBrandScore('XYZUNKNOWN_BRAND_NEVERSEEN'), null));

console.log('── sBrand (refactored) ──');
t('sBrand SAMBA → 30', () => assert.equal(sBrand({ name: 'SAMBA OG' }, 'ADIDAS'), 30));
t('sBrand AIR FORCE → 28', () => assert.equal(sBrand({ name: 'AIR FORCE 1' }, 'NIKE'), 28));
t('sBrand 990 NB → 30', () => assert.equal(sBrand({ name: '990v6' }, 'NEW BALANCE'), 30));
t('sBrand unknown FOOTWEAR → 18', () => assert.equal(sBrand({ category: 'FOOTWEAR' }, 'UNKNOWN_BRAND_X'), 18));

console.log('── sColor ──');
t('CORE BLACK → 20', () => assert.equal(sColor({ color: 'CORE BLACK' }), 20));
t('CWHITE → 20', () => assert.equal(sColor({ color: 'CWHITE' }), 20));
t('BLACK + WHITE → 18', () => assert.equal(sColor({ color: 'BLACK WHITE' }), 18));
t('BEIGE → 16', () => assert.equal(sColor({ color: 'BEIGE' }), 16));
t('GREY → 14', () => assert.equal(sColor({ color: 'HEATHER GREY' }), 14));
t('NAVY → 12', () => assert.equal(sColor({ color: 'NAVY' }), 12));
t('NEON YELLOW → 2', () => assert.equal(sColor({ color: 'NEON YELLOW' }), 2));
t('FLORAL AOP → 4', () => assert.equal(sColor({ color: 'FLORAL PRINTED' }), 4));

console.log('── sSize / sPrice / sSeason ──');
t('FOOTWEAR → 20', () => assert.equal(sSize({ category: 'FOOTWEAR' }), 20));
t('APPAREL → 9', () => assert.equal(sSize({ category: 'APPAREL' }), 9));
t('sPrice missing → 5', () => assert.equal(sPrice({}), 5));
t('sPrice 60% disc → 20', () => {
  // landed = jsc * 1740 * 2; target = landed/0.65; rrpKRW = rrp*1700
  // disc = 1 - target/rrpKRW. jsc=10, rrp=100 → landed=34800, target=53538.46, rrpKRW=170000, disc=0.685
  assert.equal(sPrice({ jsc: 10, rrp: 100 }), 20);
});
t('sSeason SS26 → 10', () => assert.equal(sSeason({ season: 'SS26' }), 10));
t('sSeason F25 → 8', () => assert.equal(sSeason({ season: 'F25' }), 8));
t('sSeason missing → 1', () => assert.equal(sSeason({}), 1));

console.log('── applyKeywordBonus ──');
t('SAMBA → +5', () => assert.equal(applyKeywordBonus('SAMBA OG', 'SNEAKERS').delta, 5));
t('SWIMWEAR → -4', () => assert.equal(applyKeywordBonus('SWIMWEAR TRUNK', '').delta, -4));
t('cap at +6', () => {
  const r = applyKeywordBonus('SAMBA BOOST CASHMERE COLLAB', '');
  assert.ok(r.delta <= 6);
});
t('cap at -6', () => {
  const r = applyKeywordBonus('SWIMWEAR FORMAL UNDERWEAR GOLF', '');
  assert.ok(r.delta >= -6);
});

console.log('── calcScore ──');
t('KIDS → total 0', () => {
  const s = calcScore({ gender: 'KIDS', name: 'X', color: 'BLACK', category: 'APPAREL' }, 'ADIDAS');
  assert.equal(s.total, 0);
  assert.deepEqual(s.keywordMatched, ['키즈 매입 제외']);
});
t('Adult ADIDAS SAMBA BLACK SS26 jsc=10 rrp=100 → known total', () => {
  const s = calcScore({
    gender: 'MEN', name: 'SAMBA OG', color: 'CORE BLACK',
    category: 'FOOTWEAR', jsc: 10, rrp: 100, season: 'SS26'
  }, 'ADIDAS');
  // brand 30 + color 20 + size 20 + price 20 + season 10 = 100, +5 키워드 보너스(SAMBA)
  // brand 30+5=35 → cap 30. total = 30 + 20 + 20 + 20 + 10 = 100
  assert.equal(s.brand, 30);
  assert.equal(s.color, 20);
  assert.equal(s.size, 20);
  assert.equal(s.price, 20);
  assert.equal(s.season, 10);
  assert.equal(s.total, 100);
});

console.log('── grade / infer ──');
t('gradeLabel 80 → 최우선 매입', () => assert.equal(gradeLabel(80), '최우선 매입'));
t('gradeLabel 49 → 패스', () => assert.equal(gradeLabel(49), '패스'));
t('gradeCls 70 → 70', () => assert.equal(gradeCls(70), '70'));
t('inferCat SNEAKER → FOOTWEAR', () => assert.equal(inferCat({ x: 'SAMBA SNEAKER' }), 'FOOTWEAR'));
t('inferGender WOMEN', () => assert.equal(inferGender({ g: 'Women' }), 'WOMEN'));
t('inferGender KIDS', () => assert.equal(inferGender({ g: 'Kids size' }), 'KIDS'));
t('inferSeason SS26', () => assert.equal(inferSeason({ x: 'Drop SS26 collection' }), 'SS26'));
t('inferProductType HOODIE', () => assert.equal(inferProductType('Cotton Hoodie', ''), 'HOODIE'));

console.log(`\n총 ${passed + failed}건 — ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
