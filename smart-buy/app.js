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
import { renderDashboard } from './dashboard.js';
import { renderSkuTable } from './sku-table.js';

// ── 상태 ────────────────────────────────────────────────────────────
let db = null;
let centerPriceDB = null;
let offerMcMap = null;
let currentBatchId = null;
let currentDiagnoses = [];
let currentDecisions = [];
let currentMode = 'bulk';

// ── DOM 헬퍼 ────────────────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const status = (msg) => {
  const bar = $('#status-bar');
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
  status('준비 완료. Excel 업로드 또는 단건 입력으로 시작.');
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
    $('#results-section').style.display = 'block';
    renderAllTabs(diagnoses);
  } catch (e) {
    console.warn('마지막 batch 복원 실패:', e.message);
  }
}

// ── UI 바인딩 ───────────────────────────────────────────────────────
function bindUI() {
  $$('.mode-toggle button').forEach(b => {
    b.addEventListener('click', () => {
      currentMode = b.dataset.mode;
      $$('.mode-toggle button').forEach(x => x.classList.toggle('active', x === b));
      $('#panel-bulk').style.display   = currentMode === 'bulk'   ? 'block' : 'none';
      $('#panel-single').style.display = currentMode === 'single' ? 'block' : 'none';
    });
  });

  $('#single-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const o = Object.fromEntries(fd.entries());
    const offer = toOffer({
      brand: o.brand, style: o.style, color: o.color, size: o.size,
      category: o.category, gender: o.gender, product: o.product, sports: o.sports,
      jsc: parseFloat(o.jsc) || 0, rrp: parseFloat(o.rrp) || 0,
      qty: parseInt(o.qty, 10) || 0, season: o.season
    }, 'BATCH-SINGLE-' + Date.now(), 0);
    await processOffers([offer]);
  });

  const drop = $('#file-drop');
  const input = $('#file-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault(); drop.classList.remove('over');
    if (e.dataTransfer.files[0]) await handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', async (e) => {
    if (e.target.files[0]) await handleFile(e.target.files[0]);
  });

  $$('.tabs button').forEach(b => {
    b.addEventListener('click', () => {
      const tab = b.dataset.tab;
      $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
      $('#tab-content-dashboard').hidden = tab !== 'dashboard';
      $('#tab-content-top20').hidden     = tab !== 'top20';
      $('#tab-content-all').hidden       = tab !== 'all';
    });
  });
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
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

  const batchId = 'BATCH-' + Date.now();
  const offers = rows.map((r, i) => parseRow(r, batchId, i));
  status(`${offers.length}건 진단 시작…`);
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
    arrivalMonth: raw.arrivalMonth || ''
  };
}

// ── 진단 + 저장 + 렌더 ──────────────────────────────────────────────
async function processOffers(offers) {
  await putOffersBulk(db, offers);
  currentBatchId = offers[0].batchId;

  const diagnoses = offers.map(o => {
    const d = diagnose(o, { centerPriceDB, offerMcMap });
    return { ...d, offer: o };
  });
  for (const d of diagnoses) await putDiagnosis(db, d);
  currentDiagnoses = diagnoses;

  $('#results-section').style.display = 'block';
  renderAllTabs(diagnoses);
  status(`진단 완료 — ${diagnoses.length}건`);
}

function renderAllTabs(diagnoses) {
  renderDashboard($('#tab-content-dashboard'), diagnoses);

  const top = rankTop20(diagnoses);
  renderSkuTable($('#tab-content-top20'), top, {
    testId: 'top20-table',
    decisions: currentDecisions,
    onDecision: handleDecision,
    defaultSortKey: 'score',
    defaultSortDir: 'desc'
  });

  const all = rankAll(diagnoses);
  renderSkuTable($('#tab-content-all'), all, {
    testId: 'all-sku-table',
    decisions: currentDecisions,
    onDecision: handleDecision,
    defaultSortKey: '_idx',
    defaultSortDir: 'asc'
  });
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
  status(`결정 저장: ${decision} → ${diagnosis.skuId}`);
  return decisionObj;
}

// ── 시작 ───────────────────────────────────────────────────────────
init().catch(e => {
  console.error(e);
  status('초기화 실패: ' + e.message);
});

window.addEventListener(EVENT.DECISION_MADE, (e) => {
  console.log('[picks:decision-made]', e.detail);
});
