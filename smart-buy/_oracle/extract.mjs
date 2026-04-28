// v12 HTML에서 12종 데이터 자산 + 순수 함수를 자동 추출.
// 실행: node smart-buy/_oracle/extract.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, '_archive/v12-original.html');
const DATA = resolve(ROOT, 'data');
const html = readFileSync(SRC, 'utf8');
const lines = html.split(/\r?\n/);

// ───────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────
const grab = (startLine, endLine) =>
  lines.slice(startLine - 1, endLine).join('\n'); // 1-indexed inclusive

const writeJSON = (name, obj, meta) => {
  const out = { _meta: meta, ...obj };
  writeFileSync(
    resolve(DATA, name),
    JSON.stringify(out, null, 2) + '\n',
    'utf8'
  );
  console.log(`✓ data/${name}`);
};

// vm에서 데이터 블록을 평가, 지정된 변수 반환
const evalBlock = (code, expectedNames, helpers = '') => {
  const ctx = { console };
  vm.createContext(ctx);
  const wrapped = `${helpers}\n${code}\n;__out__ = { ${expectedNames.join(', ')} };`;
  vm.runInContext(wrapped, ctx);
  return ctx.__out__;
};

const EU_RANGE_HELPER = `
function euRange(min, max) {
  const r = [];
  for (let v = min * 2; v <= max * 2; v++) r.push(v / 2);
  return r;
}
`;

// ───────────────────────────────────────────────────────
// (1) BRAND_SIZE_DB  v12 lines 764-870
// ───────────────────────────────────────────────────────
{
  const code = grab(764, 870);
  const { BRAND_SIZE_DB } = evalBlock(code, ['BRAND_SIZE_DB'], EU_RANGE_HELPER);
  writeJSON('brand-size-db.json',
    { brands: BRAND_SIZE_DB },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '764-870',
      note: 'euRange()로 산출된 사이즈 배열은 평가 후 정적 배열로 보존',
      brand_match_function: "getSizeDB(brand) — 입력 브랜드명에 'ADIDAS'/'NIKE'/'LACOSTE'/'NEW BALANCE' 포함 여부로 자동 분기, 미매칭 시 ADIDAS 기본값"
    }
  );
}

// ───────────────────────────────────────────────────────
// (2) CENTER_PRICE_DB  v12 line 886
// ───────────────────────────────────────────────────────
{
  const code = grab(886, 886);
  const { CENTER_PRICE_DB } = evalBlock(code, ['CENTER_PRICE_DB']);
  writeJSON('center-price-db.json',
    { brands: CENTER_PRICE_DB },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '886',
      origin_xlsx: 'NC_PICKS_중심가격분석_260420.xlsx',
      basis: '25SS·25FW 실매출 50% 도달 중심가 (원)',
      key_strategy: '한국명/영문명 양쪽 키 보존 (예: "아디다스"+"ADIDAS")',
      categories: ['이노베이션','남성_OPR','여성_OPR','스포츠_OPR','제화_OPR','아동_OPR','잡화_OPR','명품_OPR','기타_OPR','스포츠(직매입 대리점)','아동(직매입 대리점1)']
    }
  );
}

// ───────────────────────────────────────────────────────
// (3) OFFER_TO_MC_MAP  v12 lines 897-957
// ───────────────────────────────────────────────────────
{
  const code = grab(897, 957);
  const { OFFER_TO_MC_MAP } = evalBlock(code, ['OFFER_TO_MC_MAP']);
  writeJSON('offer-mc-map.json',
    { entries: OFFER_TO_MC_MAP },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '897-957',
      key_format: 'CATEGORY|GENDER|PRODUCT_TYPE (영문 오퍼 기준, 빈 product도 fallback 키)',
      example: '"FOOTWEAR|MEN|SNEAKERS" → "남성_잡화_운동화"'
    }
  );
}

// ───────────────────────────────────────────────────────
// (4) BRAND_TIER_DB  v12 lines 1072-1153
// ───────────────────────────────────────────────────────
{
  const code = grab(1072, 1153);
  const { BRAND_TIER_DB } = evalBlock(code, ['BRAND_TIER_DB']);
  writeJSON('brand-score-rules.json',
    {
      brand_tier_db: BRAND_TIER_DB,
      model_tier: {
        ADIDAS: [
          { score: 30, models: ['SAMBA', 'GAZELLE'] },
          { score: 26, models: ['CAMPUS', 'HANDBALL', 'SPEZIAL'] },
          { score: 24, sports: ['ORIGINALS'] },
          { score: 22, models: ['SUPERSTAR', 'STAN SMITH'] },
          { score: 20, models: ['ULTRABOOST', 'NMD'] },
          { score: 18, default: true },
          { score: 16, sports: ['RUNNING'] },
          { score: 14, sports: ['TRAINING'] },
          { score: 8,  sports: ['FOOTBALL', 'SOCCER'] }
        ],
        NIKE: [
          { score: 28, models: ['DUNK', 'AIR FORCE', 'AIR MAX 1'] },
          { score: 26, models: ['AIR MAX 90', 'AIR MAX 95', 'BLAZER'] },
          { score: 24, models: ['AIR MAX', 'JORDAN'] },
          { score: 20, default: true },
          { score: 18, models: ['FREE', 'REACT', 'PEGASUS'] }
        ],
        'NEW BALANCE': [
          { score: 30, models: ['990', '530', '574'] },
          { score: 28, models: ['2002', '550', '1906'] },
          { score: 26, models: ['996', '327', '9060'] },
          { score: 22, default: true }
        ]
      },
      defaults_when_unmatched: { FOOTWEAR: 18, APPAREL: 14, OTHER: 12 },
      cap: { min: 4, max: 30 }
    },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '1072-1153 (BRAND_TIER_DB) + 1182-1231 (sBrand body)',
      note: 'Tier S=30, A=22~28, B=14~20, C=4~12. ADIDAS/NIKE/NEW BALANCE 모델 Tier 별도 적용'
    }
  );
}

// ───────────────────────────────────────────────────────
// (5) MODEL_KEYWORD_RULES  v12 lines 1377-1424
// ───────────────────────────────────────────────────────
{
  const code = grab(1377, 1424);
  const { MODEL_KEYWORD_RULES } = evalBlock(code, ['MODEL_KEYWORD_RULES']);
  writeJSON('model-keyword-rules.json',
    {
      cap: { min: -6, max: 6 },
      match_mode: 'first_keyword_per_rule',
      rules: MODEL_KEYWORD_RULES
    },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '1377-1424',
      cap_note: '룰별 첫 매칭 키워드 1개만 카운트, 총합 -6~+6 캡',
      kids_handling: '키즈는 calcScore 첫 분기에서 총점 0 처리 (별도 키워드 룰 없음)'
    }
  );
}

// ───────────────────────────────────────────────────────
// (6) COLOR_TREND_RULES (sColor 함수 → 선언적 변환)
//     v12 lines 1238-1340
// ───────────────────────────────────────────────────────
{
  // sColor는 함수형 분기 — 12등급 K~S를 선언적 데이터로 재구성
  const tiers = [
    {
      grade: 'S', score: 20, label: '블랙 단색',
      keywords: ['BLACK', 'CBLACK', 'CORE BLACK', 'TRIPLE BLACK', 'ONYX'],
      exclusion: 'WHITE/GREY/BROWN/GREEN/RED/BLUE/NAVY/BURGUNDY 미포함',
      basis: '시즌 무관 최상 — NC OPR 소진율 최상'
    },
    {
      grade: 'S', score: 20, label: '화이트·크림 단색',
      keywords: ['WHITE', 'CWHITE', 'CHALK', 'CLOUD', 'CREAM', 'IVORY', 'OFF WHITE', 'OFFWHITE', 'LINEN', 'SAND'],
      exclusion: 'BLACK/GREY/그 외 컬러 미포함',
      basis: '무신사 에어포스1 화이트 2025 1위(55,600켤레)'
    },
    {
      grade: 'A', score: 18, label: '블랙+화이트 조합',
      keywords: ['BLACK+WHITE'],
      basis: '클래식 듀얼톤'
    },
    {
      grade: 'A', score: 18, label: '화이트+(NAVY/GREEN/BLUE/BROWN/GUM/RED)',
      keywords: ['WHITE+NAVY', 'WHITE+GREEN', 'WHITE+BLUE', 'WHITE+BROWN', 'WHITE+GUM', 'WHITE+RED'],
      basis: 'SHADOW NAVY/IVORY/GUM 등'
    },
    {
      grade: 'B', score: 16, label: '베이지·뉴트럴 (모카무스 트렌드)',
      keywords: ['BEIGE', 'CAMEL', 'TAN', 'MOCHA', 'LATTE', 'SAND', 'OATMEAL', 'NATURAL', 'NUDE', 'BONE', 'ECRU', 'WHEAT', 'CREAM', 'IVORY', 'OFF WHITE', 'OFFWHITE'],
      exclusion: 'BLACK 미포함 시',
      basis: '2025 트렌드컬러 모카무스 + 베이지 수요 폭발'
    },
    {
      grade: 'C', score: 14, label: '그레이 계열',
      keywords: ['GREY', 'GRAY', 'SILVER', 'MELANGE', 'HEATHER', 'MARL', 'CHARCOAL', 'CONCRETE']
    },
    {
      grade: 'D', score: 13, label: '어스톤·그린',
      keywords: ['GREEN', 'OLIVE', 'KHAKI', 'SAGE', 'FOREST', 'HUNTER', 'MOSS', 'FERN', 'EARTH', 'MILITARY', 'UTILITY'],
      basis: '2024-25 연속 강세, Originals 헤리티지'
    },
    {
      grade: 'D', score: 13, label: '브라운',
      keywords: ['BROWN', 'WALNUT', 'RUST', 'TERRACOTTA', 'SIENNA', 'CHOCOLATE', 'COGNAC', 'GUM', 'CARAMEL']
    },
    {
      grade: 'E', score: 12, label: '네이비',
      keywords: ['NAVY', 'MIDNIGHT', 'DARK BLUE', 'DARKBLUE']
    },
    {
      grade: 'F', score: 11, label: '버건디·와인',
      keywords: ['BURGUNDY', 'WINE', 'BORDEAUX', 'MAROON', 'OXBLOOD']
    },
    {
      grade: 'F', score: 11, label: '레드',
      keywords: ['RED', 'SCARLET', 'CRIMSON']
    },
    {
      grade: 'G', score: 10, label: '블루 계열',
      keywords: ['BLUE', 'INDIGO', 'COBALT', 'TEAL', 'SKY', 'DENIM', 'AZURE', 'SAPPHIRE'],
      basis: '데님 수요 + 2026 틸 상승 예고'
    },
    {
      grade: 'H', score: 8, label: '파스텔·기타',
      keywords: ['PINK', 'ROSE', 'BLUSH', 'LAVENDER', 'LILAC', 'VIOLET', 'MAUVE', 'PEACH', 'MINT', 'CORAL', 'LIGHT', 'PALE', 'PASTEL', 'YELLOW', 'ORANGE', 'PURPLE']
    },
    {
      grade: 'I', score: 6, label: '비비드 단색',
      keywords: ['BRIGHT YELLOW', 'VIVID YELLOW', 'SIGNAL ORANGE', 'VIVID ORANGE', 'VIVID RED', 'CYAN', 'ELECTRIC BLUE', 'VIVID PURPLE']
    },
    {
      grade: 'J', score: 4, label: '멀티/AOP/프린트',
      keywords: ['AOP', 'ALLOVER', 'ALL OVER', 'MULTICOLOR', 'MULTI COLOR', 'PRINTED', 'FLORAL', 'CAMO', 'CAMOUFLAGE', 'LEOPARD', 'ANIMAL PRINT', 'TIE DYE', 'TIEDYE']
    },
    {
      grade: 'K', score: 2, label: '네온',
      keywords: ['NEON', 'FLUORESCENT', 'HIGHLIGHTER', 'VOLT', 'LIME GREEN', 'LIME PUNCH'],
      basis: '한국 OPR 소진율 최하'
    }
  ];
  writeJSON('color-trend-rules.json',
    { default_score: 10, tiers, evaluation_order: 'K → J → I → S(black) → S(white) → A → B → C → D(green) → D(brown) → E → F(burgundy) → F(red) → G → H → default' },
    {
      schema_version: '1.0',
      source: 'v12-original.html',
      source_lines: '1238-1340 (sColor 함수)',
      basis: '무신사 결산리포트(2025.12), 2026 스카이블루, 모카무스 트렌드, 레이디경향 컬러풀 귀환',
      note: 'sColor는 분기 우선순위가 의미를 가짐 — 평가 순서를 evaluation_order에 명시'
    }
  );
}

// ───────────────────────────────────────────────────────
// (7) PRICE_RULES (sPrice)  v12 lines 1350-1363
// ───────────────────────────────────────────────────────
writeJSON('price-rules.json',
  {
    fx: {
      jsc_eur_krw: 1740,
      rrp_eur_krw: 1700,
      known_inconsistency: 'v12 C3 버그 — JSC와 RRP에 다른 환율 사용. v1.4에서 단일 환율로 통일 권장하나 v12 값 보존'
    },
    cost_multiplier: 2.0,
    target_imu: 0.65,
    landed_cost_formula: 'jsc_eur * jsc_eur_krw * cost_multiplier',
    target_price_formula: 'landed_cost / target_imu',
    discount_formula: '1 - (target_price / (rrp_eur * rrp_eur_krw))',
    discount_tiers: [
      { discount: 0.60, score: 20 },
      { discount: 0.50, score: 17 },
      { discount: 0.40, score: 13 },
      { discount: 0.30, score: 9 },
      { discount: 0.20, score: 5 }
    ],
    fallback_score: 3,
    missing_data_score: 5
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '1350-1363 (sPrice)',
    note: 'JSC/RRP 결측 시 5점, 할인율 ≥ tier.discount 첫 만족 → tier.score, 모두 미만 → 3점'
  }
);

// ───────────────────────────────────────────────────────
// (8) SEASON_RULES (sSeason)  v12 lines 1365-1372
// ───────────────────────────────────────────────────────
writeJSON('season-rules.json',
  {
    tiers: [
      { score: 10, season_codes: ['S26', 'F26', 'SS26', 'FW26'] },
      { score: 8,  season_codes: ['S25', 'F25', 'SS25', 'FW25'] },
      { score: 5,  season_codes: ['S24', 'F24', 'SS24', 'FW24'] },
      { score: 2,  season_codes: ['S23', 'F23', 'SS23', 'FW23'] }
    ],
    default_score: 1,
    match_mode: 'first_substring_includes'
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '1365-1372 (sSeason)'
  }
);

// ───────────────────────────────────────────────────────
// (9) SIZE_RULES (sSize)  v12 lines 1342-1348
// ───────────────────────────────────────────────────────
writeJSON('size-rules.json',
  {
    by_category: {
      FOOTWEAR: 20,
      APPAREL: 9,
      ACCESSORY: 12,
      ACCESSORIES: 12
    },
    default_score: 10
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '1342-1348 (sSize)'
  }
);

// ───────────────────────────────────────────────────────
// (10) GRADE_LABELS (gradeLabel)  v12 lines 1463-1469
// ───────────────────────────────────────────────────────
writeJSON('grade-labels.json',
  {
    thresholds: [
      { min_score: 80, label: '최우선 매입',  cls: '80' },
      { min_score: 70, label: '적극 권장',    cls: '70' },
      { min_score: 60, label: '조건부',        cls: '60' },
      { min_score: 50, label: '신중',          cls: '50' }
    ],
    default: { label: '패스', cls: '0' }
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '1463-1477 (gradeLabel + gradeCls)'
  }
);

// ───────────────────────────────────────────────────────
// (11) KIDS_EXCLUSION  v12 lines 1442-1447
// ───────────────────────────────────────────────────────
writeJSON('kids-exclusion.json',
  {
    rule: { gender_equals: 'KIDS' },
    action: {
      brand: 0, color: 0, size: 0, price: 0, season: 0,
      total: 0,
      keywordBonus: 0,
      keywordMatched: ['키즈 매입 제외']
    },
    reason: '해외 수입 매입 대상 아님 (NC OPR 정책)'
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '1442-1447 (calcScore 첫 분기)',
    policy: 'NC OPR 키즈 직매입 대리점 운영 — 해외 수입 라인에서는 제외'
  }
);

// ───────────────────────────────────────────────────────
// (12) CATEGORY_INFERENCE (inferCat + inferGender + inferSeason)
//      v12 lines 1494-1515
// ───────────────────────────────────────────────────────
writeJSON('category-inference.json',
  {
    category: {
      FOOTWEAR:  ['SHOE', 'SNEAKER', 'BOOT', 'FOOTWEAR'],
      APPAREL:   ['TEE', 'SHIRT', 'JACKET', 'PANTS', 'HOODIE'],
      ACCESSORY: ['BAG', 'CAP', 'SOCK', 'ACCESSORY'],
      _default:  'OTHER'
    },
    gender: {
      WOMEN: ['WOMEN', 'WOMAN', 'LADIES', 'FEMALE'],
      KIDS:  ['KIDS', 'CHILD', 'INFANT', 'JUNIOR', 'JR'],
      MEN:   ['MEN', 'MENS', 'MALE'],
      _default: 'UNISEX',
      _evaluation_order: ['WOMEN', 'KIDS', 'MEN', 'UNISEX']
    },
    season: {
      regex: '(SS|FW|S|F)(2[0-9])',
      output_format: '$1$2',
      _default: 'N/A'
    },
    product_type: {
      from_inferProductType: {
        HOODIE:    ['HOODIE', 'HOOD'],
        SWEATSHIRT:['SWEATSHIRT', 'CREWNECK'],
        POLO:      ['POLO', ' PK '],
        TEE:       ['TEE', 'T-SHIRT'],
        JACKET:    ['JACKET', 'TRACK TOP', 'TRACK JACKET'],
        PUFFER:    ['PUFFER', 'DOWN', 'PARKA'],
        COAT:      ['COAT', 'TRENCH'],
        PANTS:     ['PANTS', 'TROUSERS', 'CHINO'],
        SHORTS:    ['SHORT'],
        JEANS:     ['JEANS', 'DENIM'],
        SKIRT:     ['SKIRT'],
        DRESS:     ['DRESS'],
        SHIRT:     ['SHIRT', 'OXFORD', 'FLANNEL'],
        KNIT:      ['KNIT', 'SWEATER', 'KNITWEAR'],
        VEST:      ['VEST', 'GILET'],
        SNEAKERS:  ['SAMBA', 'GAZELLE', 'SNEAKER', 'TRAINER'],
        BOOTS:     ['BOOT'],
        SLIDES:    ['SANDAL', 'SLIDE'],
        CAP:       ['CAP', 'HAT', 'BEANIE'],
        BAG:       ['BAG', 'TOTE'],
        BACKPACK:  ['BACKPACK']
      }
    }
  },
  {
    schema_version: '1.0',
    source: 'v12-original.html',
    source_lines: '997-1022 (inferProductType) + 1494-1515 (inferCat/Gender/Season)',
    note: 'inferGender 평가 순서 중요 — WOMEN → KIDS → MEN → UNISEX 순으로 첫 매치 확정'
  }
);

// ───────────────────────────────────────────────────────
// (13) CHANNELS — v1.4 §6 (v12에 없음)
// ───────────────────────────────────────────────────────
writeJSON('channels.json',
  {
    channels: [
      { id: 'OCEAN-OS',  origin: '해외', transport: '오션',      lt_months: 3.5, cost_multiplier: 1.00, fixed_cost_krw: 0 },
      { id: 'AIR-OS',    origin: '해외', transport: '에어',      lt_months: 1.0, cost_multiplier: 1.30, fixed_cost_krw: 50000, fixed_cost_unit: 'KRW/CBM' },
      { id: 'DOM-LAND',  origin: '국내', transport: '육로',      lt_months: 1.5, cost_multiplier: 1.00, fixed_cost_krw: 0 },
      { id: 'EXP-OS',    origin: '해외', transport: '익스프레스', lt_months: 0.3, cost_multiplier: 1.50, fixed_cost_krw: 0 }
    ],
    landed_cost_formula: '(FOB가 × 환율 × cost_multiplier) + fixed_cost_krw',
    air_policy: '시스템은 채널별 IMU를 표시만 함, 자동 차감 룰 없음 — MD가 보고 결정'
  },
  {
    schema_version: '1.0',
    source: 'NC_PICKS_v13_설계_v1.4.md',
    source_section: '§6 매입 채널 마스터',
    note: 'v12 HTML에는 없음. v13 설계 문서에서 신규 도입'
  }
);

console.log('---');
console.log('Phase 1 데이터 추출 완료. 13개 JSON 파일 생성.');
