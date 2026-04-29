// 스마트 매입 — 메인 앱.
// 입력 → 진단 → IndexedDB 저장 → 대시보드/TOP20/전체 SKU 표 렌더 → 결정.

import { normalizeBrandId } from './shared/brand-normalize.js';
import { CATEGORY, GENDER, DECISION, EVENT } from './shared/constants.js';
import {
  openDB, putOffer, putOffersBulk, putDiagnosis, putDecision,
  listDecisions, getDecisionsBySku, listOffers, listDiagnosesByBatch,
  putStaticAsset, getStaticAsset, seedStaticAssetsFromFetch
} from './shared/db.js';
import { diagnose } from './engine/diagnose.js';
import { rankTop20, rankAll } from './engine/rank.js';
import {
  renderDashboard, renderHero, renderSeasonBreakdown, renderSeasonSummary,
  renderFilters, renderDiagnosisText, aggregateBySeasons,
  aggregateByBrands, renderBrandSummary,
  extractConsiderations, fxAnnotation
} from './dashboard.js';
import { aggregateOffer } from './engine/aggregate.js';
import { renderSkuTable } from './sku-table.js';
import { renderTableControls, applyControls } from './shared/table-controls.js';
import { loadVendorConfigs, detectVendor, applyVendor, autoDetectFormat } from './vendor-adapter.js';

// ── 상태 ────────────────────────────────────────────────────────────
let db = null;
let centerPriceDB = null;
let offerMcMap = null;
let currentBatchId = null;
let currentDiagnoses = [];
let currentDecisions = [];
let currentBatchCurrencySource = '';   // "CURRENCY 컬럼 (X)" 등 — 진단 텍스트 주석용
let pendingFile = null;                // 사용자가 파일 선택만 하고 제출 전 임시 보관

// ── DOM 헬퍼 ────────────────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const status = (msg) => {
  const bar = $('#status-bar');
  if (!bar) return;
  bar.textContent = msg;
  bar.classList.add('show');
};
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ── 초기화 ──────────────────────────────────────────────────────────
async function init() {
  status('초기화 중…');
  db = await openDB();
  let cached = await getStaticAsset(db, 'center-price-db');
  if (!cached) {
    status('데이터 자산 시드 중…');
    try {
      await seedStaticAssetsFromFetch(db, './data/');
      cached = await getStaticAsset(db, 'center-price-db');
    } catch (e) {
      console.warn('seed 실패 — fetch 불가능한 환경일 수 있음:', e.message);
    }
  }
  centerPriceDB = cached;
  offerMcMap = await getStaticAsset(db, 'offer-mc-map');

  currentDecisions = await listDecisions(db);
  await restoreLastBatch();

  bindUI();
  status('준비 완료. Excel 업로드로 시작.');
}

async function restoreLastBatch() {
  try {
    const all = await listOffers(db);
    if (!all.length) return;
    const latestBatch = all.map(o => o.batchId).filter(Boolean).sort().pop();
    if (!latestBatch) return;
    const offers = all.filter(o => o.batchId === latestBatch);
    const stored = await listDiagnosesByBatch(db, latestBatch);
    if (!stored.length) return;
    const offerById = new Map(offers.map(o => [o.skuId, o]));
    const diagnoses = stored.map(d => ({ ...d, offer: offerById.get(d.skuId) }));
    currentBatchId = latestBatch;
    currentDiagnoses = diagnoses;
    // 이전 결과 복원 시 입력 폼은 접어두고 결과 위주로 표시.
    // 새 분석은 헤더 "오퍼 업로드" 클릭 시 다시 펼침.
    const panel = $('#panel-bulk');
    if (panel) panel.setAttribute('hidden', '');
    $('#results-section').style.display = 'block';
    await renderAllTabs(diagnoses);
  } catch (e) {
    console.warn('마지막 batch 복원 실패:', e.message);
  }
}

// ── UI 바인딩 ───────────────────────────────────────────────────────
function bindUI() {
  const input = $('#file-input');

  // 헤더 "오퍼 업로드" — 클릭 시 파일 다이얼로그 (label for=file-input). 추가로
  // panel-bulk를 보장 표시 + 입력 폼으로 스크롤.
  $('#btn-mode-bulk').addEventListener('click', () => {
    const panel = $('#panel-bulk');
    if (panel) panel.removeAttribute('hidden');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // 키보드 접근성: 라벨에 Enter/Space 누르면 input.click()
  $('#btn-mode-bulk').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // file input change — 즉시 분석 X. 임시 보관 + UI 표시.
  input.addEventListener('change', (e) => {
    if (e.target.files[0]) selectFile(e.target.files[0]);
    e.target.value = ''; // 같은 파일 재선택 가능하도록 reset
  });

  // 파일 선택 해제
  $('#file-selected-clear')?.addEventListener('click', () => clearSelectedFile());

  // 분석 시작 버튼
  $('#btn-submit-analysis')?.addEventListener('click', async () => {
    if (!pendingFile) return;
    // 입력 폼의 컨텍스트 값을 임시 캐시 (processOffers 후 batchId 확정되면 이동 저장)
    pendingContextDraft = readInputContextDraft();
    await handleFile(pendingFile);
  });

  // file-drop 영역 클릭 → 파일 다이얼로그
  $('#file-drop')?.addEventListener('click', () => input.click());

  // 윈도우 전체 드래그·드롭 (작은 헤더 버튼이라 영역 보충)
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      dragCounter++;
      document.body.classList.add('drop-active');
    }
  });
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault();
  });
  window.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) document.body.classList.remove('drop-active');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drop-active');
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  $$('.tabs button').forEach(b => {
    b.addEventListener('click', () => {
      const tab = b.dataset.tab;
      $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
      $('#tab-content-overview').hidden = tab !== 'overview';
      $('#tab-content-deep').hidden     = tab !== 'deep';
    });
  });
}

// ── 입력 폼 — 파일 선택/해제 + 컨텍스트 초안 ────────────────────────
let pendingContextDraft = null;   // 입력 폼에서 입력한 컨텍스트 (제출 전)

function selectFile(file) {
  pendingFile = file;
  const sel = $('#file-selected');
  const nm  = $('#file-selected-name');
  const sz  = $('#file-selected-size');
  if (nm) nm.textContent = file.name;
  if (sz) sz.textContent = formatBytes(file.size);
  if (sel) sel.removeAttribute('hidden');
  updateSubmitState();
  status(`선택됨: ${file.name} — '분석 시작' 버튼을 눌러주세요.`);
}

function clearSelectedFile() {
  pendingFile = null;
  const sel = $('#file-selected');
  if (sel) sel.setAttribute('hidden', '');
  updateSubmitState();
  status('파일 선택 취소.');
}

function updateSubmitState() {
  const btn = $('#btn-submit-analysis');
  const hint = $('#submit-hint');
  if (!btn) return;
  if (pendingFile) {
    btn.disabled = false;
    if (hint) hint.textContent = '';
  } else {
    btn.disabled = true;
    if (hint) hint.textContent = '파일을 먼저 선택하세요';
  }
}

function readInputContextDraft() {
  // 통합 textarea — "매입 고려 사항"으로 자유양식 입력.
  // 후방 호환을 위해 considerations 필드에만 값 보관.
  return {
    considerations: $('#considerations-input')?.value ?? '',
    savedAt:        new Date().toISOString()
  };
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

// ── MD 컨텍스트 영속 (IndexedDB static_assets 재사용 — 스키마 변경 없음) ──
async function loadMdContext(batchId) {
  if (!db || !batchId) return null;
  return await getStaticAsset(db, `offer-ctx-${batchId}`);
}
async function saveMdContext(batchId, ctx) {
  if (!db || !batchId) return;
  await putStaticAsset(db, `offer-ctx-${batchId}`, ctx);
}

// ── Excel 처리 ──────────────────────────────────────────────────────
async function handleFile(file) {
  status(`파일 로드 중: ${file.name}`);
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const buf = await file.arrayBuffer();
  const wb  = window.XLSX.read(buf, { type: 'array' });
  const batchId = 'BATCH-' + Date.now();

  // ── 1) 벤더 어댑터 우선 시도 (알려진 벤더 + 자동 탐지)
  let offers = null;
  let detectionPath = '기본 파서';
  try {
    const vendorConfigs = await loadVendorConfigs('./data/vendor-formats/');
    const matched = detectVendor(wb, file.name, vendorConfigs);
    if (matched) {
      // 알려진 벤더 (예: KOOPLES.json)
      status(`${matched.name} 포맷 감지 (벤더 설정) — 어댑터 적용 중…`);
      const rawOffers = applyVendor(window.XLSX, wb, matched.config);
      offers = rawOffers.map((r, i) => toOffer(r, batchId, i));
      detectionPath = `${matched.name} 설정`;
    } else {
      // 자동 휴리스틱 탐지
      status(`자동 포맷 탐지 중…`);
      const auto = autoDetectFormat(window.XLSX, wb, file.name);
      if (auto && auto.ok) {
        status(`자동 탐지 OK — brand=${auto.brand}, ${auto.currency} (${auto.currencySource}), shape=${auto.shape}, header row=${auto.headerRow}`);
        const rawOffers = applyVendor(window.XLSX, wb, auto);
        offers = rawOffers.map((r, i) => toOffer(r, batchId, i));
        currentBatchCurrencySource = auto.currencySource || '';
        detectionPath = `자동탐지 → ${auto.brand} ${auto.currency}`;
      } else if (auto && !auto.ok) {
        console.warn('[vendor-adapter] 자동 탐지 거부:', auto.reason);
        status(`자동 탐지 실패: ${auto.reason} — 기본 파서 시도`);
      }
    }
  } catch (e) {
    console.warn('[vendor-adapter] 적용 실패, 기본 파서로 폴백:', e);
  }

  // ── 2) 폴백: 기존 long-format 파서 (sample-offer.xlsx 등)
  if (!offers) {
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
    offers = rows.map((r, i) => parseRow(r, batchId, i));
  }

  status(`${offers.length}건 진단 시작 (${detectionPath})…`);
  await processOffers(offers);
}

function parseRow(row, batchId, idx) {
  const get = (...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toUpperCase() === k.toUpperCase());
      if (found && row[found] !== '') return row[found];
    }
    return '';
  };
  return toOffer({
    brand:    get('BRAND', '브랜드'),
    style:    get('STYLE', 'NAME', 'MODEL', '모델'),
    color:    get('COLOR', '컬러'),
    size:     String(get('SIZE', '사이즈')),
    category: String(get('CATEGORY', '카테고리')).toUpperCase(),
    gender:   String(get('GENDER', '성별')).toUpperCase(),
    product:  String(get('PRODUCT_TYPE', 'PRODUCT', 'TYPE')).toUpperCase(),
    sports:   String(get('SPORTS')).toUpperCase(),
    jsc:      parseFloat(get('JSC', 'FOB')) || 0,
    rrp:      parseFloat(get('RRP', 'RETAIL')) || 0,
    qty:      parseInt(get('QTY', '수량'), 10) || 0,
    season:   String(get('SEASON', '시즌')).toUpperCase(),
    arrivalMonth: String(get('ARRIVAL', '도착월')),
    channel:  String(get('CHANNEL', '채널')).toUpperCase()
  }, batchId, idx);
}

function toOffer(raw, batchId, idx) {
  const skuId = `${batchId}-${String(idx).padStart(4, '0')}-${(raw.brand || '').slice(0,4)}-${(raw.style || '').slice(0,8)}`.replace(/\s+/g, '_');
  return {
    batchId, skuId,
    brand: raw.brand || '',
    brandId: normalizeBrandId(raw.brand),
    style: raw.style || '',
    color: raw.color || '',
    size: raw.size || '',
    category: raw.category || 'OTHER',
    gender: raw.gender || 'UNISEX',
    product: raw.product || '',
    sports: raw.sports || '',
    jsc: raw.jsc || 0,
    rrp: raw.rrp || 0,
    qty: raw.qty || 0,
    season: raw.season || '',
    channel: raw.channel || '',
    arrivalMonth: raw.arrivalMonth || '',
    currency: (raw.currency || 'EUR').toUpperCase()
  };
}

// ── 진단 + 저장 + 렌더 ──────────────────────────────────────────────
async function processOffers(offers) {
  currentBatchId = offers[0].batchId;

  // ── 컨텍스트 추출 → 매입율 자동 적용 ──────────────────────────
  // 사용자가 매입 고려 사항에 "X% off" 또는 매입율을 명시했고 추출 가능하면,
  // 모든 offer.jsc를 rrp × buyRate로 강제. 원본은 jscOriginal에 보존(비교용).
  // 적용 메타는 saveMdContext에 함께 보관 → restore 시 진단에 표시.
  const ctxText = pendingContextDraft?.considerations || '';
  const extracted = ctxText ? extractConsiderations(ctxText) : null;
  let ctxApplied = false;
  let originalAvgBuyRate = null;

  if (extracted && extracted.buyRate !== null && extracted.buyRate > 0) {
    const totalRrp = offers.reduce((s, o) => s + (Number(o.rrp) || 0), 0);
    const totalJscOrig = offers.reduce((s, o) => s + (Number(o.jsc) || 0), 0);
    originalAvgBuyRate = totalRrp > 0 ? totalJscOrig / totalRrp : 0;

    for (const o of offers) {
      o.jscOriginal = Number(o.jsc) || 0;
      o.jsc = (Number(o.rrp) || 0) * extracted.buyRate;
      o.jscAppliedFrom = 'considerations';
    }
    ctxApplied = true;
  }

  await putOffersBulk(db, offers);

  const diagnoses = offers.map(o => {
    const d = diagnose(o, { centerPriceDB, offerMcMap });
    return { ...d, offer: o };
  });
  for (const d of diagnoses) await putDiagnosis(db, d);
  currentDiagnoses = diagnoses;

  // 입력 폼에서 받은 컨텍스트 초안이 있으면 batchId로 저장.
  // (적용 메타도 함께 보관 — restore 시 진단에 "컨텍스트 매입율 적용됨" 표시 유지)
  if (pendingContextDraft) {
    const ctxToSave = {
      ...pendingContextDraft,
      ctxApplied,
      originalAvgBuyRate
    };
    try { await saveMdContext(currentBatchId, ctxToSave); }
    catch (e) { console.warn('컨텍스트 초안 저장 실패:', e.message); }
    pendingContextDraft = null;
  }
  // 사용 끝난 임시 파일 핸들 정리
  pendingFile = null;
  // 입력 폼 UI 정리: 선택된 파일 해제 + 폼 접기 (결과 위주 표시)
  const fileSelected = $('#file-selected');
  if (fileSelected) fileSelected.setAttribute('hidden', '');
  updateSubmitState();
  const panel = $('#panel-bulk');
  if (panel) panel.setAttribute('hidden', '');

  $('#results-section').style.display = 'block';
  await renderAllTabs(diagnoses);
  // 결과 영역으로 부드럽게 스크롤
  $('#results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  status(`진단 완료 — ${diagnoses.length}건`);
}

// hero / 정보 칩 / 진단 + 탭 콘텐츠 렌더.
// 정보 칩(카테고리/성별/시즌)은 클릭 안 됨 — 분포 표시만.
async function renderAllTabs(allDiagnoses) {
  const currency = allDiagnoses[0]?.offer?.currency || 'EUR';

  // 0) 매입 고려 사항 로드 + 패턴 추출 (자유양식 → 매입율/MOQ/인코텀/리드타임)
  let extractedConsiderations = null;
  let ctxApplied = false;
  let originalAvgBuyRate = null;
  if (currentBatchId) {
    try {
      const ctx = await loadMdContext(currentBatchId);
      const text = ctx?.considerations || '';
      extractedConsiderations = extractConsiderations(text);
      ctxApplied = !!ctx?.ctxApplied;
      originalAvgBuyRate = ctx?.originalAvgBuyRate ?? null;
    } catch (e) {
      console.warn('컨텍스트 로드/추출 실패:', e.message);
    }
  }

  // 0.5) results-head 환율 주석 갱신 (현재 통화 기반)
  const fxNote = $('#results-fx-note');
  if (fxNote) {
    const ann = fxAnnotation(currency);
    fxNote.textContent = ann ? `환율: ${ann}` : '';
  }

  // 1) Hero — 전체 종합행 (시즌별·브랜드별은 별도 카드)
  const agg = aggregateOffer(allDiagnoses);
  agg.currency = currency;
  renderHero($('#hero-summary'), agg);

  // 1.4) 시즌별 핵심 요약 (별도 카드)
  renderSeasonSummary($('#season-summary'), aggregateBySeasons(allDiagnoses), currency);

  // 1.5) 브랜드별 핵심 요약 (별도 카드)
  renderBrandSummary($('#brand-summary'), aggregateByBrands(allDiagnoses), currency);

  // 2) 카테고리/성별/시즌 정보 칩 (표준 분류, 클릭 안 됨)
  renderFilters($('#filter-chips-wrap'), allDiagnoses);

  // 3) 진단 텍스트 (통화 정보 + 환율 가정 + 컨텍스트 추출 결과 + 적용 메타)
  //    보조 KPI 4종은 진단 카드 안에 함께 표시 — verdict 앞에 근거 수치로 배치.
  const matchedSkus = allDiagnoses.filter(d => d.pricing?.psychPriceSource === 'db').length;
  renderDiagnosisText($('#diagnosis-text-wrap'), agg, allDiagnoses.length, {
    currencySource: currentBatchCurrencySource,
    considerations: extractedConsiderations,
    ctxApplied,
    originalAvgBuyRate,
    matchedSkus
  });

  // (이전: 결과 영역에도 MD 컨텍스트 textarea를 렌더했으나, 입력/진단 영역 분리
  //  원칙에 따라 제거. 입력은 입력 폼에서만, 결과 영역은 진단·분석 전용.)

  // 4) 전체 분석 탭의 통계 8종 (헤더·hero·진단은 정적 컨테이너에 위에서 이미 렌더됨)
  renderDashboard($('#overview-stats'), allDiagnoses);

  // 5) 심층 분석 탭 — 토글(TOP 20 / 전체 SKU) + 공통 컨트롤 + 활성 뷰
  const top = rankTop20(allDiagnoses);
  const all = rankAll(allDiagnoses);
  renderDeepTab($('#tab-content-deep'), { top, all });
}

// 심층 분석 탭 렌더 — 한 번에 하나의 표만 보임 (TOP 20 또는 전체 SKU).
// 토글로 전환하며 필터·검색 컨트롤은 공통 적용. 정렬은 각 표 헤더 클릭으로 별도.
// 기본 활성: TOP 20.
function renderDeepTab(container, { top, all }) {
  container.innerHTML = `
    <div class="deep-view-toggle" data-testid="deep-view-toggle" role="tablist">
      <button class="active" data-view="top20" role="tab" aria-selected="true">TOP 20 매입 추천</button>
      <button data-view="all" role="tab" aria-selected="false">전체 SKU 표</button>
    </div>
    <div class="deep-controls" data-testid="deep-controls"></div>
    <div class="deep-view-wrap" data-testid="deep-view-wrap"></div>
  `;

  // 공통 상태 — 토글 + 필터·검색 (양쪽 뷰에 같은 필터 적용)
  const state = {
    view: 'top20',
    search: '',
    selected: { brand: new Set(), category: new Set(), season: new Set(), gender: new Set() }
  };

  const wrap = container.querySelector('[data-testid="deep-view-wrap"]');
  const ctrlWrap = container.querySelector('[data-testid="deep-controls"]');

  function rerenderView() {
    const source = state.view === 'top20' ? top : all;
    const filtered = applyControls(source, state);
    renderSkuTable(wrap, filtered, {
      testId: state.view === 'top20' ? 'top20-table' : 'all-sku-table',
      decisions: currentDecisions,
      onDecision: handleDecision,
      defaultSortKey: state.view === 'top20' ? 'score' : '_idx',
      defaultSortDir: state.view === 'top20' ? 'desc'  : 'asc'
    });
  }

  // 토글 클릭 — view 전환
  container.querySelectorAll('.deep-view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      container.querySelectorAll('.deep-view-toggle button').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      rerenderView();
    });
  });

  // 컨트롤 — 옵션 후보는 전체 SKU 기준으로 추출 (TOP 20보다 풍부)
  renderTableControls(ctrlWrap, all, state, rerenderView);
  rerenderView();
}

async function handleDecision({ diagnosis, decision, memo }) {
  const decisionObj = {
    decisionId: 'DEC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    skuId: diagnosis.skuId,
    batchId: diagnosis.batchId,
    decision,
    memo: memo || '',
    diagnosisSnapshot: diagnosis,
    decidedAt: new Date().toISOString()
  };
  await putDecision(db, decisionObj);
  currentDecisions.push(decisionObj);
  syncDecisionVisuals(diagnosis.skuId, decision);
  status(`결정 저장: ${decision} → ${diagnosis.skuId}`);
  return decisionObj;
}

// 같은 SKU의 모든 결정 버튼(다른 탭 포함)에 'decided' 클래스 동기화.
function syncDecisionVisuals(skuId, decision) {
  const safeSku = skuId.replace(/(["\\])/g, '\\$1');
  document.querySelectorAll(`tr[data-skuid="${safeSku}"] .actions button`).forEach(btn => {
    btn.classList.toggle('decided', btn.dataset.testid === `btn-${decision.toLowerCase()}`);
  });
}

// ── 시작 ───────────────────────────────────────────────────────────
init().catch(e => {
  console.error(e);
  status('초기화 실패: ' + e.message);
});

window.addEventListener(EVENT.DECISION_MADE, (e) => {
  console.log('[picks:decision-made]', e.detail);
});
