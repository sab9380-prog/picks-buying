// 50 SKU 회귀 베이스라인 자동 생성.
// oracle로 점수 산출 → test/v12-baseline.json 저장.
// 커버리지: FOOTWEAR 25 / APPAREL 15 / ACCESSORY 10
// 브랜드: ADIDAS 15 / NIKE 10 / NB 10 / LACOSTE 5 / 기타 10
// 엣지: 키즈 1 / 환율 결측 1 / 시즌 결측 1 / 컬러 멀티 1 /
//        키워드 +5/+4/-4 각 1 / 신규 브랜드 2
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcScore, gradeLabel, gradeCls } from '../_oracle/v12-functions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'v12-baseline.json');

// ── 50 SKU 정의 (커버리지 균형 + 엣지) ──
const SKUS = [
  // ── ADIDAS FOOTWEAR (8) ──
  { brand: 'ADIDAS', name: 'SAMBA OG',     color: 'CORE BLACK',  size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 60, rrp: 120, season: 'SS26', sports: 'ORIGINALS' },
  { brand: 'ADIDAS', name: 'GAZELLE',      color: 'CWHITE',      size: '38',  category: 'FOOTWEAR', gender: 'WOMEN', product: 'SNEAKERS', jsc: 55, rrp: 110, season: 'FW25', sports: 'ORIGINALS' },
  { brand: 'ADIDAS', name: 'CAMPUS 00s',   color: 'NAVY',        size: '40',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 50, rrp: 110, season: 'SS25', sports: 'ORIGINALS' },
  { brand: 'ADIDAS', name: 'STAN SMITH',   color: 'WHITE GREEN', size: '41',  category: 'FOOTWEAR', gender: 'UNISEX',product: 'SNEAKERS', jsc: 45, rrp: 100, season: 'SS24', sports: 'ORIGINALS' },
  { brand: 'ADIDAS', name: 'ULTRABOOST 22',color: 'TRIPLE BLACK',size: '43',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 80, rrp: 180, season: 'SS26', sports: 'RUNNING' },
  { brand: 'ADIDAS', name: 'PREDATOR FG',  color: 'BLACK RED',   size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'BOOTS',    jsc: 70, rrp: 200, season: 'SS25', sports: 'FOOTBALL' }, // 종목 특화 -4
  { brand: 'ADIDAS', name: 'HANDBALL SPEZIAL', color: 'ROYAL BLUE', size: '40', category: 'FOOTWEAR', gender: 'UNISEX', product: 'SNEAKERS', jsc: 55, rrp: 130, season: 'FW25', sports: 'ORIGINALS' },
  { brand: 'ADIDAS', name: 'SUPERSTAR',    color: 'WHITE BLACK', size: '39',  category: 'FOOTWEAR', gender: 'WOMEN', product: 'SNEAKERS', jsc: 40, rrp: 100, season: 'SS24', sports: 'ORIGINALS' },

  // ── ADIDAS APPAREL (5) ──
  { brand: 'ADIDAS', name: 'TREFOIL HOODIE', color: 'BLACK', size: 'L', category: 'APPAREL', gender: 'MEN',   product: 'HOODIE', jsc: 45, rrp: 90,  season: 'FW25' },
  { brand: 'ADIDAS', name: 'FIREBIRD TRACK TOP', color: 'NAVY WHITE', size: 'M', category: 'APPAREL', gender: 'MEN', product: 'JACKET', jsc: 50, rrp: 100, season: 'SS26' },
  { brand: 'ADIDAS', name: 'ESSENTIAL CREWNECK', color: 'GREY HEATHER', size: 'XL', category: 'APPAREL', gender: 'MEN', product: 'SWEATSHIRT', jsc: 30, rrp: 65,  season: 'FW24' },
  { brand: 'ADIDAS', name: 'LOGO TEE',     color: 'WHITE',       size: 'S',   category: 'APPAREL', gender: 'WOMEN', product: 'TEE', jsc: 18, rrp: 40, season: 'SS25' },
  { brand: 'ADIDAS', name: '3-STRIPES PANTS', color: 'BLACK', size: 'M', category: 'APPAREL', gender: 'WOMEN', product: 'PANTS', jsc: 35, rrp: 80, season: 'SS26' },

  // ── ADIDAS ACCESSORY (2) ──
  { brand: 'ADIDAS', name: 'SHOULDER BAG', color: 'BLACK',       size: 'OS',  category: 'ACCESSORY', gender: 'UNISEX', product: 'BAG', jsc: 22, rrp: 50, season: 'SS25' },
  { brand: 'ADIDAS', name: 'CAP TREFOIL',  color: 'OLIVE',       size: 'OS',  category: 'ACCESSORY', gender: 'UNISEX', product: 'CAP', jsc: 12, rrp: 30, season: 'SS26' },

  // ── NIKE FOOTWEAR (7) ──
  { brand: 'NIKE',   name: 'AIR FORCE 1',  color: 'WHITE',       size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 65, rrp: 130, season: 'SS26' },
  { brand: 'NIKE',   name: 'DUNK LOW',     color: 'PANDA BLACK WHITE', size: '40', category: 'FOOTWEAR', gender: 'UNISEX', product: 'SNEAKERS', jsc: 60, rrp: 130, season: 'FW25' },
  { brand: 'NIKE',   name: 'AIR MAX 90',   color: 'INFRARED',    size: '43',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 70, rrp: 150, season: 'SS25' },
  { brand: 'NIKE',   name: 'AIR MAX 95',   color: 'NEON YELLOW', size: '41',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 75, rrp: 160, season: 'SS24' }, // 컬러 K=2
  { brand: 'NIKE',   name: 'BLAZER MID 77',color: 'WHITE BLACK', size: '40',  category: 'FOOTWEAR', gender: 'UNISEX',product: 'SNEAKERS', jsc: 50, rrp: 110, season: 'FW25' },
  { brand: 'NIKE',   name: 'JORDAN 1 LOW', color: 'BRED',        size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 70, rrp: 145, season: 'SS26' },
  { brand: 'NIKE',   name: 'PEGASUS 40',   color: 'BLACK',       size: '43',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 60, rrp: 140, season: 'SS25' },

  // ── NIKE APPAREL (2) ──
  { brand: 'NIKE',   name: 'TECH FLEECE HOODIE', color: 'GREY', size: 'M', category: 'APPAREL', gender: 'MEN', product: 'HOODIE', jsc: 60, rrp: 130, season: 'FW25' },
  { brand: 'NIKE',   name: 'WINDBREAKER',  color: 'BLACK',       size: 'L',   category: 'APPAREL', gender: 'MEN',   product: 'JACKET', jsc: 50, rrp: 110, season: 'SS25' },

  // ── NIKE ACCESSORY (1) ──
  { brand: 'NIKE',   name: 'BACKPACK ELITE', color: 'BLACK',     size: 'OS',  category: 'ACCESSORY', gender: 'UNISEX', product: 'BACKPACK', jsc: 30, rrp: 75, season: 'SS26' },

  // ── NEW BALANCE FOOTWEAR (8) ──
  { brand: 'NEW BALANCE', name: '990v6',   color: 'GREY',        size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 130, rrp: 280, season: 'SS26' },
  { brand: 'NEW BALANCE', name: '530',     color: 'WHITE SILVER', size: '41', category: 'FOOTWEAR', gender: 'WOMEN', product: 'SNEAKERS', jsc: 50,  rrp: 110, season: 'SS25' },
  { brand: 'NEW BALANCE', name: '574',     color: 'NAVY',        size: '40',  category: 'FOOTWEAR', gender: 'UNISEX',product: 'SNEAKERS', jsc: 45,  rrp: 100, season: 'FW24' },
  { brand: 'NEW BALANCE', name: '550',     color: 'WHITE GREEN', size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 55,  rrp: 120, season: 'SS25' },
  { brand: 'NEW BALANCE', name: '2002R',   color: 'BLACK',       size: '43',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 70,  rrp: 160, season: 'FW25' },
  { brand: 'NEW BALANCE', name: '996',     color: 'BURGUNDY',    size: '38',  category: 'FOOTWEAR', gender: 'WOMEN', product: 'SNEAKERS', jsc: 55,  rrp: 130, season: 'SS24' },
  { brand: 'NEW BALANCE', name: '327',     color: 'CAMEL',       size: '39',  category: 'FOOTWEAR', gender: 'UNISEX',product: 'SNEAKERS', jsc: 50,  rrp: 110, season: 'SS25' },
  { brand: 'NEW BALANCE', name: '9060',    color: 'CAMO PRINTED',size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 75,  rrp: 170, season: 'FW25' }, // 컬러 J=4

  // ── NEW BALANCE APPAREL/ACC (2) ──
  { brand: 'NEW BALANCE', name: 'ATHLETICS SWEATSHIRT', color: 'OATMEAL', size: 'M', category: 'APPAREL', gender: 'WOMEN', product: 'SWEATSHIRT', jsc: 35, rrp: 80, season: 'FW25' },
  { brand: 'NEW BALANCE', name: 'NB CLASSIC HAT', color: 'BLACK', size: 'OS', category: 'ACCESSORY', gender: 'UNISEX', product: 'CAP', jsc: 12, rrp: 28, season: 'SS26' },

  // ── LACOSTE (5) ──
  { brand: 'LACOSTE', name: 'L.12.12 POLO', color: 'NAVY',       size: 'L',   category: 'APPAREL',  gender: 'MEN',   product: 'POLO',  jsc: 40, rrp: 90, season: 'SS26' },
  { brand: 'LACOSTE', name: 'CARNABY EVO',  color: 'WHITE',      size: '42',  category: 'FOOTWEAR', gender: 'MEN',   product: 'SNEAKERS', jsc: 50, rrp: 110, season: 'SS25' },
  { brand: 'LACOSTE', name: 'CROC HOODIE',  color: 'GREEN',      size: 'M',   category: 'APPAREL',  gender: 'WOMEN', product: 'HOODIE', jsc: 45, rrp: 100, season: 'FW25' },
  { brand: 'LACOSTE', name: 'SPORT TEE',    color: 'WHITE NAVY', size: 'S',   category: 'APPAREL',  gender: 'WOMEN', product: 'TEE',    jsc: 25, rrp: 55, season: 'SS26' },
  { brand: 'LACOSTE', name: 'TENNIS SHORT', color: 'WHITE',      size: 'M',   category: 'APPAREL',  gender: 'MEN',   product: 'SHORTS', jsc: 28, rrp: 65, season: 'SS25' },

  // ── 기타 (10) ──
  { brand: 'BURBERRY',     name: 'CHECK SCARF',         color: 'BEIGE',         size: 'OS', category: 'ACCESSORY', gender: 'UNISEX', product: 'SCARF',    jsc: 220, rrp: 480, season: 'FW25' },
  { brand: 'ACNE STUDIOS', name: 'OVERSIZED LOGO HOODIE', color: 'STONE GREY',  size: 'L',  category: 'APPAREL',   gender: 'UNISEX', product: 'HOODIE',   jsc: 180, rrp: 380, season: 'FW25' },
  { brand: 'CARHARTT',     name: 'CHORE COAT',          color: 'BROWN',         size: 'M',  category: 'APPAREL',   gender: 'MEN',    product: 'JACKET',   jsc: 95,  rrp: 200, season: 'FW25' },
  { brand: 'POLO RALPH LAUREN', name: 'CLASSIC OXFORD SHIRT', color: 'WHITE',   size: 'L',  category: 'APPAREL',   gender: 'MEN',    product: 'SHIRT',    jsc: 55,  rrp: 130, season: 'SS25' },

  // ── 엣지케이스 ──
  // [E1] 키즈 — 자동 제외 검증
  { brand: 'ADIDAS',     name: 'KIDS SAMBA',           color: 'WHITE',         size: '32', category: 'FOOTWEAR',  gender: 'KIDS',   product: 'SNEAKERS', jsc: 35,  rrp: 75,  season: 'SS26' },
  // [E2] 환율 결측 (jsc·rrp 둘 다 0)
  { brand: 'NIKE',       name: 'AIR MAX 1',            color: 'WHITE',         size: '42', category: 'FOOTWEAR',  gender: 'MEN',    product: 'SNEAKERS', jsc: 0,   rrp: 0,   season: 'SS26' },
  // [E3] 시즌 결측
  { brand: 'NEW BALANCE',name: '574 LEGACY',           color: 'GREY',          size: '40', category: 'FOOTWEAR',  gender: 'WOMEN',  product: 'SNEAKERS', jsc: 45,  rrp: 100, season: '' },
  // [E4] 컬러 멀티 (LEOPARD = J 4점)
  { brand: 'GANNI',      name: 'PRINT MAXI DRESS',     color: 'LEOPARD ANIMAL PRINT', size: 'M', category: 'APPAREL', gender: 'WOMEN', product: 'DRESS', jsc: 80, rrp: 180, season: 'SS26' },
  // [E5] 신규 브랜드 — 중심가 DB 미수록
  { brand: 'TOTEME',     name: 'CASHMERE COAT',        color: 'CAMEL',         size: 'S',  category: 'APPAREL',   gender: 'WOMEN',  product: 'COAT',     jsc: 250, rrp: 580, season: 'FW25' },
  // [E6] 신규 브랜드 — 두 번째
  { brand: 'STUDIO NICHOLSON', name: 'WIDE LEG TROUSER', color: 'NAVY',        size: 'M',  category: 'APPAREL',   gender: 'MEN',    product: 'PANTS',    jsc: 110, rrp: 240, season: 'FW25' }
];

// ── 검증: 카테고리·브랜드 분포 + 엣지 카운트 ──
const stats = {
  total: SKUS.length,
  byCategory: {},
  byBrand: {},
  edgeCases: []
};
for (const s of SKUS) {
  stats.byCategory[s.category] = (stats.byCategory[s.category] || 0) + 1;
  stats.byBrand[s.brand] = (stats.byBrand[s.brand] || 0) + 1;
  if (s.gender === 'KIDS') stats.edgeCases.push('KIDS:' + s.name);
  if (!s.jsc || !s.rrp) stats.edgeCases.push('PRICE_MISSING:' + s.name);
  if (!s.season) stats.edgeCases.push('SEASON_MISSING:' + s.name);
  if ((s.color || '').match(/PRINT|FLORAL|LEOPARD|CAMO/)) stats.edgeCases.push('COLOR_MULTI:' + s.name);
}

if (SKUS.length !== 50) {
  console.error('❌ SKU count != 50:', SKUS.length);
  process.exit(1);
}

// ── 베이스라인 산출 ──
const baseline = SKUS.map((sku) => {
  const score = calcScore(sku, sku.brand);
  const label = gradeLabel(score.total);
  const cls = gradeCls(score.total);
  return {
    input: sku,
    expected: { ...score, label, cls }
  };
});

writeFileSync(OUT, JSON.stringify({
  _meta: {
    schema_version: '1.0',
    generated_at: new Date().toISOString().slice(0, 10),
    oracle: '_oracle/v12-functions.mjs',
    count: SKUS.length,
    coverage: stats
  },
  baseline
}, null, 2) + '\n', 'utf8');

console.log('✓ test/v12-baseline.json');
console.log(`  총 ${SKUS.length}건 (FOOTWEAR ${stats.byCategory.FOOTWEAR}, APPAREL ${stats.byCategory.APPAREL}, ACCESSORY ${stats.byCategory.ACCESSORY})`);
console.log('  엣지케이스:');
for (const e of stats.edgeCases) console.log('    ·', e);

// 등급 분포 요약
const gradeDist = {};
for (const b of baseline) {
  gradeDist[b.expected.label] = (gradeDist[b.expected.label] || 0) + 1;
}
console.log('  등급 분포:', gradeDist);
