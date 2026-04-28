// 대시보드(전체 오퍼) 탭 렌더러.
// SVG 막대그래프는 vanilla(의존성 0). 50줄 헬퍼.

import { aggregateOffer } from './engine/aggregate.js';

// ── SVG 막대그래프 헬퍼 ─────────────────────────────────────────
// data: [{ label, value, qty? }]  opts: { width, height, color, valueFmt }
function renderBarChart(container, data, opts = {}) {
  const W = opts.width  || 280;
  const H = opts.height || (data.length * 22 + 8);
  const color = opts.color || '#4d9aff';
  const valueFmt = opts.valueFmt || (v => String(v));
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const labelW = 110;
  const padR   = 56;
  const barW   = W - labelW - padR;

  const rows = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const w = max > 0 ? Math.round((v / max) * barW) : 0;
    const y = i * 22 + 4;
    const safeLabel = String(d.label).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `
      <g>
        <text x="0" y="${y + 12}" font-size="11" fill="#8a93a4">${safeLabel}</text>
        <rect x="${labelW}" y="${y + 4}" width="${w}" height="14" fill="${color}" rx="2" />
        <text x="${labelW + w + 4}" y="${y + 14}" font-size="10" fill="#e6e8ee">${valueFmt(v, d)}</text>
      </g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block">${rows}</svg>`;
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

// ── 메인 렌더 ───────────────────────────────────────────────────
export function renderDashboard(container, diagnoses, offers = null) {
  const a = aggregateOffer(diagnoses, offers);

  const matchedSkus = diagnoses.filter(d =>
    d.pricing && d.pricing.psychPriceSource === 'db'
  ).length;
  const matchPct = a.totalSkus > 0 ? matchedSkus / a.totalSkus : 0;

  container.innerHTML = `
    <div class="dash">
      <!-- 영역 1: KPI -->
      <div class="dash-section dash-kpi">
        <div class="kpi-grid" data-testid="kpi-grid"></div>
      </div>

      <!-- 영역 2: 종합 등급 + 등급 분포 -->
      <div class="dash-section">
        <div class="dash-section-head">
          <h3>종합 등급 · 등급 분포</h3>
          <span class="overall-grade-badge g-${a.overallGrade.cls}">${a.overallGrade.label}</span>
        </div>
        <div id="dash-grade-dist" class="dash-chart" data-testid="grade-distribution"></div>
      </div>

      <!-- 영역 3: 통계 7종 -->
      <div class="dash-section">
        <h3>통계 7종</h3>
        <div class="dash-stats-grid" data-testid="stats-grid">
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

      <!-- 영역 4: 매입조건 요약 -->
      <div class="dash-section">
        <h3>매입조건 요약</h3>
        <div class="dash-summary-grid">
          <div class="dash-summary-card">
            <h4>도착월 분포</h4>
            <div id="summary-arrival"></div>
          </div>
          <div class="dash-summary-card">
            <h4>채널 분포</h4>
            <div id="summary-channel"></div>
          </div>
          <div class="dash-summary-card">
            <h4>매입율 비교</h4>
            <div class="buy-rate-cmp">
              <div><span>가중 평균</span><b>${fmtPct(a.weightedBuyRate)}</b></div>
              <div><span>단순 평균</span><b>${fmtPct(a.simpleBuyRate)}</b></div>
              <div class="buy-rate-note">qty 가중 vs SKU 단순</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // KPI
  const kpi = container.querySelector('[data-testid="kpi-grid"]');
  kpi.innerHTML = [
    kpiCard('총 SKU',          fmtNum(a.totalSkus)),
    kpiCard('총 수량',         fmtNum(a.totalQty)),
    kpiCard('가중평균 매입율', fmtPct(a.weightedBuyRate),  `단순 ${fmtPct(a.simpleBuyRate)}`),
    kpiCard('가중평균 점수',   fmtScore(a.weightedScore), `단순 ${fmtScore(a.simpleScore)}`),
    `<div class="kpi"><div class="kpi-label">종합 등급</div>
      <div class="kpi-badge"><span class="overall-grade-badge g-${a.overallGrade.cls}">${a.overallGrade.label}</span></div></div>`,
    kpiCard('위험 SKU',        fmtNum(a.riskCount), `${(a.totalSkus ? a.riskCount/a.totalSkus*100 : 0).toFixed(1)}%`),
    kpiCard('가격모순',        fmtNum(a.pricingMismatchCount), `심리가 < 목표가`),
    kpiCard('중심가 매칭률',   fmtPct(matchPct), `${matchedSkus}/${a.totalSkus} (db만)`)
  ].join('');

  // 등급 분포
  const gradeData = Object.entries(a.gradeDistribution)
    .map(([label, info]) => ({ label, value: info.count, qty: info.qty, cls: info.cls }))
    .sort((a, b) => Number(b.cls) - Number(a.cls));
  renderBarChart(
    container.querySelector('#dash-grade-dist'),
    gradeData,
    { width: 600, color: '#4d9aff', valueFmt: (v, d) => `${v}건 / ${fmtNum(d.qty)}수량` }
  );

  // 통계 7종
  renderBarChart(container.querySelector('#stat-category'),
    topN(a.byCategory, 5),  { valueFmt: (v, d) => `${v}건` });
  renderBarChart(container.querySelector('#stat-gender'),
    topN(a.byGender, 5),    { valueFmt: (v, d) => `${v}건` });
  renderBarChart(container.querySelector('#stat-size'),
    topN(a.bySize, 10),     { valueFmt: (v, d) => `${v}건` });
  renderBarChart(container.querySelector('#stat-color'),
    topN(a.byColor, 10),    { valueFmt: (v, d) => `${v}건` });
  renderBarChart(container.querySelector('#stat-season'),
    topN(a.bySeason, 5),    { valueFmt: (v, d) => `${v}건` });

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
  renderBarChart(container.querySelector('#stat-qty'), qtyBins.slice(0, 4),
    { valueFmt: (v) => `${v}건` });

  // 가격대 — JSC / RRP 토글
  const renderPrice = (kind) => {
    const buckets = a.priceBuckets[kind];
    const data = Object.entries(buckets).map(([k, v]) => ({ label: k + ' EUR', value: v }));
    renderBarChart(container.querySelector('#stat-price'), data,
      { color: kind === 'jsc' ? '#2ecc71' : '#f39c12', valueFmt: (v) => `${v}건` });
  };
  renderPrice('jsc');
  container.querySelectorAll('.toggle-bucket button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.toggle-bucket button').forEach(b => b.classList.toggle('active', b === btn));
      renderPrice(btn.dataset.kind);
    });
  });

  // 도착월 / 채널
  const arrivalData = Object.entries(a.arrivalMonths)
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([k, v]) => ({ label: k, value: v }));
  renderBarChart(container.querySelector('#summary-arrival'), arrivalData,
    { color: '#4d9aff', valueFmt: (v) => `${fmtNum(v)} qty` });
  const channelData = Object.entries(a.channels)
    .sort((x, y) => y[1] - x[1])
    .map(([k, v]) => ({ label: k || '미상', value: v }));
  renderBarChart(container.querySelector('#summary-channel'), channelData,
    { color: '#e67e22', valueFmt: (v) => `${fmtNum(v)} qty` });

  return a;
}
