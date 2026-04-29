// 벤더별 Excel 포맷 어댑터 + 휴리스틱 자동 탐지.
//
// 두 가지 경로:
//  1. detectVendor(workbook, filename) — 알려진 벤더(KOOPLES.json 등) 매칭
//  2. autoDetectFormat(workbook, filename) — 휴리스틱으로 임의 포맷 추론
//
// applyVendor()는 둘 모두에 공통 적용. shape: wide (사이즈 컬럼 펼침) / long (SIZE 컬럼).
//
// 표준 long-format(예: sample-offer.xlsx, header row=0, 표준 컬럼명)은
// 어댑터 안 타고 app.js 기본 parseRow로 폴백.

// 벤더 설정 매니페스트 — 새 벤더 추가 시 이 배열에만 등록.
const VENDOR_FORMATS = ['KOOPLES'];

// ────────────────────────────────────────────────────────────────────
// 자동 탐지: 컬럼 동의어 사전 + 시트 우선순위 + 헤더 행 스코어링
// ────────────────────────────────────────────────────────────────────

// 필드별 헤더 정규식 — 우선순위 순서로 매칭.
// 검색은 trim + case-insensitive.
const COLUMN_SYNONYMS = {
  style: [
    /^ARTICLE\s*CODE$/i, /^FULL\s*ARTICLE$/i, /^ARTICLE$/i,
    /^STYLE$/i, /^SKU\s*ID$/i, /^SKU$/i, /^MODEL$/i,
    /^REFERENCE$/i, /^Product\s*name$/i
  ],
  color: [
    /^COLOR\s*NAME$/i, /^COLOR\s*DESCRIPTION$/i,
    /^Product\s*color$/i, /^COLOR$/i
  ],
  colorCode: [/^COLOR\s*CODE$/i, /^NRF\s*Color$/i],
  size: [/^SIZE$/i, /^Size$/i],
  category: [
    /^TYPE\s*OF\s*PRODUCT$/i, /^SUPPL\.?\s*CATEGORY$/i,
    /^CATEGORY$/i, /^Category$/i, /^FAMILY$/i, /^TYPE$/i,
    /^PRODUCT$/i, /^GROUP$/i
  ],
  productName: [
    /^DESCRIPTION$/i, /^DESCRIP$/i, /^Description$/i,
    /^description$/i, /^DESC$/i,
    /^SUPPL\.?\s*DESCRIPTION$/i, /^PRODUCT\s*NAME$/i, /^Silhouette$/i
  ],
  gender: [/^GENDER$/i, /^Gender$/i, /^Sex$/i],
  age: [/^Age$/i, /^AGE$/i],
  season: [/^SEASON$/i, /^Season$/i, /^YEAR\s*OF\s*COLLECTION$/i],
  rrp: [
    /^RRP\s*EUROS?$/i, /^RRP$/i, /^RETAIL\s*PRICE\s*\(EUR\)$/i,
    /^RETAIL\s*PRICE$/i, /^Retail$/i,                 // Nike "Retail"
    /^MSRP$/i,                                          // 미국식 retail
    /^PRICE$/i                                          // GANNI/MAJE "PRICE"
  ],
  rrpAlt: [/^Retail\s*Value$/i, /^RV$/i],              // Zetes "Retail Value"
  jsc: [
    /^JSC\s*PRICE$/i, /^JSC$/i,
    /^WHS$/i, /^Wholesale$/i, /^WHOLESALE$/i,
    /^DISC\s*COST.*$/i,                                 // CKUM "DISC COST (부산항…)"
    /^FOB$/i
  ],
  qty: [
    /^Total\s*quantity$/i, /^QTY$/i, /^UNITS$/i,
    /^Grand\s*Total$/i, /^SUM\s*of\s*QTY$/i, /^QUANTITY$/i
  ],
  brand: [/^BRAND$/i, /^BRAND_NAME$/i, /^Brand$/i],
  currency: [/^CURRENCY(_OF_RRP)?$/i, /^Currency$/i]
};

// 시트 우선순위 — 첫 매칭이 사용됨.
const SHEET_PRIORITY = [
  /^OFFER$/i,
  /^Zetes/i,
  /^Specification$/i,
  /^Edit\s*quantities$/i,
  /^HUMMEL$/i,
  /^SLEEPWEAR$/i, /^UNDERWEAR$/i,                       // CKUM
  /^Foglio\d*$/i                                         // Italian "Foglio1"
];
const SHEET_BLACKLIST = [
  /^REPORT$/i, /^SUMMARY$/i, /^EAN/i, /^SIZE\s*GUID/i,
  /^CAT$/i, /^db$/i, /^pivot$/i, /^UPC$/i, /^Blad/i,
  /^Sheet\d+$/i, /^[0-9]+$/
];

// 사이즈로 인식할 헤더 패턴 (wide format detection)
const SIZE_VALUE_PATTERN = /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|TU|ONE|OS|FREE|PETITE|TALL|REG|REGULAR|T\d+|\d{1,3}(\.\d+)?[A-Za-z]?(\/\d{1,3}[A-Za-z]?)?|\d+W\/\d+L|\d+[YR]?)$/i;

const DEFAULT_CATEGORY_MAP = {
  // 가방·소품
  BAGS: 'OTHER', BAG: 'OTHER',
  ACCESSORIES: 'ACCESSORY', ACCESSOIRES: 'ACCESSORY', ACC: 'ACCESSORY',
  ACCESSORY: 'ACCESSORY',
  JEWELRY: 'ACCESSORY', JEWELLERY: 'ACCESSORY',
  WALLET: 'OTHER', WALLETS: 'OTHER',
  BELT: 'ACCESSORY', BELTS: 'ACCESSORY',
  HAT: 'ACCESSORY', CAP: 'ACCESSORY',
  // 신발
  FOOTWEAR: 'FOOTWEAR', SHOES: 'FOOTWEAR', SHOE: 'FOOTWEAR',
  SNEAKER: 'FOOTWEAR', SNEAKERS: 'FOOTWEAR',
  BOOTS: 'FOOTWEAR', SANDAL: 'FOOTWEAR', SANDALS: 'FOOTWEAR',
  // 의류
  'READY-TO-WEAR': 'APPAREL', RTW: 'APPAREL',
  APPAREL: 'APPAREL', CLOTHING: 'APPAREL',
  TEX: 'APPAREL', TEXTILE: 'APPAREL',
  POLO: 'APPAREL', POLOS: 'APPAREL',
  TOP: 'APPAREL', TOPS: 'APPAREL', BOTTOM: 'APPAREL', BOTTOMS: 'APPAREL',
  OUTER: 'APPAREL', OUTERS: 'APPAREL', OUTERWEAR: 'APPAREL',
  DRESS: 'APPAREL', DRESSES: 'APPAREL',
  PANTS: 'APPAREL', SHIRT: 'APPAREL', SHIRTS: 'APPAREL',
  TSHIRT: 'APPAREL', 'T-SHIRT': 'APPAREL',
  JEAN: 'APPAREL', JEANS: 'APPAREL',
  KNITWEAR: 'APPAREL', KNIT: 'APPAREL',
  JACKET: 'APPAREL', COAT: 'APPAREL',
  SLEEPWEAR: 'APPAREL', UNDERWEAR: 'APPAREL',
  SWIMWEAR: 'APPAREL', SWIM: 'APPAREL', SWM: 'APPAREL',
  JERSEY: 'APPAREL', SUIT: 'APPAREL', SUITS: 'APPAREL',
  BLAZER: 'APPAREL', BLAZERS: 'APPAREL',
  // 홈 / 기타
  HOME: 'OTHER', LIFESTYLE: 'OTHER'
};
const DEFAULT_GENDER_MAP = {
  MEN: 'MEN', MAN: 'MEN', MALE: 'MEN',
  WOMEN: 'WOMEN', WOMAN: 'WOMEN', FEMALE: 'WOMEN', WMN: 'WOMEN',
  UNISEX: 'UNISEX', UNI: 'UNISEX', U: 'UNISEX',
  KIDS: 'KIDS', KID: 'KIDS', CHILD: 'KIDS', CHILDREN: 'KIDS',
  GIRL: 'KIDS', GIRLS: 'KIDS', BOY: 'KIDS', BOYS: 'KIDS',
  ADULT: 'UNISEX',
  // 이탈리아어
  DONNA: 'WOMEN', UOMO: 'MEN', BAMBINO: 'KIDS', BAMBINA: 'KIDS'
};

let _vendorCache = null;

// ────────────────────────────────────────────────────────────────────
// 휴리스틱 자동 탐지 (벤더 설정 없는 신규 파일)
// ────────────────────────────────────────────────────────────────────

function pickSheet(names) {
  for (const re of SHEET_PRIORITY) {
    const m = names.find(n => re.test(n));
    if (m) return m;
  }
  return names.find(n => !SHEET_BLACKLIST.some(re => re.test(n))) || names[0];
}

function findHeaderRow(rows, maxScan = 15) {
  let best = { row: 0, score: 0 };
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const r = rows[i] || [];
    let score = 0;
    for (const v of r) {
      if (typeof v !== 'string') continue;
      const s = v.trim();
      if (!s) continue;
      for (const patterns of Object.values(COLUMN_SYNONYMS)) {
        if (patterns.some(p => p.test(s))) { score++; break; }
      }
    }
    if (score > best.score) best = { row: i, score };
  }
  return best.score >= 3 ? best.row : 0; // 최소 3개 매칭 필요
}

function mapColumns(headers) {
  const cols = {};
  for (const [field, patterns] of Object.entries(COLUMN_SYNONYMS)) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (!h) continue;
      if (patterns.some(p => p.test(h))) {
        if (!(field in cols)) cols[field] = h; // 첫 매칭만 (우선순위)
        break;
      }
    }
  }
  // rrp가 없고 rrpAlt(Retail Value)만 있으면 그걸 rrp로
  if (!cols.rrp && cols.rrpAlt) cols.rrp = cols.rrpAlt;
  return cols;
}

function detectShape(headers, columns) {
  if (columns.size) return { shape: 'long' };
  // 사이즈 같은 헤더의 연속된 run 찾기
  let runStart = -1, runEnd = -1, currentStart = -1, maxRun = 0, currentRun = 0;
  for (let i = 0; i < headers.length; i++) {
    const v = String(headers[i] ?? '').trim();
    if (v && SIZE_VALUE_PATTERN.test(v)) {
      if (currentRun === 0) currentStart = i;
      currentRun++;
      if (currentRun > maxRun) { maxRun = currentRun; runStart = currentStart; runEnd = i; }
    } else {
      currentRun = 0;
    }
  }
  if (maxRun >= 3) return { shape: 'wide', sizeStart: runStart, sizeEnd: runEnd, sizeRun: maxRun };
  return { shape: 'long' }; // 사이즈 미상 (단건처럼 처리)
}

// 파일명/시트명에서 브랜드로 보이지 않는 흔한 단어 제외
const BRAND_STOPWORDS = new Set([
  'NEW', 'OLD', 'STOCK', 'ATS', 'PRE', 'ORDER', 'PREMIUM', 'OFFER', 'AVL',
  'ALL', 'WOMEN', 'MEN', 'KIDS', 'FW', 'SS', 'SP', 'AW', 'YS',
  'MEETING', 'TABS', 'TAB', 'PARIS', 'COPY', 'FINAL', 'DRAFT', 'AND',
  'PRO', 'LIST', 'ATT', 'SET', 'DRC', 'OUT', 'IN', 'BY', 'AVL', 'EXT',
  'SLEEPWEAR', 'UNDERWEAR', 'FOOTWEAR', 'APPAREL',
  'OFFICE', 'PHOTO', 'IMAGE', 'IMG',
  'XLSX', 'XLS', 'XLSM', 'PDF',
  'FOGLIO', 'BLAD', 'SHEET', 'TS',
  'SEZ', 'CKM', 'OP', 'AVAI'
]);
function extractBrandFromFilename(filename) {
  const cleaned = filename.replace(/\.[^.]+$/, '');
  // letter로 시작하고 letter/dot 3+ 글자인 토큰 추출 (A.P.C 같은 점 포함도 살림)
  const tokens = cleaned.match(/[A-Za-z][A-Za-z.&]{2,}/g) || [];
  for (const t of tokens) {
    const upper = t.toUpperCase();
    if (BRAND_STOPWORDS.has(upper)) continue;
    if (upper.startsWith('FOGLIO')) continue;
    return upper;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// 통화 감지 — CURRENCY 컬럼 → 헤더 텍스트 → 파일명 힌트 → 기본 EUR
// ────────────────────────────────────────────────────────────────────
function inferCurrency(rows, headerRow, headers, columns, filename) {
  // 1) CURRENCY 컬럼이 있으면 첫 데이터 행에서 값 읽기
  if (columns.currency) {
    const idx = headers.findIndex(h => h === columns.currency);
    if (idx >= 0) {
      for (let r = headerRow + 1; r < Math.min(headerRow + 10, rows.length); r++) {
        const v = rows[r]?.[idx];
        if (v && typeof v === 'string') {
          const upper = v.trim().toUpperCase();
          if (['EUR', 'USD', 'GBP', 'JPY', 'KRW', 'CNY', 'CHF'].includes(upper)) {
            return { code: upper, source: `CURRENCY 컬럼 (${columns.currency})` };
          }
        }
      }
    }
  }
  // 2) 헤더 텍스트에 통화 코드/심볼 포함
  const allHeaders = headers.join(' | ').toUpperCase();
  if (/\bUSD\b|\$/.test(allHeaders))  return { code: 'USD', source: '헤더에 USD/$' };
  if (/\bEUR\b|€/.test(allHeaders))   return { code: 'EUR', source: '헤더에 EUR/€' };
  if (/\bGBP\b|£/.test(allHeaders))   return { code: 'GBP', source: '헤더에 GBP/£' };
  if (/\bJPY\b|¥/.test(allHeaders))   return { code: 'JPY', source: '헤더에 JPY/¥' };
  // 3) 파일명/시트 힌트 (이랜드 부산항 도착가격 = 한국 수입사 USD FOB 일반)
  const fnUpper = filename.toUpperCase();
  if (/USD/.test(fnUpper)) return { code: 'USD', source: '파일명에 USD' };
  if (/부산항|도착가격|이랜드|FOB/.test(filename)) return { code: 'USD', source: '한국 수입사 + FOB/도착가 → USD 추정' };
  // 4) 기본값
  return { code: 'EUR', source: '기본값 (감지 정보 없음)' };
}

function inferBrand(rows, headerRow, headers, columns, filename, sheetName) {
  // 1) BRAND 컬럼 데이터 행에서 첫 유효값
  if (columns.brand) {
    const idx = headers.findIndex(h => h === columns.brand);
    if (idx >= 0) {
      for (let r = headerRow + 1; r < Math.min(headerRow + 20, rows.length); r++) {
        const v = rows[r]?.[idx];
        if (v && typeof v === 'string') {
          const s = v.trim();
          if (s && s !== 'NO DATA' && s !== 'NO INFO') return s.toUpperCase();
        }
      }
    }
  }
  // 2) 파일명 의미 있는 첫 토큰 (stopword 제외)
  const fromFile = extractBrandFromFilename(filename);
  if (fromFile) return fromFile;
  // 3) 시트명이 ALL CAPS이고 stopword 아니면 사용
  if (sheetName && /^[A-Z]{3,}$/.test(sheetName.trim())) {
    const sn = sheetName.trim();
    if (!BRAND_STOPWORDS.has(sn)) return sn;
  }
  return 'UNKNOWN';
}

/**
 * 휴리스틱 자동 탐지 — 벤더 설정 없이 임의 Excel을 분석.
 * 매핑 부족하면 null 반환 (호출자가 폴백 처리).
 */
export function autoDetectFormat(XLSX, workbook, filename) {
  const sheetName = pickSheet(workbook.SheetNames);
  if (!sheetName) return null;
  const ws = workbook.Sheets[sheetName];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (rows.length < 2) return null;

  const headerRow = findHeaderRow(rows);
  const headers = (rows[headerRow] || []).map(v => v == null ? '' : String(v).trim());
  const columns = mapColumns(headers);
  const shape = detectShape(headers, columns);
  const brand = inferBrand(rows, headerRow, headers, columns, filename, sheetName);
  const currency = inferCurrency(rows, headerRow, headers, columns, filename);

  // 최소 매핑 점검: style + qty + (rrp OR jsc)는 필수
  const hasStyle = !!columns.style;
  const hasQty   = !!columns.qty;
  const hasPrice = !!(columns.rrp || columns.jsc);
  if (!hasStyle || !hasQty || !hasPrice) {
    return {
      autoDetected: true,
      ok: false,
      reason: `필수 컬럼 부재: ${[!hasStyle && 'style', !hasQty && 'qty', !hasPrice && 'rrp|jsc'].filter(Boolean).join(', ')}`,
      sheetName, headerRow, columns, brand
    };
  }

  return {
    autoDetected: true,
    ok: true,
    vendor: 'AUTO-' + brand,
    displayName: brand,
    match: { sheetName },
    headerRow,
    dataStartRow: headerRow + 1,
    shape: shape.shape,
    brand,
    currency: currency.code,
    currencySource: currency.source,
    columns: {
      style:    columns.style,
      color:    columns.color || columns.colorCode,
      size:     columns.size,
      category: columns.category,
      gender:   columns.gender,
      season:   columns.season,
      product:  columns.productName,
      rrp:      columns.rrp,
      jsc:      columns.jsc,
      qtyTotal: columns.qty
    },
    sizeColumns: shape.shape === 'wide' && shape.sizeStart >= 0
      ? {
          startIndex: shape.sizeStart,
          endIndex:   shape.sizeEnd,
          labelFromHeaderRow: true,
          skipNullOrZero: true
        }
      : null,
    categoryMap: DEFAULT_CATEGORY_MAP,
    genderMap: DEFAULT_GENDER_MAP,
    notes: [
      `자동 탐지 — ${shape.shape === 'wide' ? `wide (사이즈 컬럼 ${shape.sizeStart}~${shape.sizeEnd}, ${shape.sizeRun}개)` : 'long (SIZE 컬럼 사용)'}`,
      `브랜드 추론: ${brand}`,
      `통화 추론: ${currency.code} (${currency.source})`,
      columns.jsc ? null : '도매가 컬럼(JSC/WHS) 부재 — 매입율 계산 불가',
      columns.rrp ? null : '소매가 컬럼 부재'
    ].filter(Boolean)
  };
}

/** 모든 벤더 설정 로드 (브라우저 fetch / 캐시) */
export async function loadVendorConfigs(baseUrl = './data/vendor-formats/') {
  if (_vendorCache) return _vendorCache;
  const configs = {};
  for (const name of VENDOR_FORMATS) {
    try {
      const res = await fetch(`${baseUrl}${name}.json`);
      if (!res.ok) {
        console.warn(`[vendor-adapter] ${name}.json fetch 실패: ${res.status}`);
        continue;
      }
      configs[name] = await res.json();
    } catch (e) {
      console.warn(`[vendor-adapter] ${name}.json 로드 실패:`, e.message);
    }
  }
  _vendorCache = configs;
  return configs;
}

/** 노드 테스트용 — fetch 안 쓰고 직접 주입 */
export function _setVendorConfigs(configs) {
  _vendorCache = configs;
}

/**
 * 워크북 + 파일명으로 벤더 감지.
 * @returns {{ name: string, config: object } | null}
 */
export function detectVendor(workbook, filename, configs) {
  const sheets = workbook.SheetNames || [];
  for (const [name, cfg] of Object.entries(configs || {})) {
    const m = cfg.match || {};
    let ok = true;
    if (m.filenameRegex) {
      const re = new RegExp(m.filenameRegex, 'i');
      if (!re.test(filename || '')) ok = false;
    }
    if (ok && m.sheetName && !sheets.includes(m.sheetName)) ok = false;
    if (ok) return { name, config: cfg };
  }
  return null;
}

/**
 * 벤더 어댑터 적용 → 표준 Offer[] 반환.
 * 표준 Offer 필드: brand, style, color, size, category, gender, product, sports,
 *                  jsc, rrp, qty, season, channel, arrivalMonth (app.js toOffer 입력)
 * @param {object} XLSX  워크북 라이브러리(window.XLSX)
 * @param {object} workbook
 * @param {object} config  벤더 설정 (data/vendor-formats/*.json)
 * @returns {Array<object>}  raw offer 입력 배열 (toOffer로 다시 감싸야 함)
 */
export function applyVendor(XLSX, workbook, config) {
  const sheetName = (config.match && config.match.sheetName) || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`벤더 어댑터: 시트 '${sheetName}' 없음`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const headerRow = rows[config.headerRow] || [];
  const startRow  = config.dataStartRow ?? (config.headerRow + 1);

  // 헤더 라벨 → 컬럼 인덱스 맵
  const idxByLabel = {};
  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i];
    if (v == null || v === '') continue;
    idxByLabel[String(v).trim()] = i;
  }
  const find = (label) => (label in idxByLabel ? idxByLabel[label] : -1);

  const cols = config.columns || {};
  const colStyle    = find(cols.style);
  const colColor    = find(cols.color);
  const colCategory = find(cols.category);
  const colGender   = find(cols.gender);
  const colSeason   = find(cols.season);
  const colProduct  = find(cols.product);
  const colRrp      = find(cols.rrp);
  const colJsc      = find(cols.jsc);
  const colQtyTotal = find(cols.qtyTotal);

  const catMap    = config.categoryMap || {};
  const genderMap = config.genderMap || {};
  const brandConst = config.brand || '';
  const currency  = (config.currency || 'EUR').toUpperCase();

  const offers = [];
  const shape = config.shape || 'long';
  const sz = config.sizeColumns || {};
  const startIdx = sz.startIndex ?? -1;
  const endIdx   = sz.endIndex ?? -1;
  const skipZero = sz.skipNullOrZero !== false;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || [];
    const styleVal = colStyle >= 0 ? row[colStyle] : null;
    if (styleVal == null || styleVal === '') continue; // 빈 행 스킵

    const baseFields = {
      brand:    brandConst,
      style:    String(styleVal).trim(),
      color:    colColor    >= 0 ? String(row[colColor] ?? '').trim() : '',
      category: catMap[String(row[colCategory] ?? '').trim().toUpperCase()] || String(row[colCategory] ?? '').trim().toUpperCase() || 'OTHER',
      gender:   genderMap[String(row[colGender] ?? '').trim().toUpperCase()] || String(row[colGender] ?? '').trim().toUpperCase() || 'UNISEX',
      product:  colProduct >= 0 ? String(row[colProduct] ?? '').trim().toUpperCase() : '',
      season:   colSeason  >= 0 ? String(row[colSeason] ?? '').trim().toUpperCase() : '',
      sports:   '',
      jsc:      colJsc >= 0 ? Number(row[colJsc]) || 0 : 0,
      rrp:      colRrp >= 0 ? Number(row[colRrp]) || 0 : 0,
      channel:  '',
      arrivalMonth: '',
      currency: currency
    };

    if (shape === 'wide' && startIdx >= 0 && endIdx >= startIdx) {
      // wide → long 피벗: 사이즈 컬럼별 qty>0인 셀마다 1 SKU
      for (let c = startIdx; c <= endIdx; c++) {
        const qty = Number(row[c]) || 0;
        if (skipZero && qty <= 0) continue;
        const sizeLabel = headerRow[c];
        if (sizeLabel == null || sizeLabel === '') continue;
        offers.push({
          ...baseFields,
          size: String(sizeLabel).trim(),
          qty
        });
      }
    } else {
      // long format — 사이즈는 별도 컬럼에서, qty는 qtyTotal에서
      const colSize = find(cols.size);
      offers.push({
        ...baseFields,
        size: colSize >= 0 ? String(row[colSize] ?? '').trim() : '',
        qty:  colQtyTotal >= 0 ? Number(row[colQtyTotal]) || 0 : 0
      });
    }
  }
  return offers;
}
