// SKU 표 + 우측 디테일 패널 (Phase 4).
// 정렬 가능 컬럼 18종, 가격모순 빨간 배지, 행 클릭 시 디테일 슬라이드 인.

import { DECISION } from './shared/constants.js';

// ── 컬럼 정의 ────────────────────────────────────────────────────
const COLS = [
  { key: '_idx',        label: '#',         num: true,  fmt: (v, d, i) => i + 1, sort: (d, i) => i },
  { key: 'brand',       label: '브랜드',    fmt: (v, d) => esc(d.offer?.brand) },
  { key: 'style',       label: '모델',      fmt: (v, d) => esc(d.offer?.style) },
  { key: 'color',       label: '컬러',      fmt: (v, d) => esc(d.offer?.color) },
  { key: 'size',        label: '사이즈',    fmt: (v, d) => esc(d.offer?.size) },
  { key: 'category',    label: '카테고리',  fmt: (v, d) => esc(d.offer?.category) },
  { key: 'gender',      label: '성별',      fmt: (v, d) => esc(d.offer?.gender) },
  { key: 'season',      label: '시즌',      fmt: (v, d) => esc(d.offer?.season) },
  { key: 'qty',         label: '수량',      num: true,  fmt: (v, d) => d.offer?.qty || 0,
                                                       sort: (d) => d.offer?.qty || 0 },
  { key: 'jsc',         label: 'JSC EUR',   num: true,  fmt: (v, d) => (d.offer?.jsc || 0).toFixed(2),
                                                       sort: (d) => d.offer?.jsc || 0 },
  { key: 'rrp',         label: 'RRP EUR',   num: true,  fmt: (v, d) => (d.offer?.rrp || 0).toFixed(2),
                                                       sort: (d) => d.offer?.rrp || 0 },
  { key: 'buyRate',     label: '매입율',    num: true,
                        fmt: (v, d) => {
                          const j = d.offer?.jsc || 0; const r = d.offer?.rrp || 0;
                          return r > 0 ? (j / r * 100).toFixed(1) + '%' : '-';
                        },
                        sort: (d) => {
                          const j = d.offer?.jsc || 0; const r = d.offer?.rrp || 0;
                          return r > 0 ? j / r : 999;
                        } },
  { key: 'targetPrice', label: '목표가',    num: true,
                        fmt: (v, d) => d.pricing?.targetPriceKrw ? d.pricing.targetPriceKrw.toLocaleString() : '-',
                        sort: (d) => d.pricing?.targetPriceKrw || 0 },
  { key: 'psychPrice',  label: '고객심리가', num: true,
                        fmt: (v, d) => {
                          const p = d.pricing?.customerPsychPriceKrw;
                          if (!p) return '<span style="color:var(--muted)">-</span>';
                          const tag = d.pricing.psychPriceSource === 'rrp_synth' ? ' <span class="src-tag">추정</span>' : '';
                          return p.toLocaleString() + tag;
                        },
                        sort: (d) => d.pricing?.customerPsychPriceKrw || 0 },
  { key: 'psychRatio',  label: '심리가대비', num: true,
                        mismatch: (d) => d.pricing?.psychRatio > 1.0,
                        fmt: (v, d) => d.pricing?.psychRatio ? (d.pricing.psychRatio * 100).toFixed(1) + '%' : '-',
                        sort: (d) => d.pricing?.psychRatio || 0 },
  { key: 'grade',       label: '등급',
                        fmt: (v, d) => `<span class="grade-badge g-${d.heuristic.cls}">${esc(d.heuristic.label)}</span>`,
                        sort: (d) => Number(d.heuristic.cls) },
  { key: 'score',       label: '점수',      num: true,
                        fmt: (v, d) => d.heuristic.total,
                        sort: (d) => d.heuristic.total },
  { key: 'decision',    label: '결정' }
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function cssEsc(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

// ── 메인 렌더 ───────────────────────────────────────────────────
/**
 * @param {HTMLElement} container
 * @param {Diagnosis[]} list
 * @param {object} opts — { testId, decisions, onDecision }
 */
export function renderSkuTable(container, list, opts = {}) {
  const testId = opts.testId || 'sku-table';
  const decisions = opts.decisions || [];
  const onDecision = opts.onDecision || (async () => {});

  if (!list.length) {
    container.innerHTML = '<div class="empty-state">데이터 없음</div>';
    return;
  }

  // 결정 인덱스 (sku → 가장 최근 결정)
  const lastBySku = new Map();
  for (const dec of decisions) {
    const cur = lastBySku.get(dec.skuId);
    if (!cur || cur.decidedAt < dec.decidedAt) lastBySku.set(dec.skuId, dec);
  }

  const state = {
    sortKey: opts.defaultSortKey || '_idx',
    sortDir: opts.defaultSortDir || 'asc',
    activeSku: null,
    list: list.slice()  // 원본 순서 보존을 위한 복사
  };

  container.innerHTML = `
    <div class="table-layout" data-testid="layout-${testId}">
      <div class="table-wrap" data-testid="wrap-${testId}"></div>
      <div class="detail-panel" data-testid="detail-${testId}" hidden></div>
    </div>`;
  const tableWrap  = container.querySelector(`[data-testid="wrap-${testId}"]`);
  const detailWrap = container.querySelector(`[data-testid="detail-${testId}"]`);

  function rerender() {
    const sorted = state.list.slice();
    const col = COLS.find(c => c.key === state.sortKey);
    if (col && col.sort) {
      sorted.sort((a, b) => {
        const av = col.sort(a, state.list.indexOf(a));
        const bv = col.sort(b, state.list.indexOf(b));
        const cmp = (av < bv) ? -1 : (av > bv) ? 1 : 0;
        return state.sortDir === 'asc' ? cmp : -cmp;
      });
    }

    const head = COLS.map(c => {
      const cls = c.key === state.sortKey ? `sort-${state.sortDir}` : '';
      return `<th class="${cls}" data-key="${c.key}">${esc(c.label)}</th>`;
    }).join('');

    const rows = sorted.map((d, i) => {
      const cells = COLS.map(c => {
        if (c.key === 'decision') return `<td class="actions-cell" data-skuid="${esc(d.skuId)}"></td>`;
        const v = c.fmt ? c.fmt(null, d, i) : '';
        const mismatch = c.mismatch && c.mismatch(d) ? ' cell-mismatch' : '';
        const numCls = c.num ? ' num' : '';
        return `<td class="${(numCls + mismatch).trim()}">${v}</td>`;
      }).join('');
      const activeCls = state.activeSku === d.skuId ? ' active' : '';
      return `<tr class="${activeCls.trim()}" data-skuid="${esc(d.skuId)}">${cells}</tr>`;
    }).join('');

    tableWrap.innerHTML = `
      <table class="sku" data-testid="${testId}">
        <thead><tr>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    // 정렬 핸들러
    tableWrap.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (!key) return;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = 'asc';
        }
        rerender();
      });
    });

    // 행 클릭 → 디테일
    tableWrap.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        // 결정 버튼 클릭은 행 토글에서 제외
        if (e.target.closest('.actions-cell')) return;
        const skuId = tr.dataset.skuid;
        if (state.activeSku === skuId) {
          state.activeSku = null;
          detailWrap.hidden = true;
          container.querySelector('.table-layout').classList.remove('with-detail');
        } else {
          state.activeSku = skuId;
          const d = state.list.find(x => x.skuId === skuId);
          renderDetail(detailWrap, d, lastBySku, decisions, onDecision, () => {
            state.activeSku = null;
            detailWrap.hidden = true;
            container.querySelector('.table-layout').classList.remove('with-detail');
            rerender();
          });
          detailWrap.hidden = false;
          container.querySelector('.table-layout').classList.add('with-detail');
        }
        // active row 표시 갱신
        tableWrap.querySelectorAll('tbody tr').forEach(r =>
          r.classList.toggle('active', r.dataset.skuid === state.activeSku)
        );
      });
    });

    // 결정 버튼 동적 삽입
    for (const d of sorted) {
      const cell = tableWrap.querySelector(`tr[data-skuid="${cssEsc(d.skuId)}"] td.actions-cell`);
      if (cell) cell.appendChild(buildDecisionButtons(d, lastBySku.get(d.skuId), onDecision));
    }
  }
  rerender();
}

// ── 디테일 패널 ─────────────────────────────────────────────────
function renderDetail(container, d, lastBySku, decisions, onDecision, onClose) {
  const o = d.offer || {};
  const p = d.pricing || {};
  const h = d.heuristic || {};
  const ratioPct = p.psychRatio ? (p.psychRatio * 100).toFixed(1) + '%' : '-';
  const psychSrc = p.psychPriceSource === 'db' ? 'DB'
                 : p.psychPriceSource === 'rrp_synth' ? 'RRP 추정'
                 : '없음';
  const skuHistory = decisions.filter(x => x.skuId === d.skuId)
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  const last = lastBySku.get(d.skuId);

  // 9개 진단 항목 — 구현된 것만 표시
  const items = d.diagnosisItems || {};
  const itemBlocks = [];
  if (items.sellThrough) {
    itemBlocks.push(`<div>셀스루: 4w ${items.sellThrough.w4.toFixed(1)}% / 8w ${items.sellThrough.w8.toFixed(1)}% / 16w ${items.sellThrough.w16.toFixed(1)}%</div>`);
  }
  if (items.inventoryStatus) {
    itemBlocks.push(`<div>재고: 보유 ${items.inventoryStatus.onHand} / 입고예정 ${items.inventoryStatus.incoming} / 평균판매 ${items.inventoryStatus.avgSold.toFixed(1)}</div>`);
  }
  if (items.decisionDeadline) {
    itemBlocks.push(`<div>결정시한: ${items.decisionDeadline.tier} ${items.decisionDeadline.weeks}주</div>`);
  }
  if (!itemBlocks.length) itemBlocks.push('<div style="color:var(--muted)">9개 진단 항목 데이터 없음 (4-tuple 매칭 부재)</div>');

  container.innerHTML = `
    <header>
      <div>
        <h3>${esc(o.brand)} ${esc(o.style)}</h3>
        <div class="meta">${esc(o.color)} · ${esc(o.size)} · ${esc(o.category)}/${esc(o.gender)} · ${esc(o.season)}</div>
      </div>
      <button class="close-btn" data-testid="detail-close">×</button>
    </header>

    <div class="section">
      <h4>SKU 정보</h4>
      <div class="kv">
        <span>채널</span><b>${esc(o.channel) || '-'}</b>
        <span>도착월</span><b>${esc(o.arrivalMonth) || '-'}</b>
        <span>수량</span><b>${o.qty || 0}</b>
        <span>SKU ID</span><b style="font-size:10px">${esc(d.skuId)}</b>
      </div>
    </div>

    <div class="section">
      <h4>가격 디테일</h4>
      <div class="kv">
        <span>JSC EUR</span><b>${(o.jsc || 0).toFixed(2)}</b>
        <span>RRP EUR</span><b>${(o.rrp || 0).toFixed(2)}</b>
        <span>매입율</span><b>${o.rrp ? ((o.jsc / o.rrp) * 100).toFixed(1) + '%' : '-'}</b>
        <span>RRP KRW</span><b>${(p.rrpKrw || 0).toLocaleString()}</b>
        <span>랜디드</span><b>${(p.landedCostKrw || 0).toLocaleString()}</b>
        <span>목표가</span><b>${(p.targetPriceKrw || 0).toLocaleString()}</b>
        <span>고객심리가</span><b>${(p.customerPsychPriceKrw || 0).toLocaleString()} (${psychSrc})</b>
        <span>심리가대비</span><b style="${p.psychRatio > 1 ? 'color:var(--warn)' : ''}">${ratioPct}</b>
      </div>
      ${p.note ? `<div class="meta" style="margin-top:6px">${esc(p.note)}</div>` : ''}
    </div>

    <div class="section">
      <h4>휴리스틱 점수 분해 (총 ${h.total}점)</h4>
      <div class="kv">
        <span>브랜드</span><b>${h.brand || 0}</b>
        <span>컬러</span><b>${h.color || 0}</b>
        <span>사이즈</span><b>${h.size || 0}</b>
        <span>가격</span><b>${h.price || 0}</b>
        <span>시즌</span><b>${h.season || 0}</b>
        <span>키워드</span><b>${(h.keywordBonus || 0) >= 0 ? '+' : ''}${h.keywordBonus || 0}</b>
      </div>
      ${h.keywordMatched?.length ? `<div class="meta" style="margin-top:6px">키워드: ${h.keywordMatched.map(esc).join(', ')}</div>` : ''}
    </div>

    <div class="section">
      <h4>9개 진단 항목</h4>
      <div style="font-size:12px">${itemBlocks.join('')}</div>
      ${items.riskSignals?.length
        ? `<div class="risk">⚠ ${items.riskSignals.map(esc).join(', ')}</div>`
        : ''}
    </div>

    <div class="section">
      <h4>결정</h4>
      <div class="actions" data-testid="detail-actions"></div>
      <textarea class="memo" placeholder="메모 (옵션)" data-testid="detail-memo"></textarea>
    </div>

    ${skuHistory.length ? `
    <div class="section">
      <h4>이전 결정 (${skuHistory.length})</h4>
      <ul class="history">
        ${skuHistory.slice(0, 5).map(x => `<li>${esc(x.decidedAt.slice(0, 16))} — <b>${esc(x.decision)}</b>${x.memo ? ' · ' + esc(x.memo) : ''}</li>`).join('')}
      </ul>
    </div>` : ''}
  `;

  container.querySelector('[data-testid="detail-close"]').addEventListener('click', onClose);

  const memoEl = container.querySelector('[data-testid="detail-memo"]');
  const actions = container.querySelector('[data-testid="detail-actions"]');
  for (const action of [DECISION.BUY, DECISION.COUNTER, DECISION.PASS]) {
    const b = document.createElement('button');
    b.className = `btn-${action.toLowerCase()}`;
    if (last && last.decision === action) b.classList.add('decided');
    b.textContent = action;
    b.dataset.testid = `detail-btn-${action.toLowerCase()}`;
    b.addEventListener('click', async () => {
      await onDecision({ diagnosis: d, decision: action, memo: memoEl.value || '' });
      // 디시전 버튼 시각 갱신
      actions.querySelectorAll('button').forEach(x => x.classList.remove('decided'));
      b.classList.add('decided');
    });
    actions.appendChild(b);
  }
}

// ── 표 결정 버튼 ─────────────────────────────────────────────────
function buildDecisionButtons(d, lastDecision, onDecision) {
  const wrap = document.createElement('div');
  wrap.className = 'actions';
  for (const action of [DECISION.BUY, DECISION.COUNTER, DECISION.PASS]) {
    const b = document.createElement('button');
    b.className = `btn-${action.toLowerCase()}`;
    if (lastDecision && lastDecision.decision === action) b.classList.add('decided');
    b.textContent = action;
    b.dataset.testid = `btn-${action.toLowerCase()}`;
    b.dataset.skuid = d.skuId;
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await onDecision({ diagnosis: d, decision: action, memo: '' });
      wrap.querySelectorAll('button').forEach(x => x.classList.remove('decided'));
      b.classList.add('decided');
    });
    wrap.appendChild(b);
  }
  return wrap;
}
