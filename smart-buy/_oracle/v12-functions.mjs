// v12 순수 함수 모듈 — 회귀 테스트 oracle 용도.
// v12 HTML(line 700~1515)의 DOM 비의존 함수들만 추출하여 ES module로 재구성.
// STATE.brand 의존하던 sBrand는 brand 파라미터를 명시적으로 받도록 리팩터.

// ── 사이즈 헬퍼 ─────────────────────────────────────────────────────
export function euRange(min, max) {
  const r = [];
  for (let v = min * 2; v <= max * 2; v++) r.push(v / 2);
  return r;
}

// ── BRAND_SIZE_DB (4 brands) ────────────────────────────────────────
export const BRAND_SIZE_DB = {
  ADIDAS: {
    shoesNote: '아디다스는 일반적으로 평소 사이즈 착용 권장. 삼바/가젤 등 오리지널은 한 사이즈 업 추천 (크림·무신사 실착 데이터 기준)',
    fit: 'normal',
    womenMain: euRange(36, 39), womenEdge: [35.5, 39.5, 40],
    menMain: euRange(40, 44), menEdge: [39, 39.5, 44.5, 45]
  },
  NIKE: {
    shoesNote: '나이키는 발볼이 좁은 편. D등급 이상 발볼에는 0.5 업 추천. 에어맥스 계열은 TTS.',
    fit: 'normal',
    womenMain: euRange(36, 39), womenEdge: [35.5, 39.5, 40],
    menMain: euRange(40, 44), menEdge: [39, 39.5, 44.5, 45]
  },
  LACOSTE: {
    shoesNote: '라코스테 슈즈는 유럽 브랜드 특성상 TTS. 어패럴은 유럽 핏으로 타이트할 수 있어 한 사이즈 업 고려.',
    fit: 'normal',
    womenMain: euRange(36, 39), womenEdge: [35.5, 39.5, 40],
    menMain: euRange(40, 44), menEdge: [39, 39.5, 44.5, 45]
  },
  'NEW BALANCE': {
    shoesNote: '뉴발란스는 발볼 넓은 편(2E). 990/574 시리즈는 TTS 또는 0.5 다운. 한국 소비자 선호도 높음.',
    fit: 'runs_large',
    womenMain: euRange(35.5, 38.5), womenEdge: [35, 39, 39.5],
    menMain: euRange(39.5, 43.5), menEdge: [39, 44, 44.5]
  }
};

export function getSizeDB(brand) {
  const b = (brand || '').toUpperCase();
  if (b.includes('ADIDAS')) return BRAND_SIZE_DB.ADIDAS;
  if (b.includes('NIKE')) return BRAND_SIZE_DB.NIKE;
  if (b.includes('LACOSTE')) return BRAND_SIZE_DB.LACOSTE;
  if (b.includes('NEW BALANCE') || b.includes('NEWBALANCE')) return BRAND_SIZE_DB['NEW BALANCE'];
  return BRAND_SIZE_DB.ADIDAS;
}

// ── BRAND_TIER_DB (v12 line 1072) ───────────────────────────────────
export const BRAND_TIER_DB = {
  "BURBERRY":30,"MAXMARA":30,"MAX MARA":30,"THOM BROWNE":30,"TOMBROUN":30,
  "ACNE STUDIOS":28,"ACNESTUDIOS":28,"AMI":28,"AMI PARIS":28,
  "MAISON KITSUNE":28,"MAISONKITSUNE":28,"ME종키츠네":28,
  "NEW BALANCE":28,"NEWBALANCE":28,"뉴발란스":28,
  "POLO RALPH LAUREN":28,"POLO":28,"RALPH LAUREN":28,"폴로랄프로렌":28,
  "BIRKENSTOCK":28,"버켄스탁":28,
  "ZARA":28,"자라":28,
  "DISNEY":24,"DISNEY CHARACTER":24,"디즈니":24,
  "TOMMY HILFIGER":26,"TOMMYHILFIGER":26,
  "CALVIN KLEIN":22,"CALVINKLEIN":22,"캘빈클라인":22,"캘빈 클라인":22,
  "LEMAIRE":24,"르메르":24,
  "SANDRO":24,"산드로":24,
  "MAJE":24,"마쥬":24,
  "APC":24,"아페쎄":24,"A.P.C":24,
  "GANNI":22,"가니":22,
  "KENZO":22,"겐조":22,
  "ISABEL MARANT":22,"ISABELMARANT":22,"이자벨마랑":22,
  "SELF PORTRAIT":22,"SELFPORTRAIT":22,"셀프포트레이트":22,
  "CP COMPANY":22,"CPCOMPANY":22,"씨피컴퍼니":22,"CP컴퍼니":22,
  "CHAMPION":22,"챔피온":22,
  "CARHARTT":22,"칼하트":22,
  "PUMA":20,"푸마":20,
  "OAKLEY":20,"오클리":20,
  "MASSIMO DUTTI":22,"MASSIMODUTTI":22,"마시모두띠":22,
  "HAZZYS":22,"헤지스":22,
  "DAKS":20,"닥스":20,
  "MAESTRO":20,"마에스트로":20,
  "JILL STUART":20,"JILLSTUART":20,"질스튜어트":20,
  "PARTIMENTO":22,"파르티멘토":22,
  "VIVA STUDIO":20,"VIVASTUDIO":20,"비바스튜디오":20,
  "CARROTS":20,"캐롯츠":20,
  "LOUISE MISHA":18,"루이스미샤":18,
  "LACOSTE":22,"라코스테":22,
  "NIKE":26,"나이키":26,
  "ADIDAS":24,"아디다스":24,
  "ALLEGRI":16,"알레그리":16,
  "VANESSA BRUNO":18,"바네사브루노":18,
  "CLAUDIE PIERLOT":16,"끌로디피에로":16,
  "ASPESI":16,"아스페시":16,
  "COLMAR":16,"콜마르":16,
  "K-WAY":16,"KWAY":16,"케이웨이":16,
  "EDDIE BAUER":16,"EDDIEBAUER":16,"에디바우어":16,
  "HAVAIANAS":16,"하바이아나스":16,
  "FITFLOP":14,"핏플랍":14,
  "LAFUMA":14,"라푸마":14,
  "AGATHA":14,"아가타":14,
  "JILSTUART":16,"질바이질스튜어트":16,
  "ATCORNER":16,"ATCONRNER":16,"앳코너":16,
  "ILCORSO":16,"일꼬르소":16,
  "TNGT":14,"티엔지티":14,
  "CAMBRIDGE":14,"캠브리지":14,
  "BLUDOG":16,"블루독":16,"BLUE DOG":16,
  "BLUEDOG":16,
  "PHANCT":14,"팬콧":14,
  "HAPPYBUS":14,"해피버스":14,"헤피버스":14,
  "ATHE":12,"아떼":12,
  "OUTDOOR PRODUCTS":12,"OUTDOORPRODUCTS":12,"아웃도어 프로덕츠":12,
  "N.21":14,"NUMERO21":14,"넘버21":14,
  "REPOSE AMS":14,"리포즈암스":14,
  "WEEKEND HOUSE":14,"WEEKENDHOUSEKIDS":14,"위켄드하우스":14,
  "IL GUFO":14,"ILGUFO":14,"일구포":14,
  "PHYPS":14,"핍즈":14,
  "FATALISM":14,"페이탈리즘":14,
  "DOCKERS":12,"다커스":12,
  "USPA":10,"유에스폴로":10,
  "SPADECLUB":10,"스페이드클럽":10,
  "ARMORLUX":8,"아머럭스":8,
  "CNN":8,"씨엔엔":8,
  "MICHIGAN":8,"미시간":8,
  "KONZERT":4,"콘체르트":4,
  "SPATI":4,"슈페티":4,
  "GARMENTLABLE":4,"가먼트레이블":4
};

export function normBrand(str) {
  return (str || '').toUpperCase()
    .replace(/[()\[\],.\-_]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function getBrandScore(brandName) {
  const candidates = [
    normBrand(brandName),
    normBrand((brandName || '').split(/[(_]/)[0]),
    normBrand((brandName || '').replace(/\(.*?\)/g, ''))
  ];
  for (const c of candidates) {
    if (BRAND_TIER_DB[c] !== undefined) return BRAND_TIER_DB[c];
    for (const key of Object.keys(BRAND_TIER_DB)) {
      if (c.includes(key) || key.includes(c)) return BRAND_TIER_DB[key];
    }
  }
  return null;
}

// ── sBrand (refactored: brand 파라미터 명시) ────────────────────────
export function sBrand(r, brand) {
  let baseScore = getBrandScore(brand);
  const b = normBrand(brand);
  if (b.includes('ADIDAS')) {
    const name = (r.name || '').toUpperCase();
    const sports = (r.sports || '').toUpperCase();
    if (name.includes('SAMBA') || name.includes('GAZELLE')) baseScore = 30;
    else if (name.includes('CAMPUS')) baseScore = 26;
    else if (name.includes('HANDBALL') || name.includes('SPEZIAL')) baseScore = 26;
    else if (sports === 'ORIGINALS') baseScore = 24;
    else if (name.includes('SUPERSTAR') || name.includes('STAN SMITH')) baseScore = 22;
    else if (name.includes('ULTRABOOST') || name.includes('NMD')) baseScore = 20;
    else if (sports === 'RUNNING') baseScore = 16;
    else if (sports === 'TRAINING') baseScore = 14;
    else if (sports === 'FOOTBALL' || sports === 'SOCCER') baseScore = 8;
    else baseScore = 18;
  }
  if (b.includes('NIKE')) {
    const name = (r.name || '').toUpperCase();
    if (name.includes('DUNK') || name.includes('AIR FORCE') || name.includes('AIR MAX 1')) baseScore = 28;
    else if (name.includes('AIR MAX 90') || name.includes('AIR MAX 95') || name.includes('BLAZER')) baseScore = 26;
    else if (name.includes('AIR MAX') || name.includes('JORDAN')) baseScore = 24;
    else if (name.includes('FREE') || name.includes('REACT') || name.includes('PEGASUS')) baseScore = 18;
    else baseScore = 20;
  }
  if (b.includes('NEW BALANCE') || b.includes('NEWBALANCE') || b.includes('뉴발란스')) {
    const name = (r.name || '').toUpperCase();
    if (name.includes('990') || name.includes('530') || name.includes('574')) baseScore = 30;
    else if (name.includes('2002') || name.includes('550') || name.includes('1906')) baseScore = 28;
    else if (name.includes('996') || name.includes('327') || name.includes('9060')) baseScore = 26;
    else baseScore = 22;
  }
  if (baseScore === null) {
    const cat = (r.category || '').toUpperCase();
    if (cat === 'FOOTWEAR') baseScore = 18;
    else if (cat === 'APPAREL') baseScore = 14;
    else baseScore = 12;
  }
  return Math.round(Math.min(30, Math.max(4, baseScore)));
}

// ── sColor (v12 line 1238) ──────────────────────────────────────────
export function sColor(r) {
  const c = (r.color || '').toUpperCase();
  if (c.includes('NEON') || c.includes('FLUORESCENT')
   || c.includes('HIGHLIGHTER') || c.includes('VOLT')
   || (c.includes('LIME') && (c.includes('GREEN') || c.includes('PUNCH')))) return 2;

  if (c.includes('AOP') || c.includes('ALLOVER') || c.includes('ALL OVER')
   || c.includes('MULTICOLOR') || c.includes('MULTI COLOR')
   || c.includes('PRINTED') || c.includes('FLORAL')
   || c.includes('CAMO') || c.includes('CAMOUFLAGE')
   || c.includes('LEOPARD') || c.includes('ANIMAL PRINT')
   || c.includes('TIE DYE') || c.includes('TIEDYE')) return 4;

  if (c.includes('BRIGHT YELLOW') || c.includes('VIVID YELLOW')
   || c.includes('SIGNAL ORANGE') || c.includes('VIVID ORANGE')
   || c.includes('VIVID RED') || c.includes('CYAN')
   || c.includes('ELECTRIC BLUE') || c.includes('VIVID PURPLE')) return 6;

  const hasBlack = c.includes('BLACK') || c.includes('CBLACK') || c === 'CORE BLACK' || c.includes('TRIPLE BLACK') || c.includes('ONYX');
  const hasWhite = c.includes('WHITE') || c.includes('CWHITE') || c.includes('CHALK') || c.includes('CLOUD') || c.includes('CREAM') || c.includes('IVORY') || c.includes('OFF WHITE') || c.includes('OFFWHITE');
  const hasGrey  = c.includes('GREY') || c.includes('GRAY');

  if (hasBlack && !hasWhite && !hasGrey
   && !c.includes('BROWN') && !c.includes('GREEN')
   && !c.includes('RED') && !c.includes('BLUE')
   && !c.includes('NAVY') && !c.includes('BURGUNDY')) return 20;

  if ((hasWhite || c.includes('CHALK') || c.includes('LINEN') || c.includes('SAND') || c.includes('IVORY'))
   && !hasBlack && !hasGrey
   && !c.includes('BROWN') && !c.includes('GREEN')
   && !c.includes('RED') && !c.includes('BLUE')
   && !c.includes('NAVY') && !c.includes('PINK')
   && !c.includes('BURGUNDY') && !c.includes('WINE')
   && !c.includes('MAROON') && !c.includes('ORANGE')
   && !c.includes('CORAL') && !c.includes('RUST')
   && !c.includes('TAN') && !c.includes('CAMEL')
   && !c.includes('BEIGE') && !c.includes('MOCHA')) return 20;

  if (hasBlack && hasWhite) return 18;
  if (hasWhite && (c.includes('NAVY') || c.includes('GREEN') || c.includes('BLUE')
   || c.includes('BROWN') || c.includes('GUM') || c.includes('RED'))) return 18;

  if (c.includes('BEIGE') || c.includes('CAMEL') || c.includes('TAN')
   || c.includes('MOCHA') || c.includes('LATTE') || c.includes('SAND')
   || c.includes('OATMEAL') || c.includes('NATURAL') || c.includes('NUDE')
   || c.includes('BONE') || c.includes('ECRU') || c.includes('WHEAT')
   || (c.includes('CREAM') && !hasBlack)
   || (c.includes('IVORY') && !hasBlack)
   || (c.includes('OFF WHITE') && !hasBlack)
   || (c.includes('OFFWHITE') && !hasBlack)) return 16;

  if (hasGrey || c.includes('SILVER') || c.includes('MELANGE')
   || c.includes('HEATHER') || c.includes('MARL')
   || c.includes('CHARCOAL') || c.includes('CONCRETE')) return 14;

  if (c.includes('GREEN') || c.includes('OLIVE') || c.includes('KHAKI')
   || c.includes('SAGE') || c.includes('FOREST') || c.includes('HUNTER')
   || c.includes('MOSS') || c.includes('FERN') || c.includes('EARTH')
   || c.includes('MILITARY') || c.includes('UTILITY')) return 13;

  if (c.includes('BROWN') || c.includes('WALNUT') || c.includes('RUST')
   || c.includes('TERRACOTTA') || c.includes('SIENNA') || c.includes('CHOCOLATE')
   || c.includes('COGNAC') || c.includes('GUM') || c.includes('CARAMEL')) return 13;

  if (c.includes('NAVY') || c.includes('MIDNIGHT')
   || c.includes('DARK BLUE') || c.includes('DARKBLUE')) return 12;

  if (c.includes('BURGUNDY') || c.includes('WINE') || c.includes('BORDEAUX')
   || c.includes('MAROON') || c.includes('OXBLOOD')) return 11;
  if (c.includes('RED') || c.includes('SCARLET') || c.includes('CRIMSON')) return 11;

  if (c.includes('BLUE') || c.includes('INDIGO') || c.includes('COBALT')
   || c.includes('TEAL') || c.includes('SKY') || c.includes('DENIM')
   || c.includes('AZURE') || c.includes('SAPPHIRE')) return 10;

  if (c.includes('PINK') || c.includes('ROSE') || c.includes('BLUSH')
   || c.includes('LAVENDER') || c.includes('LILAC') || c.includes('VIOLET')
   || c.includes('MAUVE') || c.includes('PEACH') || c.includes('MINT')
   || c.includes('CORAL') || c.includes('LIGHT') || c.includes('PALE')
   || c.includes('PASTEL') || c.includes('YELLOW') || c.includes('ORANGE')
   || c.includes('PURPLE')) return 8;

  return 10;
}

// ── sSize / sPrice / sSeason ────────────────────────────────────────
export function sSize(r) {
  const cat = (r.category || '').toUpperCase();
  if (cat === 'FOOTWEAR') return 20;
  if (cat === 'APPAREL') return 9;
  if (cat === 'ACCESSORY' || cat === 'ACCESSORIES') return 12;
  return 10;
}

export function sPrice(r) {
  const jsc = parseFloat(r.jsc) || 0;
  const rrp = parseFloat(r.rrp) || 0;
  if (!jsc || !rrp) return 5;
  const landed = jsc * 1740 * 2.0;
  const target = landed / 0.65;
  const disc = 1 - (target / (rrp * 1700));
  if (disc >= 0.60) return 20;
  if (disc >= 0.50) return 17;
  if (disc >= 0.40) return 13;
  if (disc >= 0.30) return 9;
  if (disc >= 0.20) return 5;
  return 3;
}

export function sSeason(r) {
  const s = (r.season || '').toUpperCase();
  if (s.includes('S26') || s.includes('F26') || s.includes('SS26') || s.includes('FW26')) return 10;
  if (s.includes('S25') || s.includes('F25') || s.includes('SS25') || s.includes('FW25')) return 8;
  if (s.includes('S24') || s.includes('F24') || s.includes('SS24') || s.includes('FW24')) return 5;
  if (s.includes('S23') || s.includes('F23') || s.includes('SS23') || s.includes('FW23')) return 2;
  return 1;
}

// ── MODEL_KEYWORD_RULES + applyKeywordBonus ─────────────────────────
export const MODEL_KEYWORD_RULES = [
  { keywords: ['SAMBA','GAZELLE','CAMPUS','HANDBALL','SPEZIAL',
               'AIR MAX 1','AIR FORCE 1','DUNK','550','990','996','574',
               'FORUM','STAN SMITH','SUPERSTAR','SUEDE','CLASSIC LEATHER',
               'MEXICO 66','ONITSUKA'],
    delta: 5, label: '헤리티지·레트로' },
  { keywords: ['ULTRABOOST','BOOST','YEEZY'],
    delta: 4, label: 'Boost 계열' },
  { keywords: ['COLLAB','COLLABORATION','LIMITED','SPECIAL EDITION',
               'EXCLUSIVE','CAPSULE'],
    delta: 4, label: '콜라보·한정판' },
  { keywords: ['LOGO','MONOGRAM','ICONIC LOGO','HERITAGE LOGO'],
    delta: 3, label: '로고 강조' },
  { keywords: ['TRENCH','OVERCOAT','WOOL COAT','CASHMERE','DOWN JACKET',
               'PARKA','ANORAK','PUFFER','PADDED JACKET'],
    delta: 3, label: '프리미엄 아우터' },
  { keywords: ['GORE-TEX','GORETEX','GTX','VIBRAM','FLYKNIT',
               'PRIMEKNIT','REACT','AIR SOLE'],
    delta: 3, label: '기술 소재·기능성' },
  { keywords: ['ESSENTIAL','BASIC','CLASSIC','EVERYDAY','STANDARD'],
    delta: 2, label: '베이직 스테디셀러' },
  { keywords: ['DENIM','JEANS','JEAN','TRUCKER','CHORE COAT'],
    delta: 2, label: '데님' },
  { keywords: ['OVERSIZED','OVERSIZE','BOXY','RELAXED FIT','WIDE LEG'],
    delta: 2, label: '오버사이즈 트렌드' },
  { keywords: ['VINTAGE','WASHED','PIGMENT','ACID WASH','FADED'],
    delta: 2, label: '빈티지 워싱' },
  { keywords: ['SCARF','MUFFLER','TOTE','BACKPACK','BUCKET HAT',
               'BEANIE','WALLET','BELT BAG'],
    delta: 2, label: '프리미엄 잡화' },
  { keywords: ['FLEECE','POLAR FLEECE','SHERPA','HOODIE','CREWNECK',
               'SWEATSHIRT','KNITWEAR'],
    delta: 1, label: '플리스·후드·니트' },
  { keywords: ['SWIMWEAR','SWIM TRUNK','BIKINI','BOARDSHORT',
               'SURF SHORT','WETSUIT'],
    delta: -4, label: '수영복 (시즌 극한정)' },
  { keywords: ['FOOTBALL BOOT','CLEAT','RUGBY','CRICKET',
               'HOCKEY','BOOT FG','BOOT SG','BOOT AG'],
    delta: -4, label: '종목 특화 (수요 없음)' },
  { keywords: ['UNDERWEAR','BRIEF','BOXER SHORT','LINGERIE','SOCKS'],
    delta: -2, label: '언더웨어·양말' },
  { keywords: ['FORMAL','BLAZER','SUIT','TUXEDO','DRESS SHIRT'],
    delta: -2, label: '정장류 (타겟 미스매치)' },
  { keywords: ['GOLF','TOUR EDITION'],
    delta: -2, label: '골프 특화' }
];

export function applyKeywordBonus(name, product) {
  const text = ((name || '') + ' ' + (product || '')).toUpperCase();
  let total = 0;
  const matched = [];
  for (const rule of MODEL_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        total += rule.delta;
        matched.push(rule.label + '(' + (rule.delta > 0 ? '+' : '') + rule.delta + ')');
        break;
      }
    }
  }
  return { delta: Math.max(-6, Math.min(6, total)), matched };
}

// ── calcScore (refactored: brand 인자 명시) ─────────────────────────
export function calcScore(r, brand) {
  if (r.gender === 'KIDS') {
    return { brand: 0, color: 0, size: 0, price: 0, season: 0,
             total: 0, keywordBonus: 0, keywordMatched: ['키즈 매입 제외'] };
  }
  const b = sBrand(r, brand);
  const c = sColor(r);
  const sz = sSize(r);
  const p = sPrice(r);
  const s = sSeason(r);
  const kb = applyKeywordBonus(r.name, r.product);
  const bFinal = Math.max(4, Math.min(30, b + kb.delta));
  return {
    brand: bFinal, color: c, size: sz, price: p, season: s,
    total: bFinal + c + sz + p + s,
    keywordBonus: kb.delta, keywordMatched: kb.matched
  };
}

export function gradeLabel(score) {
  if (score >= 80) return '최우선 매입';
  if (score >= 70) return '적극 권장';
  if (score >= 60) return '조건부';
  if (score >= 50) return '신중';
  return '패스';
}

export function gradeCls(score) {
  if (score >= 80) return '80';
  if (score >= 70) return '70';
  if (score >= 60) return '60';
  if (score >= 50) return '50';
  return '0';
}

// ── inferCat / inferGender / inferSeason ────────────────────────────
export function inferCat(row) {
  const all = Object.values(row).join(' ').toUpperCase();
  if (all.includes('SHOE') || all.includes('SNEAKER') || all.includes('BOOT') || all.includes('FOOTWEAR')) return 'FOOTWEAR';
  if (all.includes('TEE') || all.includes('SHIRT') || all.includes('JACKET') || all.includes('PANTS') || all.includes('HOODIE')) return 'APPAREL';
  if (all.includes('BAG') || all.includes('CAP') || all.includes('SOCK') || all.includes('ACCESSORY')) return 'ACCESSORY';
  return 'OTHER';
}

export function inferGender(row) {
  const all = Object.values(row).join(' ').toUpperCase();
  if (all.includes('WOMEN') || all.includes('WOMAN') || all.includes('LADIES') || all.includes('FEMALE')) return 'WOMEN';
  if (all.includes('KIDS') || all.includes('CHILD') || all.includes('INFANT') || all.includes('JUNIOR') || all.includes('JR')) return 'KIDS';
  if (all.includes('MEN') || all.includes('MENS') || all.includes('MALE')) return 'MEN';
  return 'UNISEX';
}

export function inferSeason(row) {
  const all = Object.values(row).join(' ').toUpperCase();
  const m = all.match(/(SS|FW|S|F)(2[0-9])/);
  if (m) return m[1] + m[2];
  return 'N/A';
}

// ── inferProductType (for offerToMC) ────────────────────────────────
export function inferProductType(name, existingProd) {
  if (existingProd && existingProd.length > 1) return existingProd;
  const n = (name || '').toUpperCase();
  if (n.includes('HOODIE') || n.includes('HOOD')) return 'HOODIE';
  if (n.includes('SWEATSHIRT') || n.includes('CREWNECK')) return 'SWEATSHIRT';
  if (n.includes('POLO') || n.includes(' PK ')) return 'POLO';
  if (n.includes('TEE') || n.includes('T-SHIRT')) return 'TEE';
  if (n.includes('JACKET') || n.includes('TRACK TOP') || n.includes('TRACK JACKET')) return 'JACKET';
  if (n.includes('PUFFER') || n.includes('DOWN') || n.includes('PARKA')) return 'PUFFER';
  if (n.includes('COAT') || n.includes('TRENCH')) return 'COAT';
  if (n.includes('PANTS') || n.includes('TROUSERS') || n.includes('CHINO')) return 'PANTS';
  if (n.includes('SHORT')) return 'SHORTS';
  if (n.includes('JEANS') || n.includes('DENIM')) return 'JEANS';
  if (n.includes('SKIRT')) return 'SKIRT';
  if (n.includes('DRESS')) return 'DRESS';
  if (n.includes('SHIRT') || n.includes('OXFORD') || n.includes('FLANNEL')) return 'SHIRT';
  if (n.includes('KNIT') || n.includes('SWEATER') || n.includes('KNITWEAR')) return 'KNIT';
  if (n.includes('VEST') || n.includes('GILET')) return 'VEST';
  if (n.includes('SAMBA') || n.includes('GAZELLE') || n.includes('SNEAKER') || n.includes('TRAINER')) return 'SNEAKERS';
  if (n.includes('BOOT')) return 'BOOTS';
  if (n.includes('SANDAL') || n.includes('SLIDE')) return 'SLIDES';
  if (n.includes('CAP') || n.includes('HAT') || n.includes('BEANIE')) return 'CAP';
  if (n.includes('BAG') || n.includes('TOTE')) return 'BAG';
  if (n.includes('BACKPACK')) return 'BACKPACK';
  return existingProd || '';
}

// ── normCat ─────────────────────────────────────────────────────────
export function normCat(cat) {
  return (cat || '').replace(/[_\s]/g, '').toUpperCase();
}
