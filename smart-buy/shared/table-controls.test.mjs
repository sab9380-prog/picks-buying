// 표 컨트롤(필터·검색) 단위 테스트.
// applyControls의 합성 동작 검증 — 같은 그룹 OR, 그룹 간 AND, 검색 부분 일치.

import { applyControls } from './table-controls.js';

let passed = 0, failed = 0;
function ok(name, cond, info = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

function makeDiag(brand, category, season, gender, style = 'STYLE-A', skuId = '') {
  return {
    skuId: skuId || `BATCH-0001-${brand}-${style}`,
    offer: { brand, category, season, gender, style }
  };
}

const list = [
  makeDiag('NIKE',     'FOOTWEAR', 'SS',  'MEN',    'AIR-MAX', 'BATCH-0001-NIKE-AIR-MAX'),
  makeDiag('NIKE',     'TOPS',     'SS',  'WOMEN',  'TEE',     'BATCH-0002-NIKE-TEE'),
  makeDiag('ADIDAS',   'FOOTWEAR', 'FW',  'MEN',    'SAMBA',   'BATCH-0003-ADID-SAMBA'),
  makeDiag('ADIDAS',   'BOTTOMS',  'FW',  'WOMEN',  'TRACK',   'BATCH-0004-ADID-TRACK'),
  makeDiag('PUMA',     'FOOTWEAR', 'SS',  'UNISEX', 'SUEDE',   'BATCH-0005-PUMA-SUEDE')
];

const empty = () => ({
  search: '',
  selected: { brand: new Set(), category: new Set(), season: new Set(), gender: new Set() }
});

console.log('table-controls.test.mjs — applyControls');

// 1. 빈 state — 모두 통과
{
  const r = applyControls(list, empty());
  ok('1. 빈 state면 모두 통과', r.length === 5, `${r.length}/5`);
}

// 2. 단일 그룹 단일 칩 — 정확히 그 값만
{
  const s = empty(); s.selected.brand.add('NIKE');
  const r = applyControls(list, s);
  ok('2. 브랜드 단일 칩', r.length === 2 && r.every(d => d.offer.brand === 'NIKE'), `${r.length}/2`);
}

// 3. 단일 그룹 다중 칩 — OR
{
  const s = empty(); s.selected.brand.add('NIKE'); s.selected.brand.add('ADIDAS');
  const r = applyControls(list, s);
  ok('3. 같은 그룹 다중 칩 OR', r.length === 4, `${r.length}/4`);
}

// 4. 그룹 간 AND
{
  const s = empty();
  s.selected.brand.add('NIKE');
  s.selected.season.add('SS');
  const r = applyControls(list, s);
  ok('4. 그룹 간 AND', r.length === 2 && r.every(d => d.offer.brand === 'NIKE' && d.offer.season === 'SS'), `${r.length}/2`);
}

// 5. 검색 — 부분 일치 (대소문자 무시)
{
  const s = empty(); s.search = 'samba';
  const r = applyControls(list, s);
  ok('5. 검색 부분 일치', r.length === 1 && r[0].offer.style === 'SAMBA', `${r.length}/1`);
}

// 6. 검색 — SKU 코드 매칭
{
  const s = empty(); s.search = '0003';
  const r = applyControls(list, s);
  ok('6. 검색 SKU 코드', r.length === 1 && r[0].skuId.includes('0003'), `${r.length}/1`);
}

// 7. 검색 + 필터 동시
{
  const s = empty();
  s.selected.category.add('FOOTWEAR');
  s.search = 'nike';
  const r = applyControls(list, s);
  ok('7. 검색 + 필터 동시 AND', r.length === 1 && r[0].offer.brand === 'NIKE' && r[0].offer.category === 'FOOTWEAR', `${r.length}/1`);
}

// 8. 결과 0건 케이스
{
  const s = empty();
  s.selected.brand.add('NIKE');
  s.selected.brand.add('ADIDAS');
  s.selected.gender.add('UNISEX');
  const r = applyControls(list, s);
  ok('8. 결과 0건', r.length === 0, `${r.length}/0`);
}

// 9. 검색어 trim
{
  const s = empty(); s.search = '   tee   ';
  const r = applyControls(list, s);
  ok('9. 검색어 trim', r.length === 1, `${r.length}/1`);
}

console.log(`\nresult: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
