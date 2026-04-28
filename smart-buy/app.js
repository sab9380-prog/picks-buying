// 스마트 매입 — 메인 앱.
// 단건/일괄 입력 → 진단 → IndexedDB 저장 → 카드/TOP20 렌더 → 결정.

import { normalizeBrandId } from './shared/brand-normalize.js';
import { CATEGORY, GENDER, DECISION, EVENT } from './shared/constants.js';
import {
  openDB, putOffer, putOffersBulk, putDiagnosis, putDecision,
  listDecisions, getDecisionsBySku,
  putStaticAsset, getStaticAsset, seedStaticAssetsFromFetch
} from './shared/db.js';
import { diagnose } from './engine/diagnose.js';
import { rankTop20, rankAll } from './engine/rank.js';

// ── 상태 ────────────────────────────────────────────────────────────
let db = null;
let centerPriceDB = null;
let currentBatchId = null;
let currentDiagnoses = [];
let currentMode = 'bulk';

// ── DOM 헬퍼 ────────────────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const status = (msg) => {
  const bar = $('#status-bar');
  bar.textContent = msg;
  bar.classList.add('show');
};

// ── 초기화 ──────────────────────────────────────────────────────────
async function init() {
  status('초기화 중…');
  db = await openDB();
  // 정적 자산 시드 (이미 있으면 skip)
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
  bindUI();
  status('준비 완료. Excel 업로드 또는 단건 입력으로 시작.');
}

// ── UI 바인딩 ───────────────────────────────────────────────────────
function bindUI() {
  // 모드 토글
  $$('.mode-toggle button').forEach(b => {
    b.addEventListener('click', () => {
      currentMode = b.dataset.mode;
      $$('.mode-toggle button').forEach(x => x.classList.toggle('active', x === b));
      $('#panel-bulk').style.display   = currentMode === 'bulk'   ? 'block' : 'none';
      $('#panel-single').style.display = currentMode === 'single' ? 'block' : 'none';
    });
  });

  // 단건 폼
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

  // 파일 드롭
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

  // 탭
  $$('.tabs button').forEach(b => {
    b.addEventListener('click', () => {
      $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
      const tab = b.dataset.tab;
      $('#tab-content-top20').style.display = tab === 'top20' ? 'block' : 'none';
      $('#tab-content-all').style.display   = tab === 'all'   ? 'block' : 'none';
    });
  });
}

// ── Excel 처리 ──────────────────────────────────────────────────────
async function handleFile(file) {
  status(`파일 로드 중: ${file.name}`);
  // SheetJS lazy load
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

// ── 오퍼 객체 변환 ──────────────────────────────────────────────────
function parseRow(row, batchId, idx) {
  // 컬럼명 case-insensitive lookup
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
    batchId,
    skuId,
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

  // 진단 + offer 첨부 (UI 표시용)
  const diagnoses = offers.map(o => {
    const d = diagnose(o, { centerPriceDB });
    return { ...d, offer: o };
  });
  for (const d of diagnoses) await putDiagnosis(db, d);
  currentDiagnoses = diagnoses;

  $('#results-section').style.display = 'block';
  renderTop20(diagnoses);
  renderAll(diagnoses);
  status(`진단 완료 — ${diagnoses.length}건 (TOP 20 표시)`);
}

// ── 렌더링 ──────────────────────────────────────────────────────────
function renderTop20(diagnoses) {
  const top = rankTop20(diagnoses);
  const container = $('#tab-content-top20');
  if (!top.length) {
    container.innerHTML = '<div class="empty-state">진단 결과 없음 (모두 키즈 제외 등)</div>';
    return;
  }
  // 표 + 카드 혼합
  const rows = top.map((d, i) => `
    <tr>
      <td><b>${i + 1}</b></td>
      <td>${esc(getOfferTitle(d))}</td>
      <td><span class="grade-badge g-${d.heuristic.cls}">${esc(d.heuristic.label)}</span></td>
      <td>${d.heuristic.total}</td>
      <td>${d._rankScore}</td>
      <td>${d.pricing.targetPriceKrw ? d.pricing.targetPriceKrw.toLocaleString() + '원' : '-'}</td>
      <td>${d.pricing.centerPriceFound ? d.pricing.customerPsychPriceKrw.toLocaleString() + '원' : '<span style="color:var(--muted)">데이터 없음</span>'}</td>
      <td class="actions-cell" data-skuid="${d.skuId}"></td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table data-testid="top20-table">
      <thead>
        <tr><th>#</th><th>SKU</th><th>등급</th><th>휴리스틱</th><th>랭크 점수</th><th>목표가</th><th>고객심리가</th><th>결정</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  // 결정 버튼 동적 삽입 (XSS 방지)
  for (const d of top) {
    const cell = container.querySelector(`td.actions-cell[data-skuid="${d.skuId.replace(/"/g, '\\"')}"]`);
    if (cell) cell.appendChild(renderActions(d));
  }
}

function renderAll(diagnoses) {
  const all = rankAll(diagnoses);
  const container = $('#tab-content-all');
  if (!all.length) { container.innerHTML = '<div class="empty-state">데이터 없음</div>'; return; }
  container.innerHTML = '<div class="results"></div>';
  const grid = container.querySelector('.results');
  for (const d of all) grid.appendChild(buildCard(d));
}

function buildCard(d) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.skuid = d.skuId;
  card.innerHTML = `
    <div>
      <h3>${esc(getOfferTitle(d))}</h3>
      <div class="sub">${esc(getOfferSub(d))}</div>
    </div>
    <div>
      <span class="grade-badge g-${d.heuristic.cls}">${esc(d.heuristic.label)}</span>
      <span style="font-size:12px;color:var(--muted);margin-left:8px;">총 ${d.heuristic.total}점 · 랭크 ${d._rankScore}</span>
    </div>
    <div class="scores">
      <div>브랜드 <b>${d.heuristic.brand}</b></div>
      <div>컬러 <b>${d.heuristic.color}</b></div>
      <div>사이즈 <b>${d.heuristic.size}</b></div>
      <div>가격 <b>${d.heuristic.price}</b></div>
      <div>시즌 <b>${d.heuristic.season}</b></div>
      <div>키워드 <b>${d.heuristic.keywordBonus >= 0 ? '+' : ''}${d.heuristic.keywordBonus}</b></div>
    </div>
    <div class="price-block">
      <div><span>랜디드</span><b>${d.pricing.landedCostKrw ? d.pricing.landedCostKrw.toLocaleString() + '원' : '-'}</b></div>
      <div><span>목표가</span><b>${d.pricing.targetPriceKrw ? d.pricing.targetPriceKrw.toLocaleString() + '원' : '-'}</b></div>
      <div><span>고객심리가</span><b>${d.pricing.centerPriceFound ? d.pricing.customerPsychPriceKrw.toLocaleString() + '원' : '<span style="color:var(--muted)">데이터 없음</span>'}</b></div>
      ${d.pricing.psychRatio ? `<div><span>심리가대비</span><b>${(d.pricing.psychRatio * 100).toFixed(1)}%</b></div>` : ''}
    </div>
    ${d.diagnosisItems?.decisionDeadline
      ? `<div class="deadline">${d.diagnosisItems.decisionDeadline.tier} 결정시한 ${d.diagnosisItems.decisionDeadline.weeks}주</div>`
      : ''}
    ${d.diagnosisItems?.riskSignals?.length
      ? `<div class="deadline" style="color:var(--counter)">⚠ ${d.diagnosisItems.riskSignals.join(', ')}</div>`
      : ''}
  `;
  card.appendChild(renderActions(d));
  return card;
}

function renderActions(d) {
  const wrap = document.createElement('div');
  wrap.className = 'actions';
  for (const action of [DECISION.BUY, DECISION.COUNTER, DECISION.PASS]) {
    const b = document.createElement('button');
    b.className = `btn-${action.toLowerCase()}`;
    b.textContent = action;
    b.dataset.testid = `btn-${action.toLowerCase()}`;
    b.dataset.skuid = d.skuId;
    b.addEventListener('click', () => recordDecision(d, action, b));
    wrap.appendChild(b);
  }
  return wrap;
}

async function recordDecision(diagnosis, decision, btn) {
  const decisionObj = {
    decisionId: 'DEC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    skuId: diagnosis.skuId,
    batchId: diagnosis.batchId,
    decision,
    diagnosisSnapshot: diagnosis,
    decidedAt: new Date().toISOString()
  };
  await putDecision(db, decisionObj);
  // visual feedback
  btn.classList.add('decided');
  status(`결정 저장: ${decision} → ${diagnosis.skuId}`);
}

// ── helpers ─────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function getOfferTitle(d) {
  if (d.offer) return `${d.offer.brand} ${d.offer.style}`;
  return d.skuId;
}
function getOfferSub(d) {
  if (d.offer) {
    return `${d.offer.color} · ${d.offer.size} · ${d.offer.category}/${d.offer.gender} · ${d.offer.season || '시즌미상'}`;
  }
  return d.heuristic.keywordMatched.join(', ') || '키워드 없음';
}

// ── 시작 ───────────────────────────────────────────────────────────
init().catch(e => {
  console.error(e);
  status('초기화 실패: ' + e.message);
});

// 옆 메뉴 통합 디버그용: 결정 이벤트 콘솔 로그
window.addEventListener(EVENT.DECISION_MADE, (e) => {
  console.log('[picks:decision-made]', e.detail);
});
