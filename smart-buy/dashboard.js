// 대시보드(전체 오퍼) 탭 렌더러.
// SVG 막대그래프는 vanilla(의존성 0). 컬러는 design-tokens.css에서 lookup.

import { aggregateOffer } from './engine/aggregate.js';

// ── 디자인 토큰 lookup (SVG fill 속성에 CSS var 직접 사용 불가) ──
const _tokenCache = {};
function tokenColor(name, fallback = '#000') {
  if (_tokenCache[name]) return _tokenCache[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return (_tokenCache[name] = v || fallback);
}
// 자주 쓰는 토큰 alias — Linear의 차트는 다색 jewel tone
const T = {
  // 차트 팔레트 (10색)
  c1:  () => tokenColor('--chart-color-1'),   // violet
  c2:  () => tokenColor('--chart-color-2'),   // green
  c3:  () => tokenColor('--chart-color-3'),   // amber
  c4:  () => tokenColor('--chart-color-4'),   // sky
  c5:  () => tokenColor('--chart-color-5'),   // magenta
  c6:  () => tokenColor('--chart-color-6'),   // orange
  c7:  () => tokenColor('--chart-color-7'),   // teal
  c8:  () => tokenColor('--chart-color-8'),   // red
  c9:  () => tokenColor('--chart-color-9'),   // lime
  c10: () => tokenColor('--chart-color-10'),  // lavender
  // 텍스트
  txtSecondary: () => tokenColor('--text-secondary'),
  txtPrimary:   () => tokenColor('--text-primary'),
  txtTertiary:  () => tokenColor('--text-tertiary')
};
// 카테고리별 다색 막대 팔레트 — 등급 분포 / 다항 통계용
const CAT_PALETTE = ['c1','c4','c7','c9','c3','c6','c5','c10','c2','c8'];

// ── SVG 막대그래프 헬퍼 (Linear 스타일) ─────────────────────────
// data:  [{ label, value, qty? }]
// opts:  { width, height, color | colors[], valueFmt, labelColor, valueColor }
//   colors[] : 인덱스별 다색 막대 (Linear marketing 차트 패턴)
//   color    : 단색 폴백
function renderBarChart(container, data, opts = {}) {
  const ROW_H = 26;
  const W = opts.width  || 320;
  const H = opts.height || (data.length * ROW_H + 8);
  const colors = opts.colors || null;       // 다색 배열 우선
  const color  = opts.color  || T.c1();      // 단색 폴백
  const labelColor = opts.labelColor || T.txtTertiary();
  const valueColor = opts.valueColor || T.txtPrimary();
  const valueFmt = opts.valueFmt || (v => String(v));
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const labelW = 120;
  const padR   = 64;
  const barW   = W - labelW - padR;

  const rows = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const w = max > 0 ? Math.round((v / max) * barW) : 0;
    const y = i * ROW_H + 4;
    const safeLabel = String(d.label).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const fill = colors ? colors[i % colors.length] : color;
    return `
      <g>
        <text class="chart-bar-label" x="0" y="${y + 16}" fill="${labelColor}">${safeLabel}</text>
        <rect x="${labelW}" y="${y + 4}" width="${w}" height="16" fill="${fill}" rx="3" />
        <text class="chart-bar-value" x="${labelW + w + 6}" y="${y + 16}" fill="${valueColor}">${valueFmt(v, d)}</text>
      </g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block">${rows}</svg>`;
}

// 다색 팔레트 생성기 — n개 막대에 CAT_PALETTE를 인덱스별로 매핑
function makeColors(n, offset = 0) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const key = CAT_PALETTE[(i + offset) % CAT_PALETTE.length];
    arr.push(T[key]());
  }
  return arr;
}

// ── KPI 카드 ────────────────────────────────────────────────────
function kpiCard(label, value, sub = '') {
  return `
    <div class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`;
}

function fmtPct(n)   { return (n * 100).toFixed(1) + '%'; }
function fmtNum(n)   { return Number(n).toLocaleString(); }
function fmtScore(n) { return Number(n).toFixed(1); }

// 환율 테이블 (KRW per 1 unit of foreign currency).
// 외환 변동 반영 안 한 가정값 — 진단 텍스트와 결과 영역 헤더에 명시.
// EUR×1740은 v12에서 보존 (JSC 환산 기준). USD×1350은 2025~26 평균.
export const FX_RATES = {
  EUR: 1740,
  USD: 1350,
  GBP: 1780,
  JPY: 9.4,
  CNY: 190,
  CHF: 1500,
  KRW: 1
};

// 환율 기준일 — 가정값. 실시간 API 도입 시 갱신.
export const FX_BASE_DATE = '2026-01';

// 결과 영역 등에서 "EUR × 1,740 / 2026-01 기준 (가정값)" 식의 주석 생성
export function fxAnnotation(currency = 'EUR') {
  const cur = String(currency).toUpperCase();
  const rate = FX_RATES[cur];
  if (!rate || cur === 'KRW') return '';
  return `${cur} × ${rate.toLocaleString()} · ${FX_BASE_DATE} 기준 (가정값)`;
}
const CURRENCY_SYMBOLS = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', KRW: '₩'
};
function fxRateOf(currency) { return FX_RATES[String(currency).toUpperCase()] || FX_RATES.EUR; }
function symbolOf(currency) { return CURRENCY_SYMBOLS[String(currency).toUpperCase()] || ''; }

function fmtMoney(value, currency = 'EUR') {
  const sym = symbolOf(currency);
  if (value >= 1e6) return sym + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return sym + (value / 1e3).toFixed(0) + 'K';
  return sym + Math.round(value).toLocaleString();
}
function fmtMoneyKrw(value, currency = 'EUR') {
  const krw = value * fxRateOf(currency);
  if (krw >= 1e8) return '≈ ' + (krw / 1e8).toFixed(1) + '억 원';
  if (krw >= 1e7) return '≈ ' + (krw / 1e7).toFixed(1) + '천만 원';
  if (krw >= 1e4) return '≈ ' + (krw / 1e4).toFixed(0) + '만 원';
  return '≈ ' + Math.round(krw).toLocaleString() + ' 원';
}
// 후방 호환 (이전 호출 시그니처)
function fmtMoneyEur(eur) { return fmtMoney(eur, 'EUR'); }
function safeRatio(num, den) { return den > 0 ? num / den : 0; }
function topByQty(map, n = 1) {
  return Object.entries(map)
    .map(([k, v]) => ({ key: k, count: v.count || 0, qty: v.qty || 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, n);
}

// ── 상위 N + 기타 합산 ───────────────────────────────────────────
function topN(map, n = 5, label = 'count') {
  const entries = Object.entries(map).map(([k, v]) => ({
    label: k,
    value: label === 'count' ? v.count : (v.qty || 0),
    qty: v.qty || 0,
    count: v.count || 0
  }));
  entries.sort((a, b) => b.value - a.value);
  if (entries.length <= n) return entries;
  const top = entries.slice(0, n);
  const rest = entries.slice(n);
  const restValue = rest.reduce((a, b) => a + b.value, 0);
  const restQty   = rest.reduce((a, b) => a + b.qty, 0);
  const restCount = rest.reduce((a, b) => a + b.count, 0);
  top.push({ label: `기타 ${rest.length}건`, value: restValue, qty: restQty, count: restCount });
  return top;
}

// ── 매입 고려 사항 텍스트에서 핵심 조건 추출 ───────────────────
// 자유양식 자연어를 룰 기반 정규식으로 파싱. 100% 정확하지 않으니
// 추출 결과는 명시적으로 사용자에게 보여주고, 분석 결과 숫자는 덮어쓰지 않는다.
//
// 잡는 패턴:
//   - 매입율 / 할인율: "80% off retail", "Offer at 20% of RRP" 등
//   - MOQ: "Minimum total order - 50k EUR" 등
//   - 인코텀: "Ex-works Dubai", "FOB Busan", "DDP Seoul" 등
//   - 리드타임: "Delivery 6 to 8 weeks", "ship in 4 weeks" 등
export function extractConsiderations(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return null;

  const out = {
    raw: text,
    discountPct: null,    // 80 (= 80% off → 매입율 20%)
    buyRate: null,        // 0.20 (= RRP 대비 매입가 비율)
    buyRateSource: null,  // "80% Off Retail Price" 등 원문 인용
    moq: null,            // { value: 50000, currency: 'EUR', raw: 'Minimum total order - 50k EUR' }
    incoterm: null,       // { term: 'EXW', location: 'Dubai', raw: 'Ex-works Dubai' }
    leadTime: null        // { min: 6, max: 8, unit: 'weeks', raw: '6 to 8 weeks' }
  };

  // 1) 할인율 — "X% off" 패턴 (가장 흔함)
  const discountMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (discountMatch) {
    out.discountPct = parseFloat(discountMatch[1]);
    out.buyRate = (100 - out.discountPct) / 100;
    out.buyRateSource = discountMatch[0].trim();
  }

  // 2) 직접 매입율 명시 — "Offer at 20% of RRP", "20% of retail" 등
  if (out.buyRate === null) {
    const buyRateMatch = text.match(/(?:offer|buy|purchase|wholesale|price)[\s\w-]{0,30}?(?:at\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:rrp|retail|msrp)/i);
    if (buyRateMatch) {
      out.buyRate = parseFloat(buyRateMatch[1]) / 100;
      out.discountPct = 100 - parseFloat(buyRateMatch[1]);
      out.buyRateSource = buyRateMatch[0].trim();
    }
  }

  // 3) MOQ — "Minimum total order - 50k EUR" / "MOQ 100 units"
  // 우선 통화 단위 (€/EUR/USD 등) 잡고, 없으면 단순 숫자 + units
  const moqMoneyMatch = text.match(/(?:minimum|MOQ|min\.?)[\s\w]{0,30}?(?:order|amount|value|spend)?[\s\.\-:,]*(\d+(?:\.\d+)?)\s*(k|m|million|thousand|mn)?\s*(EUR|USD|GBP|JPY|KRW|€|\$|£|¥)/i);
  if (moqMoneyMatch) {
    let value = parseFloat(moqMoneyMatch[1]);
    const mult = (moqMoneyMatch[2] || '').toLowerCase();
    if (mult === 'k' || mult === 'thousand') value *= 1000;
    else if (mult === 'm' || mult === 'mn' || mult === 'million') value *= 1000000;
    out.moq = {
      value,
      currency: normalizeCurrencySymbol(moqMoneyMatch[3]),
      raw: moqMoneyMatch[0].trim()
    };
  }

  // 4) 인코텀 — Ex-works / FOB / CIF / DDP / DAP / FCA / CIP
  const incotermMatch = text.match(/\b(ex-?works|EXW|FOB|CIF|DDP|DAP|FCA|CIP|CFR|CPT)\b[\s,]*([A-Za-z][A-Za-z\s,]*?)?(?:[\.\n]|$)/i);
  if (incotermMatch) {
    let term = incotermMatch[1].toUpperCase().replace(/-/g, '');
    if (term === 'EXWORKS') term = 'EXW';
    out.incoterm = {
      term,
      location: (incotermMatch[2] || '').trim().split(/[\.,\n]/)[0].trim(),
      raw: incotermMatch[0].trim().replace(/[\.\s]+$/, '')
    };
  }

  // 5) 리드타임 — "6 to 8 weeks" / "in 4 weeks" / "ship in 30 days"
  const leadRangeMatch = text.match(/(?:delivery|lead\s*time|ship[\s\w]*?|window)[\s\w-]{0,30}?(\d+)\s*(?:to|-|–)\s*(\d+)\s*(week|day|month)s?/i);
  if (leadRangeMatch) {
    out.leadTime = {
      min: parseInt(leadRangeMatch[1], 10),
      max: parseInt(leadRangeMatch[2], 10),
      unit: leadRangeMatch[3] + 's',
      raw: leadRangeMatch[0].trim()
    };
  } else {
    const leadSingleMatch = text.match(/(?:delivery|lead\s*time|ship[\s\w]*?)[\s\w-]{0,30}?(\d+)\s*(week|day|month)s?/i);
    if (leadSingleMatch) {
      out.leadTime = {
        min: parseInt(leadSingleMatch[1], 10),
        max: parseInt(leadSingleMatch[1], 10),
        unit: leadSingleMatch[2] + 's',
        raw: leadSingleMatch[0].trim()
      };
    }
  }

  return out;
}

function normalizeCurrencySymbol(sym) {
  if (!sym) return '';
  const s = sym.trim().toUpperCase();
  if (s === '€') return 'EUR';
  if (s === '$') return 'USD';
  if (s === '£') return 'GBP';
  if (s === '¥') return 'JPY';
  return s;
}

// ── 시즌별 집계 ─────────────────────────────────────────────────
export function aggregateBySeasons(diagnoses) {
  const groups = {};
  for (const d of diagnoses) {
    const s = (d.offer?.season || '미상').trim() || '미상';
    if (!groups[s]) groups[s] = [];
    groups[s].push(d);
  }
  return Object.entries(groups)
    .map(([season, list]) => ({ season, agg: aggregateOffer(list), count: list.length }))
    .sort((a, b) => b.count - a.count);
}

// ── 브랜드별 집계 ────────────────────────────────────────────────
// brand 필드 우선, 없으면 brandId 폴백.
export function aggregateByBrands(diagnoses) {
  const groups = {};
  for (const d of diagnoses) {
    const o = d.offer || {};
    const b = (o.brand || o.brandId || '미상').trim() || '미상';
    if (!groups[b]) groups[b] = [];
    groups[b].push(d);
  }
  return Object.entries(groups)
    .map(([brand, list]) => ({ brand, agg: aggregateOffer(list), count: list.length }))
    .sort((a, b) => b.agg.totalQty - a.agg.totalQty);  // qty 기준 정렬
}

// ── HERO: 전체 종합행만 (시즌별·브랜드별은 별도 카드로 분리) ────
// 5개 컬럼: 종합 등급 / 오퍼 금액 / 매입율 / 총 SKU / 총 수량.
// 종합행 숫자는 fs-3xl(34px) — 이전 fs-display(48px)에서 축소해 카드 높이 줄임.
export function renderHero(container, agg) {
  const cur = agg.currency || 'EUR';

  const headerCells = [
    `<div class="ht-cell">종합 등급</div>`,
    `<div class="ht-cell">오퍼 금액 <span class="kpi-currency-tag">${cur}</span></div>`,
    `<div class="ht-cell">매입율</div>`,
    `<div class="ht-cell">총 SKU</div>`,
    `<div class="ht-cell">총 수량</div>`
  ].join('');

  // 종합행 — 금액 셀의 원화 환산은 별도 큰 라인(ht-num-krw)으로 분리해 강조.
  const totalCells = [
    `<div class="ht-cell">
       <div class="ht-grade-large"><span class="overall-grade-badge g-${agg.overallGrade.cls}">${agg.overallGrade.label}</span></div>
       <div class="ht-sub">${fmtScore(agg.weightedScore)}점 · 가중평균</div>
     </div>`,
    `<div class="ht-cell">
       <div class="ht-num-large">${fmtMoney(agg.jscSumEur, cur)}</div>
       <div class="ht-num-krw">${fmtMoneyKrw(agg.jscSumEur, cur)}</div>
       <div class="ht-sub">RRP ${fmtMoney(agg.rrpSumEur, cur)}</div>
     </div>`,
    `<div class="ht-cell">
       <div class="ht-num-large">${(agg.weightedBuyRate * 100).toFixed(1)}%</div>
       <div class="ht-sub">단순 ${(agg.simpleBuyRate * 100).toFixed(1)}%</div>
     </div>`,
    `<div class="ht-cell">
       <div class="ht-num-large">${fmtNum(agg.totalSkus)}</div>
       <div class="ht-sub">${Object.keys(agg.byCategory).length} 카테고리 · ${Object.keys(agg.bySeason).length} 시즌</div>
     </div>`,
    `<div class="ht-cell">
       <div class="ht-num-large">${fmtNum(agg.totalQty)}</div>
       <div class="ht-sub">SKU당 평균 ${fmtNum(agg.totalSkus ? Math.round(agg.totalQty / agg.totalSkus) : 0)}</div>
     </div>`
  ].join('');

  // 섹션 제목 — 위계 역전: 스코프(전체)가 메인 큰 화이트, "오퍼 핵심 요약"은 eyebrow.
  container.innerHTML = `
    <h3 class="hero-section-title">
      <span class="hero-section-scope">전체</span>
      <span class="hero-section-eyebrow">오퍼 핵심 요약</span>
    </h3>
    <div class="hero-table" data-testid="kpi-grid">
      <div class="ht-row ht-header-row">${headerCells}</div>
      <div class="ht-row ht-total-row">${totalCells}</div>
    </div>
  `;
}

// ── 오퍼 핵심 요약 (시즌별) — 별도 카드 ─────────────────────────
export function renderSeasonSummary(container, bySeasons, currency = 'EUR') {
  if (!container) return;
  if (!bySeasons || !bySeasons.length) {
    container.innerHTML = '';
    return;
  }
  const cur = currency;

  const headerCells = [
    `<div class="ht-cell">시즌</div>`,
    `<div class="ht-cell">오퍼 금액 <span class="kpi-currency-tag">${cur}</span></div>`,
    `<div class="ht-cell">매입율</div>`,
    `<div class="ht-cell">총 SKU</div>`,
    `<div class="ht-cell">총 수량</div>`
  ].join('');

  const seasonRows = bySeasons.map(({ season, agg: sa }) => `
    <div class="ht-row ht-season-row" data-testid="season-${season.replace(/[^A-Za-z0-9]/g, '_')}">
      <div class="ht-cell">
        <div class="ht-season-line">
          <span class="season-tag">${season}</span>
          <span class="overall-grade-badge g-${sa.overallGrade.cls}">${sa.overallGrade.label}</span>
        </div>
        <div class="ht-sub-sm">${fmtScore(sa.weightedScore)}점</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtMoney(sa.jscSumEur, cur)}</div>
        <div class="ht-sub-sm">${fmtMoneyKrw(sa.jscSumEur, cur)}</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${(sa.weightedBuyRate * 100).toFixed(1)}%</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtNum(sa.totalSkus)}</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtNum(sa.totalQty)}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <h3 class="hero-section-title">
      <span class="hero-section-scope">시즌별</span>
      <span class="hero-section-eyebrow">오퍼 핵심 요약</span>
    </h3>
    <div class="hero-table" data-testid="season-summary-table">
      <div class="ht-row ht-header-row">${headerCells}</div>
      ${seasonRows}
    </div>
  `;
}

// 시즌별 sub-row는 hero 통합 테이블에 흡수됐으므로 컨테이너 비움 (호환성 유지).
export function renderSeasonBreakdown(container) {
  if (container) container.innerHTML = '';
}

// ── 오퍼 핵심 요약 (브랜드) — hero와 양식 동일, 별도 카드로 분리 ──
// 5컬럼: 브랜드명+등급 / 금액 / 매입율 / SKU / 수량.
// 종합행이 없는 대신 헤더 + 브랜드별 행들. 사용자 요청에 따라 별도 카드.
export function renderBrandSummary(container, byBrands, currency = 'EUR') {
  if (!container) return;
  if (!byBrands || !byBrands.length) {
    container.innerHTML = '';
    return;
  }
  const cur = currency;

  // 헤더 행 (라벨)
  const headerCells = [
    `<div class="ht-cell">브랜드</div>`,
    `<div class="ht-cell">오퍼 금액 <span class="kpi-currency-tag">${cur}</span></div>`,
    `<div class="ht-cell">매입율</div>`,
    `<div class="ht-cell">총 SKU</div>`,
    `<div class="ht-cell">총 수량</div>`
  ].join('');

  // 브랜드 행들 — qty 기준 정렬됨 (집계 함수에서 처리)
  const brandRows = byBrands.map(({ brand, agg: ba }) => `
    <div class="ht-row ht-season-row" data-testid="brand-${brand.replace(/[^A-Za-z0-9가-힣]/g, '_')}">
      <div class="ht-cell">
        <div class="ht-season-line">
          <span class="season-tag">${brand}</span>
          <span class="overall-grade-badge g-${ba.overallGrade.cls}">${ba.overallGrade.label}</span>
        </div>
        <div class="ht-sub-sm">${fmtScore(ba.weightedScore)}점</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtMoney(ba.jscSumEur, cur)}</div>
        <div class="ht-sub-sm">${fmtMoneyKrw(ba.jscSumEur, cur)}</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${(ba.weightedBuyRate * 100).toFixed(1)}%</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtNum(ba.totalSkus)}</div>
      </div>
      <div class="ht-cell">
        <div class="ht-num-medium">${fmtNum(ba.totalQty)}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <h3 class="hero-section-title">
      <span class="hero-section-scope">브랜드별</span>
      <span class="hero-section-eyebrow">오퍼 핵심 요약</span>
    </h3>
    <div class="hero-table" data-testid="brand-summary-table">
      <div class="ht-row ht-header-row">${headerCells}</div>
      ${brandRows}
    </div>
  `;
}

// ── 표준 분류 (유통 복종 / 성별 / 시즌) ──────────────────────────
// 클릭 안 됨. 정보만 표시 — 매칭되는 SKU 1건이라도 있으면 highlight.

// 카테고리 룰: 우선순위 순서 (먼저 매칭되는 것 채택)
// 가장 구체적인 분류부터 → DRESS / OUTER / BOTTOMS / INNER / TOPS / FOOTWEAR / BAGS / ACCESSORY / APPAREL → ETC
const CATEGORY_RULES = [
  ['DRESS',     /(?:^|[^A-Z])(DRESS(ES)?|JUMPSUIT|ROMPER|GOWN)(?:[^A-Z]|$)/i],
  ['OUTER',     /(?:^|[^A-Z])(OUTER(WEAR)?|JACKET|COAT|BLAZER|CARDIGAN|PARKA|TRENCH|PEACOAT|ANORAK|WINDBREAKER)(?:[^A-Z]|$)/i],
  ['BOTTOMS',   /(?:^|[^A-Z])(BOTTOM|PANT|TROUSER|JEAN|SHORT|SKIRT|LEGGING|DENIM|CHINO|SHORTS|JOGGER|CULOTTE)(?:[^A-Z]|$)/i],
  ['INNER',     /(?:^|[^A-Z])(INNER(WEAR)?|UNDERWEAR|LINGERIE|SLEEPWEAR|SLEEP|SWIM(WEAR|SUIT)?|BEACHWEAR|BIKINI|BRA|PANTY|PANTIES|HOSIERY|NIGHTGOWN|NIGHTWEAR|PAJAMA)(?:[^A-Z]|$)/i],
  ['TOPS',      /(?:^|[^A-Z])(TOPS?|SHIRT|TEE|T-?SHIRT|BLOUSE|KNIT(WEAR)?|POLO(S)?|SWEATER|HOODIE|JERSEY|SWEATSHIRT|TUNIC|TANK|CAMI|VEST|PULLOVER|HENLEY)(?:[^A-Z]|$)/i],
  ['FOOTWEAR',  /(?:^|[^A-Z])(FOOTWEAR|SHOES?|SHOE|SNEAKERS?|BOOTS?|BOOT|SANDALS?|SANDAL|HEELS?|HEEL|FLATS?|LOAFERS?|MOCCASINS?|SLIPPERS?|MULES?|ESPADRILLE)(?:[^A-Z]|$)/i],
  ['BAGS',      /(?:^|[^A-Z])(BAGS?|BAG|CROSSBODY|HANDBAG|TOTE|BACKPACK|CLUTCH|POCHETTE|WALLET|PURSE|SATCHEL|HOBO)(?:[^A-Z]|$)/i],
  ['ACCESSORY', /(?:^|[^A-Z])(ACC|ACCESSORY|ACCESSORIES|ACCESSOIRES|BELT|HAT|CAP|JEWEL(R?Y|LERY)?|NECKLACE|EARRING|RING|BRACELET|SCARF|SCARVES|GLOVE|TIE|EYEWEAR|SUNGLASS|WATCH)(?:[^A-Z]|$)/i],
  ['APPAREL',   /(?:^|[^A-Z])(APPAREL|CLOTHING|RTW|READY-TO-WEAR|TEX|TEXTILE)(?:[^A-Z]|$)/i]
];
const STD_CATEGORIES = ['TOPS','BOTTOMS','DRESS','OUTER','INNER','FOOTWEAR','BAGS','ACCESSORY','APPAREL','ETC'];

const GENDER_RULES = [
  ['MEN',     /^(MEN|MALE|MAN|MENS)$/i],
  ['WOMEN',   /^(WOMEN|FEMALE|WOMAN|F|WMN|WOMENS|LADY|LADIES)$/i],
  ['KIDS',    /^(KIDS?|CHILD|CHILDREN|GIRL|GIRLS|BOY|BOYS|YOUTH|JUNIOR|TEEN|INFANT|BABY|TODDLER)$/i],
  ['UNISEX',  /^(UNISEX|UNI|U|ADULT|UN|GENDER\s*NEUTRAL)$/i]
];
const STD_GENDERS = ['MEN','WOMEN','UNISEX','KIDS','ETC'];

const SEASON_RULES = [
  ['SS', /^(SS|SPRING|SUMMER|S\/?S|SPRING\/?SUMMER|SP\d*|SP|RESORT|CRUISE|PRE-?SPRING)/i],
  ['FW', /^(FW|FALL|WINTER|F\/?W|FALL\/?WINTER|AW|AUTUMN|HOLIDAY|PRE-?FALL)/i]
];
const STD_SEASONS = ['SS','FW','ETC'];

function classifyCategory(offer) {
  const text = `${offer.category || ''} ${offer.product || ''}`.trim();
  if (!text) return 'ETC';
  for (const [id, rx] of CATEGORY_RULES) {
    if (rx.test(text)) return id;
  }
  return 'ETC';
}
function classifyGender(offer) {
  const v = String(offer.gender || '').trim();
  if (!v) return 'ETC';
  for (const [id, rx] of GENDER_RULES) {
    if (rx.test(v)) return id;
  }
  return 'ETC';
}
function classifySeason(offer) {
  const v = String(offer.season || '').trim();
  if (!v) return 'ETC';
  for (const [id, rx] of SEASON_RULES) {
    if (rx.test(v)) return id;
  }
  return 'ETC';
}

// ── 정보 칩 (카테고리·성별·시즌 — 클릭 안 됨, 매칭만 highlight) ──
export function renderFilters(container, allDiagnoses) {
  const catSet = new Set();
  const genSet = new Set();
  const seaSet = new Set();
  // 매칭별 SKU 카운트도 같이 (tooltip 가능성)
  const catCnt = {}, genCnt = {}, seaCnt = {};
  for (const d of allDiagnoses) {
    const o = d.offer || {};
    const c = classifyCategory(o); catSet.add(c); catCnt[c] = (catCnt[c]||0) + 1;
    const g = classifyGender(o);   genSet.add(g); genCnt[g] = (genCnt[g]||0) + 1;
    const s = classifySeason(o);   seaSet.add(s); seaCnt[s] = (seaCnt[s]||0) + 1;
  }

  const chipsOf = (stdList, presentSet, cnt) => stdList.map(id => {
    const present = presentSet.has(id);
    const count = cnt[id] || 0;
    const title = present ? `${id} — ${count.toLocaleString()} SKU` : `${id} — 데이터 없음`;
    return `<span class="info-chip ${present ? 'present' : 'absent'}" title="${title}" data-cat="${id}">${id}</span>`;
  }).join('');

  // 카테고리(10개)는 한 줄 차지, 성별(5)+시즌(3)은 한 줄에 합쳐 표시.
  // 라벨은 칩보다 명확해야 — "이 칩이 뭐의 분류인지" 모르게 되면 안 됨.
  container.innerHTML = `
    <div class="filter-chips" data-testid="filter-chips">
      <div class="filter-line filter-line-cat">
        <span class="filter-row">
          <span class="filter-row-label">카테고리</span>
          ${chipsOf(STD_CATEGORIES, catSet, catCnt)}
        </span>
      </div>
      <div class="filter-line filter-line-gen-season">
        <span class="filter-row">
          <span class="filter-row-label">성별</span>
          ${chipsOf(STD_GENDERS, genSet, genCnt)}
        </span>
        <span class="filter-divider"></span>
        <span class="filter-row">
          <span class="filter-row-label">시즌</span>
          ${chipsOf(STD_SEASONS, seaSet, seaCnt)}
        </span>
      </div>
    </div>
  `;
}

// ── 진단 요약 (핵심 결론 1줄 + 보조 KPI 4종 + 내레이티브 단락 1개) ─
// MD가 의사결정할 수 있도록: 맨 위 결론 → 보조 KPI(권고 근거 수치) → 내레이티브.
// 보조 KPI 4종은 진단 카드 안에 통합 (이전: 대시보드 탭의 별도 섹션).
export function renderDiagnosisText(container, agg, totalUnfiltered, ctxMeta = {}) {
  if (!agg.totalSkus) { container.innerHTML = ''; return; }

  const filtered = agg.totalSkus < totalUnfiltered;
  const buyPct = agg.weightedBuyRate * 100;
  const totalGrade = Object.values(agg.gradeDistribution).reduce((s, v) => s + v.count, 0);
  const cur = agg.currency || 'EUR';
  const fxRate = FX_RATES[cur] || FX_RATES.EUR;

  const adjPct = totalGrade ? (agg.gradeDistribution['적극 권장']?.count || 0) / totalGrade * 100 : 0;
  const cautPct = totalGrade ? (agg.gradeDistribution['신중']?.count || 0) / totalGrade * 100 : 0;
  const riskPct = agg.totalSkus ? agg.riskCount / agg.totalSkus * 100 : 0;
  const mismatchPct = agg.totalSkus ? agg.pricingMismatchCount / agg.totalSkus * 100 : 0;

  // 등급 분포 (text)
  const gradeOrdered = Object.entries(agg.gradeDistribution)
    .sort(([, a], [, b]) => Number(b.cls) - Number(a.cls))
    .filter(([, info]) => info.count > 0)
    .map(([label, info]) => `${label} ${(info.count / totalGrade * 100).toFixed(0)}%`);
  const gradeText = gradeOrdered.length ? gradeOrdered.join(' · ') : '등급 데이터 없음';

  // 카테고리·성별 비중 (수량 기준 top 2)
  const topCat = topByQty(agg.byCategory, 2);
  const topGen = topByQty(agg.byGender, 2);
  const catText = topCat.length
    ? topCat.map(c => `${c.key} ${(c.qty / agg.totalQty * 100).toFixed(0)}%`).join(', ')
    : '데이터 없음';
  const genText = topGen.length
    ? topGen.map(g => `${g.key} ${(g.qty / agg.totalQty * 100).toFixed(0)}%`).join(' vs ')
    : '데이터 없음';

  // ── 컨텍스트 추출 + 매입율 적용 메타 ──────────────────────────
  // ctxMeta.ctxApplied가 true면 분석은 *이미 컨텍스트 매입율로 재계산된 결과*.
  // 충돌 검출은 적용 *전* 원본 데이터 매입율(originalAvgBuyRate)과 비교.
  const cons = ctxMeta.considerations || null;
  const ctxApplied = !!ctxMeta.ctxApplied;
  const ctxBuyRate = cons?.buyRate ?? null;
  const originalAvgBuyRate = ctxMeta.originalAvgBuyRate ?? null;
  // 적용 전 원본 데이터의 매입율 (없으면 null — JSC 컬럼 부재 케이스 등)
  const dataBuyRate = ctxApplied ? originalAvgBuyRate : agg.weightedBuyRate;
  // 충돌: 컨텍스트와 원본 데이터 매입율이 둘 다 있고 차이 ≥10%p
  const buyRateMismatch = (
    ctxBuyRate !== null &&
    dataBuyRate !== null &&
    dataBuyRate > 0 &&
    Math.abs(ctxBuyRate - dataBuyRate) >= 0.10
  );

  // ── 핵심 결론 (한 줄) — UX 라이팅은 토스 톤 ("~예요/이에요") ─
  // 우선순위: 매입율 충돌 → caution / 도매가 부재 → 분석 제한 / risk≥20 → 재협상
  // / adj≥50 → 전반 매입 / adj≥25 → 선별 매입 / caut≥40 → 신중 검토 / 그 외 → 분리 협상
  let verdictLabel, verdictTone;
  if (buyRateMismatch) {
    verdictLabel = '컨텍스트와 데이터의 매입율이 달라요 — 검증이 필요해요';
    verdictTone = 'caution';
  } else if (agg.jscSumEur === 0 && agg.rrpSumEur > 0) {
    verdictLabel = '도매가가 없어 매입율을 계산할 수 없어요';
    verdictTone = 'caution';
  } else if (riskPct >= 20) {
    verdictLabel = '오퍼 전반을 재협상하는 게 좋아요';
    verdictTone = 'caution';
  } else if (adjPct >= 50) {
    verdictLabel = '오퍼 전반 매입을 추천드려요';
    verdictTone = 'good';
  } else if (adjPct >= 25) {
    verdictLabel = '선별해서 매입하는 게 좋아요';
    verdictTone = 'good';
  } else if (cautPct >= 40) {
    verdictLabel = '신중하게 검토해 보세요';
    verdictTone = 'caution';
  } else {
    verdictLabel = 'TOP 20과 위험 SKU를 나눠서 협상해 보세요';
    verdictTone = 'mixed';
  }

  // ── 내레이티브 단락 (한 호흡) ──────────────────────────────────
  // 흐름: 규모(+필터) → 매입율 평가 → 등급 분포 → 위험·가격모순 → 구성 → 외환 → 협상 카드
  const parts = [];

  // 규모 + 필터
  parts.push(`이 오퍼는 <b>${fmtNum(agg.totalSkus)} SKU</b> / 총 수량 <b>${fmtNum(agg.totalQty)}</b>, 금액 <b>${fmtMoney(agg.jscSumEur, cur)}</b> (≈ ${fmtMoneyKrw(agg.jscSumEur, cur)}, RRP ${fmtMoney(agg.rrpSumEur, cur)}) 규모로,`);
  if (filtered) {
    parts.push(`<span class="diag-filter-tag">필터 적용 ${fmtNum(totalUnfiltered)} → ${fmtNum(agg.totalSkus)}</span>로 좁힌 결과,`);
  }

  // 매입율 평가
  if (agg.jscSumEur === 0 && agg.rrpSumEur > 0) {
    parts.push(`도매가(JSC/WHS) 컬럼이 부재해 매입율 계산이 불가능하므로 RRP 기준만 참고할 수 있다.`);
  } else if (buyPct < 15) {
    parts.push(`가중평균 매입율은 <b>${buyPct.toFixed(1)}%</b>로 일반 시즌오퍼 도매(30~50%)보다 훨씬 깊은 할인이라 시즌오프·클리어런스 가능성이 높고, 휴리스틱이 일반 도매를 가정한 만큼 점수가 위로 치우칠 수 있다.`);
  } else if (buyPct < 30) {
    parts.push(`가중평균 매입율은 <b>${buyPct.toFixed(1)}%</b>로 일반 시즌오퍼 평균 이하라 매입 조건은 양호한 편이고,`);
  } else if (buyPct < 50) {
    parts.push(`가중평균 매입율은 <b>${buyPct.toFixed(1)}%</b>로 일반 시즌오퍼 평균대이며,`);
  } else {
    parts.push(`가중평균 매입율은 <b>${buyPct.toFixed(1)}%</b>로 평균 이상이라 가격 협상 여지를 살펴볼 만하다.`);
  }

  // 등급 분포 (종합 등급은 결론에서 다뤘으니 분포만)
  parts.push(`등급 분포는 ${gradeText}로`);
  parts.push(`(가중평균 ${fmtScore(agg.weightedScore)}점, <span class="overall-grade-badge g-${agg.overallGrade.cls}">${agg.overallGrade.label}</span>),`);

  // 위험·가격모순 (낮으면 한 마디로, 높으면 강조)
  if (riskPct === 0 && mismatchPct < 5) {
    parts.push(`위험 SKU와 가격모순 모두 미미해 시그널은 안정적이다.`);
  } else if (riskPct < 5) {
    parts.push(`위험 SKU는 ${fmtNum(agg.riskCount)}건(${riskPct.toFixed(1)}%)로 낮아 개별 검토면 충분하나,`);
    if (mismatchPct >= 5) parts.push(`가격모순이 ${mismatchPct.toFixed(1)}% 발생해 해당 SKU의 디테일 패널 확인이 필요하다.`);
    else parts.push(`가격모순도 거의 없어 시그널은 안정적이다.`);
  } else if (riskPct < 20) {
    parts.push(`위험 SKU는 ${fmtNum(agg.riskCount)}건(${riskPct.toFixed(1)}%)로 군집이 일부 보여 거부 SKU 선별이 필요하고,`);
    parts.push(mismatchPct >= 5
      ? `가격모순도 ${mismatchPct.toFixed(1)}% 함께 나타나 디테일 패널을 함께 점검해야 한다.`
      : `가격모순은 미미하다.`);
  } else {
    parts.push(`위험 SKU가 ${fmtNum(agg.riskCount)}건(${riskPct.toFixed(1)}%)로 비중이 높아 오퍼 전반 재협상이 필요하고,`);
    parts.push(mismatchPct >= 5
      ? `가격모순도 ${mismatchPct.toFixed(1)}%로 함께 누적되어 협상 카드로 활용할 만하다.`
      : `가격모순은 적어 위험은 등급·매입율 측면이다.`);
  }

  // 구성
  parts.push(`구성 측면에선 카테고리 ${catText}, 성별 ${genText}이 주축이다.`);

  // 외환·결정 보조
  const fxOrigin = ctxMeta.currencySource ? ` (${ctxMeta.currencySource})` : '';
  parts.push(`KRW 환산은 <span class="diag-fx-tag">${cur} × ${fxRate.toLocaleString()}</span> 가정값${fxOrigin}이며 실시간 환율 변동은 미반영이라, 외부 보고 시 이 가정을 함께 인용해야 한다.`);

  // 협상 카드 (결론에 따라 한 문장 보강)
  if (verdictTone === 'caution' && verdictLabel.includes('재협상')) {
    parts.push(`협상 카드로는 위험 SKU 비중·가격모순 사례·등급 하위 분포를 함께 제시할 수 있다.`);
  } else if (verdictLabel.includes('선별')) {
    parts.push(`TOP 20과 등급 70점 이상을 우선 매입하고, 나머지는 개별 검토 후 결정하라.`);
  } else if (verdictLabel.includes('전반 매입')) {
    parts.push(`TOP 20에 더해 등급 70점 이상 자동 매입까지 검토할 만하다.`);
  } else if (verdictLabel.includes('신중')) {
    parts.push(`재협상이 어렵다면 일부만 채택하고, 매입 조건(결제·MOQ·도착) 재검토를 병행하라.`);
  } else if (verdictLabel.includes('도매가 부재')) {
    parts.push(`벤더에 JSC/WHS 컬럼 추가 송부를 요청하거나, RRP×표준 도매율로 추정 매입율을 산정해 협상에 활용하라.`);
  }

  // 매입율 적용 / 충돌 안내 — narrative 끝에 추가
  if (ctxApplied && ctxBuyRate !== null) {
    const ctxPct = (ctxBuyRate * 100).toFixed(1);
    const src = cons?.buyRateSource ? ` ("${cons.buyRateSource}")` : '';
    if (buyRateMismatch) {
      const dataPct = (dataBuyRate * 100).toFixed(1);
      parts.push(`<b>⚠️ 매입율 적용 안내:</b> 매입 고려 사항에 명시된 매입율 <b>${ctxPct}%</b>${src}을 모든 SKU에 적용해 분석했다. 단, 원본 데이터의 JSC 컬럼 평균 매입율은 <b>${dataPct}%</b>로 차이가 크다 — 데이터의 JSC가 추가 할인 적용 *전* 가격이거나 컬럼 의미가 다를 수 있으니 벤더·BI 데이터 양쪽을 다시 확인하라.`);
    } else if (dataBuyRate !== null && dataBuyRate > 0) {
      parts.push(`매입 고려 사항에 명시된 매입율 <b>${ctxPct}%</b>${src}을 모든 SKU에 적용해 분석했다 (원본 데이터 매입율 ${(dataBuyRate * 100).toFixed(1)}%와 거의 일치).`);
    } else {
      parts.push(`데이터의 JSC 컬럼이 부재하거나 비어 매입 고려 사항에 명시된 매입율 <b>${ctxPct}%</b>${src}을 모든 SKU에 적용해 분석했다.`);
    }
  } else if (cons?.buyRate !== null && cons) {
    // 추출됐지만 적용 안 됨 (예: rrp 합이 0이라 적용 의미 없음)
    const ctxPct = (ctxBuyRate * 100).toFixed(1);
    parts.push(`매입 고려 사항에 매입율 <b>${ctxPct}%</b>가 명시되어 있으나 RRP 데이터 부재로 적용되지 않았다.`);
  }

  const narrative = parts.join(' ');

  // ── 결론 톤별 색상 ───────────────────────────────────────────
  const toneClass = verdictTone === 'good' ? 'verdict-good'
                  : verdictTone === 'caution' ? 'verdict-caution'
                  : 'verdict-mixed';

  // ── 컨텍스트 추출 박스 (cons에 어느 항목이라도 잡혔을 때만) ──
  let consBox = '';
  if (cons && (cons.buyRate !== null || cons.moq || cons.incoterm || cons.leadTime)) {
    const items = [];
    if (cons.buyRate !== null) {
      const pct = (cons.buyRate * 100).toFixed(1);
      const dpct = cons.discountPct !== null ? cons.discountPct.toFixed(0) : null;
      // 적용 상태 칩:
      //   - 적용됨 + 원본 데이터 매입율 차이 큼 → 노랑 ("적용됨 · 원본 X%")
      //   - 적용됨 + 거의 일치 → 녹색 ("적용됨 · 원본 X%")
      //   - 적용됨 + 원본 없음 → 보라 ("적용됨")
      //   - 적용 안 됨 → 비교만
      let cmpHtml = '';
      if (ctxApplied) {
        if (dataBuyRate !== null && dataBuyRate > 0) {
          const dataPct = (dataBuyRate * 100).toFixed(1);
          cmpHtml = `<span class="cons-cmp ${buyRateMismatch ? 'cons-cmp-warn' : 'cons-cmp-match'}">분석 적용됨 · 원본 ${dataPct}%</span>`;
        } else {
          cmpHtml = `<span class="cons-cmp cons-cmp-applied">분석 적용됨</span>`;
        }
      } else if (dataBuyRate !== null && dataBuyRate > 0) {
        const dataPct = (dataBuyRate * 100).toFixed(1);
        cmpHtml = `<span class="cons-cmp ${buyRateMismatch ? 'cons-cmp-warn' : 'cons-cmp-match'}">데이터 ${dataPct}%</span>`;
      }
      items.push(`
        <div class="cons-item">
          <div class="cons-item-label">매입율</div>
          <div class="cons-item-value">${pct}%${dpct ? ` <span class="cons-item-meta">(${dpct}% off)</span>` : ''}</div>
          <div class="cons-item-cmp">${cmpHtml}</div>
        </div>`);
    }
    if (cons.moq) {
      const cur = cons.moq.currency || '';
      const fmt = cons.moq.value >= 1000
        ? (cons.moq.value / 1000).toFixed(0) + 'K'
        : cons.moq.value.toLocaleString();
      items.push(`
        <div class="cons-item">
          <div class="cons-item-label">MOQ</div>
          <div class="cons-item-value">${cur ? cur + ' ' : ''}${fmt}</div>
          <div class="cons-item-cmp"></div>
        </div>`);
    }
    if (cons.incoterm) {
      items.push(`
        <div class="cons-item">
          <div class="cons-item-label">인코텀</div>
          <div class="cons-item-value">${cons.incoterm.term}${cons.incoterm.location ? ` · ${cons.incoterm.location}` : ''}</div>
          <div class="cons-item-cmp"></div>
        </div>`);
    }
    if (cons.leadTime) {
      const lt = cons.leadTime;
      const range = lt.min === lt.max ? `${lt.min} ${lt.unit}` : `${lt.min}~${lt.max} ${lt.unit}`;
      items.push(`
        <div class="cons-item">
          <div class="cons-item-label">리드타임</div>
          <div class="cons-item-value">${range}</div>
          <div class="cons-item-cmp"></div>
        </div>`);
    }

    consBox = `
      <div class="cons-box ${buyRateMismatch ? 'cons-box-warn' : ''}" data-testid="considerations-extracted">
        <div class="cons-box-head">
          <span class="cons-box-title">매입 고려 사항에서 추출</span>
          <span class="cons-box-hint">자유양식 텍스트에서 룰 기반으로 인식된 항목</span>
        </div>
        <div class="cons-grid">
          ${items.join('')}
        </div>
      </div>
    `;
  }

  // ── 보조 KPI 4종 (진단 카드 안 — verdict 앞에 근거 수치로 배치) ──
  // 이전: 대시보드 탭의 #kpi-grid-secondary 별도 섹션.
  // 이동 사유: verdict(권고)를 뒷받침하는 수치 → 위계 (cons → verdict → KPI → narrative)
  const matchedSkus = ctxMeta.matchedSkus ?? 0;
  const matchPct = agg.totalSkus > 0 ? matchedSkus / agg.totalSkus : 0;
  const diagKpiGrid = `
    <div class="diag-kpi-grid" data-testid="kpi-grid-secondary">
      ${kpiCard('가중평균 점수', fmtScore(agg.weightedScore), `단순 ${fmtScore(agg.simpleScore)}`)}
      ${kpiCard('위험 SKU', fmtNum(agg.riskCount), `${(agg.totalSkus ? agg.riskCount/agg.totalSkus*100 : 0).toFixed(1)}%`)}
      ${kpiCard('가격모순', fmtNum(agg.pricingMismatchCount), `심리가 < 목표가`)}
      ${kpiCard('중심가 매칭률', fmtPct(matchPct), `${matchedSkus}/${agg.totalSkus} (db만 매칭)`)}
    </div>
  `;

  container.innerHTML = `
    <h3 class="hero-section-title">
      <span class="hero-section-scope">진단 요약</span>
      <span class="hero-section-eyebrow">MD 의사결정 보조 · 룰 기반 분석</span>
    </h3>
    <div class="diagnosis-block" data-testid="diagnosis-text">
      ${consBox}
      <div class="diag-verdict ${toneClass}" data-testid="diag-verdict">
        <span class="diag-verdict-label">권고</span>
        <span class="diag-verdict-text">${verdictLabel}</span>
      </div>
      ${diagKpiGrid}
      <div class="diag-prose">
        <p>${narrative}</p>
      </div>
    </div>
  `;
}

// ── MD 컨텍스트 입력 (메일 / 매입 조건 / 메모) ────────────────
// IndexedDB static_assets 영속 (key=`offer-ctx-{batchId}`).
// 자동 저장 (debounce 800ms).
export function renderMdContext(container, ctx, onSave) {
  const v = ctx || { mailContent: '', conditions: '', mdNotes: '', savedAt: null };
  const savedAtTxt = v.savedAt
    ? `마지막 저장 ${new Date(v.savedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })}`
    : '아직 저장 안 됨';

  container.innerHTML = `
    <div class="md-context" data-testid="md-context">
      <div class="md-context-head">
        <h4>오퍼 컨텍스트 — 메일·조건·메모 (MD 직접 입력)</h4>
        <span class="md-context-status saved" data-testid="md-context-status">${savedAtTxt}</span>
      </div>

      <div class="md-field md-field-mail">
        <label class="md-field-label" for="md-mail">
          <span class="md-field-icon">📧</span>
          메일 내용 (벤더 발송 메일 본문 / 발주 컨디션 등 원문 그대로)
        </label>
        <textarea id="md-mail" data-testid="md-mail"
                  placeholder="벤더 메일 원문을 그대로 붙여넣으세요. 결제 조건, 도착 일정, 최소 주문량, 환불·반품 정책, 추가 할인 조건 등 오퍼 Excel에 안 들어간 정보를 보존하기 위함.">${escHtml(v.mailContent)}</textarea>
      </div>

      <div class="md-field md-field-conditions">
        <label class="md-field-label" for="md-conditions">
          <span class="md-field-icon">📋</span>
          매입 조건 요약 (메일에서 추출한 핵심 조건)
        </label>
        <textarea id="md-conditions" data-testid="md-conditions"
                  placeholder="예) 결제 30일 외상 / MOQ 10개 / FOB 부산 / 시즌오프 추가 5% / 도착 2026-08-15">${escHtml(v.conditions)}</textarea>
      </div>

      <div class="md-field md-field-memo">
        <label class="md-field-label" for="md-memo">
          <span class="md-field-icon">📝</span>
          MD 메모 (의사결정 근거·우려사항·주의사항)
        </label>
        <textarea id="md-memo" data-testid="md-memo"
                  placeholder="예) 작년 봄 비슷한 카테고리 셀스루 71%. 가격은 좋으나 사이즈 분포가 M에 편중. 반품 정책 확인 필요.">${escHtml(v.mdNotes)}</textarea>
      </div>
    </div>
  `;

  const status = container.querySelector('[data-testid="md-context-status"]');
  let timer = null;
  function schedule() {
    if (status) {
      status.textContent = '저장 중…';
      status.classList.remove('saved'); status.classList.add('saving');
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const next = {
        mailContent: container.querySelector('#md-mail').value,
        conditions:  container.querySelector('#md-conditions').value,
        mdNotes:     container.querySelector('#md-memo').value,
        savedAt:     new Date().toISOString()
      };
      try {
        await onSave(next);
        if (status) {
          const t = new Date(next.savedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' });
          status.textContent = `저장됨 · ${t}`;
          status.classList.remove('saving'); status.classList.add('saved');
        }
      } catch (e) {
        console.error('[md-context save]', e);
        if (status) { status.textContent = '저장 실패: ' + e.message; status.classList.remove('saving','saved'); }
      }
    }, 800);
  }
  ['#md-mail', '#md-conditions', '#md-memo'].forEach(sel => {
    const el = container.querySelector(sel);
    if (el) el.addEventListener('input', schedule);
  });
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ── 메인 렌더 (전체 분석 탭 — 통계 8종만. 보조 KPI 4종은 진단 카드로 이동됨) ──
export function renderDashboard(container, diagnoses, offers = null) {
  const a = aggregateOffer(diagnoses, offers);

  container.innerHTML = `
    <div class="dash">
      <!-- 통계 8종 (등급 분포 + 7종) — 4 × 2 그리드 -->
      <div class="dash-section">
        <h3>통계 8종</h3>
        <div class="dash-stats-grid" data-testid="stats-grid">
          <div class="dash-stat dash-stat-grade">
            <h4>등급 분포 <span class="dash-stat-meta">heuristic.label</span></h4>
            <div id="dash-grade-dist" data-testid="grade-distribution"></div>
          </div>
          <div class="dash-stat"><h4>카테고리(복종)</h4><div id="stat-category"></div></div>
          <div class="dash-stat"><h4>성별</h4><div id="stat-gender"></div></div>
          <div class="dash-stat"><h4>사이즈 (TOP 10)</h4><div id="stat-size"></div></div>
          <div class="dash-stat"><h4>컬러 (TOP 10)</h4><div id="stat-color"></div></div>
          <div class="dash-stat"><h4>시즌</h4><div id="stat-season"></div></div>
          <div class="dash-stat"><h4>수량 분포</h4><div id="stat-qty"></div></div>
          <div class="dash-stat">
            <h4>가격대 <span class="toggle-bucket" data-testid="bucket-toggle">
              <button class="active" data-kind="jsc">JSC</button><button data-kind="rrp">RRP</button>
            </span></h4>
            <div id="stat-price"></div>
          </div>
        </div>
      </div>

    </div>
  `;

  // 등급 분포 — 등급별로 다른 색 (Linear의 priority 누적 막대 패턴)
  const gradeData = Object.entries(a.gradeDistribution)
    .map(([label, info]) => ({ label, value: info.count, qty: info.qty, cls: info.cls }))
    .sort((a, b) => Number(b.cls) - Number(a.cls));
  // 등급은 의미 색상: A/B 녹/노랑, C/D 회색
  const gradeColors = gradeData.map(d => {
    const c = Number(d.cls);
    if (c >= 70) return tokenColor('--signal-success');
    if (c >= 50) return tokenColor('--signal-warning');
    return tokenColor('--text-tertiary');
  });
  renderBarChart(
    container.querySelector('#dash-grade-dist'),
    gradeData,
    { width: 640, colors: gradeColors, valueFmt: (v, d) => `${v}건 / ${fmtNum(d.qty)}수량` }
  );

  // 통계 7종 — 각 차트마다 다른 팔레트 오프셋으로 다채롭게
  const catData = topN(a.byCategory, 5);
  renderBarChart(container.querySelector('#stat-category'),
    catData, { colors: makeColors(catData.length, 0), valueFmt: (v) => `${v}건` });
  const genData = topN(a.byGender, 5);
  renderBarChart(container.querySelector('#stat-gender'),
    genData, { colors: makeColors(genData.length, 2), valueFmt: (v) => `${v}건` });
  const sizeData = topN(a.bySize, 10);
  renderBarChart(container.querySelector('#stat-size'),
    sizeData, { colors: makeColors(sizeData.length, 4), valueFmt: (v) => `${v}건` });
  const colorData = topN(a.byColor, 10);
  renderBarChart(container.querySelector('#stat-color'),
    colorData, { colors: makeColors(colorData.length, 6), valueFmt: (v) => `${v}건` });
  const seasonData = topN(a.bySeason, 5);
  renderBarChart(container.querySelector('#stat-season'),
    seasonData, { colors: makeColors(seasonData.length, 1), valueFmt: (v) => `${v}건` });

  // 수량 분포 — 5 bin 히스토그램
  const qd = a.qtyDistribution;
  const qtyBins = [
    { label: `0~p25 (≤${qd.p25})`,        value: 0 },
    { label: `p25~p50`,                   value: 0 },
    { label: `p50~p75`,                   value: 0 },
    { label: `p75~max`,                   value: 0 },
    { label: `평균 ${qd.mean} / max ${qd.max}`, value: 0 }
  ];
  for (const { d, o } of diagnoses.map((d, i) => ({ d, o: (offers && offers[i]) || d.offer || {} }))) {
    const q = Number(o.qty) || 0;
    if (q <= qd.p25)        qtyBins[0].value += 1;
    else if (q <= qd.p50)   qtyBins[1].value += 1;
    else if (q <= qd.p75)   qtyBins[2].value += 1;
    else                    qtyBins[3].value += 1;
  }
  qtyBins[4].value = qd.mean; // 마지막 막대는 평균값을 시각화
  const qtySlice = qtyBins.slice(0, 4);
  renderBarChart(container.querySelector('#stat-qty'), qtySlice,
    { colors: makeColors(qtySlice.length, 3), valueFmt: (v) => `${v}건` });

  // 가격대 — JSC / RRP 토글 (kind별 다른 단색 — 토글 변화가 시각적으로 보이도록)
  const renderPrice = (kind) => {
    const buckets = a.priceBuckets[kind];
    const data = Object.entries(buckets).map(([k, v]) => ({ label: k + ' EUR', value: v }));
    renderBarChart(container.querySelector('#stat-price'), data,
      { color: kind === 'jsc' ? T.c2() : T.c3(), valueFmt: (v) => `${v}건` });
  };
  renderPrice('jsc');
  container.querySelectorAll('.toggle-bucket button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.toggle-bucket button').forEach(b => b.classList.toggle('active', b === btn));
      renderPrice(btn.dataset.kind);
    });
  });

  return a;
}
