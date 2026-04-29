// 표 컨트롤 — 필터 칩 (브랜드/카테고리/시즌/성별) + 검색 박스.
// 전체 SKU 표 전용. TOP 20에는 적용 안 함 (필터링 시 0건이 되면 의미 약함).
//
// 동작 규약:
//   - 같은 그룹 내 다중 선택 → OR
//   - 그룹 간 → AND
//   - 검색은 sku 코드 / 브랜드 / style(상품명) 부분 일치 (대소문자 무시), debounce 200ms
//   - 칩의 absent 상태(클래스)는 데이터에 1건도 없는 값. 클릭 안 됨.
//   - 칩의 selected 상태는 사용자가 활성화한 필터.

// ── 후보값 추출 (필터 칩 옵션) ──────────────────────────────────
function uniqueValues(list, getter) {
  const set = new Set();
  for (const d of list) {
    const v = getter(d);
    if (v !== undefined && v !== null && String(v).trim()) {
      set.add(String(v).trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ── 필터·검색 적용 ──────────────────────────────────────────────
// state: { search, selected: { brand, category, season, gender } }
// 빈 selected set은 해당 그룹 통과 (전체 허용).
export function applyControls(list, state) {
  const q = (state.search || '').trim().toLowerCase();
  const sel = state.selected;
  return list.filter(d => {
    const o = d.offer || {};
    if (sel.brand.size && !sel.brand.has(String(o.brand || '').trim())) return false;
    if (sel.category.size && !sel.category.has(String(o.category || '').trim())) return false;
    if (sel.season.size && !sel.season.has(String(o.season || '').trim())) return false;
    if (sel.gender.size && !sel.gender.has(String(o.gender || '').trim())) return false;
    if (q) {
      const hay = `${d.skuId || ''} ${o.brand || ''} ${o.style || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ── 컨트롤 렌더 + 이벤트 바인딩 ─────────────────────────────────
// 검색은 debounce 200ms, 칩 클릭은 즉시. 둘 다 onChange 콜백으로 재렌더 트리거.
export function renderTableControls(container, fullList, state, onChange) {
  const brands     = uniqueValues(fullList, d => d.offer?.brand);
  const categories = uniqueValues(fullList, d => d.offer?.category);
  const seasons    = uniqueValues(fullList, d => d.offer?.season);
  const genders    = uniqueValues(fullList, d => d.offer?.gender);

  function chipsHtml(group, values) {
    return values.map(v => {
      const selected = state.selected[group].has(v);
      const cls = `filter-chip-clickable ${selected ? 'selected' : ''}`;
      return `<button type="button" class="${cls}" data-group="${group}" data-value="${esc(v)}">${esc(v)}</button>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="deep-controls-row deep-controls-search">
      <input type="search" class="deep-search-input" data-testid="deep-search-input"
             placeholder="SKU 코드 / 브랜드 / 상품명 검색"
             value="${esc(state.search)}" />
      <span class="deep-search-hint" data-testid="deep-search-hint"></span>
    </div>
    <div class="deep-controls-row deep-controls-chips" data-testid="deep-filter-chips">
      ${groupRow('brand', '브랜드', chipsHtml('brand', brands))}
      ${groupRow('category', '카테고리', chipsHtml('category', categories))}
      ${groupRow('season', '시즌', chipsHtml('season', seasons))}
      ${groupRow('gender', '성별', chipsHtml('gender', genders))}
    </div>
  `;

  // 칩 클릭 — 즉시 토글
  container.querySelectorAll('.filter-chip-clickable').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      if (state.selected[group].has(value)) state.selected[group].delete(value);
      else state.selected[group].add(value);
      btn.classList.toggle('selected');
      onChange();
    });
  });

  // 검색 — debounce 200ms
  const input = container.querySelector('[data-testid="deep-search-input"]');
  const hint = container.querySelector('[data-testid="deep-search-hint"]');
  let timer = null;
  input.addEventListener('input', (e) => {
    if (hint) hint.textContent = '검색 중…';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      state.search = e.target.value;
      if (hint) hint.textContent = '';
      onChange();
    }, 200);
  });
}

function groupRow(group, label, chipsHtml) {
  return `
    <span class="deep-filter-group" data-group="${group}">
      <span class="deep-filter-label">${label}</span>
      <span class="deep-filter-chips-inner">${chipsHtml || '<span class="deep-filter-empty">없음</span>'}</span>
    </span>
  `;
}
