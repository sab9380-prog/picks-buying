// Playwright E2E — Round 2 통합 시나리오 12종 + 스크린샷 10장.
// 기존 1~5 (UI 재구조화 반영) + 신규 6~12.
import { test, expect } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4173';
const SHOTS = resolve(__dirname, '_screenshots/round2');
const SAMPLE_XLSX = resolve(__dirname, '_mock/sample-offer.xlsx');

async function gotoReady(page) {
  await page.goto(BASE + '/index.html');
  await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });
}
async function uploadAndWait(page) {
  await page.setInputFiles('#file-input', SAMPLE_XLSX);
  await expect(page.locator('#status-bar.show')).toContainText(/진단 완료/, { timeout: 15_000 });
}

test.describe('smart-buy Round 5 E2E (탭 2개 재구성)', () => {
  test('1. 페이지 로딩 — 콘솔 에러 0 + 헤더 표시', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await gotoReady(page);
    await expect(page.locator('header h1')).toContainText('스마트 매입');
    // mode-toggle 컨테이너는 file-input + 라벨 + status-bar로 단순화 (단건 입력 제거됨)
    await expect(page.locator('[data-testid="mode-toggle"]')).toBeVisible();
    // 단건 입력 버튼은 제거되었음
    await expect(page.locator('#btn-mode-single')).toHaveCount(0);
    await expect(page.locator('#panel-single')).toHaveCount(0);
    await page.screenshot({ path: resolve(SHOTS, '01-loaded.png'), fullPage: true });
    expect(errors, '콘솔 에러:\n' + errors.join('\n')).toEqual([]);
  });

  test('2. Excel 업로드 → 30 SKU 진단 + 전체 분석 탭 활성', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);
    await expect(page.locator('#results-section')).toBeVisible();
    // 기본 활성: 전체 분석
    await expect(page.locator('#tab-overview')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '02-uploaded-overview.png'), fullPage: true });
  });

  test('3. 탭 전환 + 심층 분석 토글 (TOP 20 / 전체 SKU 표)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    // 심층 분석 탭으로
    await page.locator('[data-tab="deep"]').click();
    await expect(page.locator('[data-testid="tab-deep"]')).toBeVisible();

    // 기본 활성: TOP 20
    const toggleTop = page.locator('[data-testid="deep-view-toggle"] button[data-view="top20"]');
    const toggleAll = page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]');
    await expect(toggleTop).toHaveClass(/active/);
    await expect(toggleAll).not.toHaveClass(/active/);
    await expect(page.locator('[data-testid="top20-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="all-sku-table"]')).toHaveCount(0);
    const top20Rows = await page.locator('[data-testid="top20-table"] tbody tr').count();
    expect(top20Rows).toBeGreaterThan(0);
    expect(top20Rows).toBeLessThanOrEqual(20);

    // 전체 SKU로 토글
    await toggleAll.click();
    await expect(toggleAll).toHaveClass(/active/);
    await expect(toggleTop).not.toHaveClass(/active/);
    await expect(page.locator('[data-testid="all-sku-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="top20-table"]')).toHaveCount(0);
    const allRows = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(allRows).toBe(30);
    await page.screenshot({ path: resolve(SHOTS, '05-deep-tab-all.png'), fullPage: true });

    // 다시 전체 분석 탭으로
    await page.locator('[data-tab="overview"]').click();
    await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();
  });

  test('4. 첫 SKU에 BUY 클릭 → IndexedDB 저장 + decision-made 이벤트', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.evaluate(() => {
      window.__decisionEvents = [];
      window.addEventListener('picks:decision-made', (e) => {
        window.__decisionEvents.push(e.detail);
      });
    });

    await page.locator('[data-tab="deep"]').click();
    const firstBuy = page.locator('[data-testid="top20-table"] tbody tr:first-child [data-testid="btn-buy"]');
    await expect(firstBuy).toBeVisible();
    await firstBuy.click();
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    await expect(firstBuy).toHaveClass(/decided/);

    const events = await page.evaluate(() => window.__decisionEvents);
    expect(events.length).toBe(1);
    expect(events[0].decision.decision).toBe('BUY');

    const decisions = await page.evaluate(async () => {
      const req = indexedDB.open('smart-buy', 1);
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
      });
      return new Promise((res, rej) => {
        const t = db.transaction('decisions', 'readonly');
        const r = t.objectStore('decisions').getAll();
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    });
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.some(d => d.decision === 'BUY')).toBe(true);

    await page.screenshot({ path: resolve(SHOTS, '09-buy-clicked.png'), fullPage: true });
  });

  test('5. 새로고침 → IndexedDB 영속성 + 시각적 복원', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    await page.locator('[data-testid="top20-table"] tbody tr:first-child [data-testid="btn-buy"]').click();
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    await page.reload();
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    await expect(page.locator('#results-section')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();

    await page.locator('[data-tab="deep"]').click();
    const decidedCount = await page.locator(
      '[data-testid="top20-table"] tbody [data-testid="btn-buy"].decided'
    ).count();
    expect(decidedCount).toBeGreaterThan(0);

    await page.screenshot({ path: resolve(SHOTS, '10-persisted-after-reload.png'), fullPage: true });
  });

  test('6. Hero 5 KPI + 진단 카드 안 보조 4 KPI + 시즌·필터 표시', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    const heroCells = await page.locator('[data-testid="kpi-grid"] .ht-header-row .ht-cell').count();
    expect(heroCells).toBe(5);
    const heroLabels = await page.locator('[data-testid="kpi-grid"] .ht-header-row .ht-cell').allTextContents();
    const labelText = heroLabels.join(' ');
    expect(labelText).toContain('종합 등급');
    expect(labelText).toContain('오퍼 금액');
    expect(labelText).toContain('매입율');
    expect(labelText).toContain('총 SKU');
    expect(labelText).toContain('총 수량');

    const totalCells = await page.locator('[data-testid="kpi-grid"] .ht-total-row .ht-cell').count();
    expect(totalCells).toBe(5);

    const filterRows = await page.locator('[data-testid="filter-chips"] .filter-row').count();
    expect(filterRows).toBe(3);
    const presentChips = await page.locator('[data-testid="filter-chips"] .info-chip.present').count();
    const allChips     = await page.locator('[data-testid="filter-chips"] .info-chip').count();
    expect(allChips).toBe(10 + 5 + 3);
    expect(presentChips).toBeGreaterThan(0);

    // 보조 KPI 4종 — 진단 카드 안 (이전: 대시보드 탭에 있었음)
    const secondary = await page.locator('[data-testid="kpi-grid-secondary"] .kpi').count();
    expect(secondary).toBe(4);
    // 진단 카드(diagnosis-text) 내부에 위치해야 함
    const inDiag = await page.locator('[data-testid="diagnosis-text"] [data-testid="kpi-grid-secondary"]').count();
    expect(inDiag).toBe(1);
    const secondaryLabels = await page.locator('[data-testid="kpi-grid-secondary"] .kpi-label').allTextContents();
    expect(secondaryLabels).toEqual(expect.arrayContaining([
      '가중평균 점수', '위험 SKU', '가격모순', '중심가 매칭률'
    ]));
  });

  test('7. 등급 분포 막대그래프 SVG — 전체 분석 탭', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="overview"]').click();
    await expect(page.locator('[data-testid="grade-distribution"] svg')).toBeVisible();
    const bars = await page.locator('[data-testid="grade-distribution"] svg rect').count();
    expect(bars).toBeGreaterThanOrEqual(1);
    expect(bars).toBeLessThanOrEqual(5);

    await page.locator('[data-testid="grade-distribution"]').screenshot(
      { path: resolve(SHOTS, '03-grade-distribution.png') }
    );
  });

  test('8. 통계 8종 (등급 분포 + 7종) — 전체 분석 탭', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="overview"]').click();
    const blocks = await page.locator('[data-testid="stats-grid"] .dash-stat').count();
    expect(blocks).toBe(8);
    const svgsInStats = await page.locator('[data-testid="stats-grid"] .dash-stat svg').count();
    expect(svgsInStats).toBeGreaterThanOrEqual(7);

    await page.locator('[data-testid="stats-grid"]').screenshot(
      { path: resolve(SHOTS, '04-statistics-grid.png') }
    );
  });

  test('9. SKU 표 행 클릭 → 디테일 패널 슬라이드 인', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    const detailPanel = page.locator('[data-testid="detail-top20-table"]');
    await expect(detailPanel).toBeHidden();

    await page.locator('[data-testid="top20-table"] tbody tr:first-child').click();
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator('header h3')).toBeVisible();

    await page.screenshot({ path: resolve(SHOTS, '07-detail-panel-open.png'), fullPage: true });

    await detailPanel.locator('[data-testid="detail-close"]').click();
    await expect(detailPanel).toBeHidden();
  });

  test('10. 가격 모순 SKU — 빨간 배지(cell-mismatch) 1건 이상 (전체 SKU 토글)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]').click();
    const mismatchCells = await page.locator(
      '[data-testid="all-sku-table"] td.cell-mismatch'
    ).count();
    expect(mismatchCells).toBeGreaterThanOrEqual(1);

    await page.locator(
      '[data-testid="all-sku-table"] td.cell-mismatch'
    ).first().screenshot({ path: resolve(SHOTS, '08-price-mismatch-badge.png') });
  });

  test('11. 표 컬럼 헤더 클릭 → 정렬 3-state (asc → desc → off)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]').click();
    const scoreHeader = page.locator(
      '[data-testid="all-sku-table"] thead th[data-key="score"]'
    );
    // 1번 클릭 → asc
    await scoreHeader.click();
    await expect(scoreHeader).toHaveClass(/sort-asc/);
    // 2번 클릭 → desc
    await scoreHeader.click();
    await expect(scoreHeader).toHaveClass(/sort-desc/);
    // 정렬 검증 (desc)
    const rows = page.locator('[data-testid="all-sku-table"] tbody tr');
    const firstScore = await rows.nth(0).locator('td').nth(16).textContent();
    const lastScore  = await rows.nth(await rows.count() - 1).locator('td').nth(16).textContent();
    expect(parseFloat(firstScore)).toBeGreaterThanOrEqual(parseFloat(lastScore));
    // 3번 클릭 → off (sort-asc/sort-desc 둘 다 없음)
    await scoreHeader.click();
    await expect(scoreHeader).not.toHaveClass(/sort-asc/);
    await expect(scoreHeader).not.toHaveClass(/sort-desc/);
  });

  test('12. 매입율 컬럼 — % 형식 출력 (전체 SKU 토글)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]').click();
    const cells = await page.locator(
      '[data-testid="all-sku-table"] tbody tr td:nth-child(12)'
    ).allTextContents();
    const withPercent = cells.filter(c => /^\d+(\.\d+)?%$/.test(c.trim()));
    expect(withPercent.length).toBeGreaterThan(0);
    expect(withPercent[0]).toMatch(/^\d+\.\d+%$/);
  });

  test('13. 검색 — 양쪽 뷰에 공통 적용', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();

    // 전체 SKU 토글로 → 30건 baseline
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]').click();
    const initialAllRows = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(initialAllRows).toBe(30);

    // 첫 SKU의 브랜드를 검색어로
    const firstBrand = (await page.locator(
      '[data-testid="all-sku-table"] tbody tr:first-child td:nth-child(2)'
    ).textContent() || '').trim();
    expect(firstBrand.length).toBeGreaterThan(0);

    await page.locator('[data-testid="deep-search-input"]').fill(firstBrand);
    await page.waitForTimeout(400);

    const filtered = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(initialAllRows);

    // TOP 20으로 토글 — 검색이 공통 적용됨 (필터 결과 그대로 유지)
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="top20"]').click();
    const top20Rows = await page.locator('[data-testid="top20-table"] tbody tr').count();
    expect(top20Rows).toBeGreaterThan(0);
    expect(top20Rows).toBeLessThanOrEqual(20);
  });

  test('14. 필터 칩 — 그룹별 필터링 (전체 SKU 토글)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="deep"]').click();
    await page.locator('[data-testid="deep-view-toggle"] button[data-view="all"]').click();
    const initial = await page.locator('[data-testid="all-sku-table"] tbody tr').count();

    const seasonChip = page.locator(
      '[data-testid="deep-filter-chips"] .deep-filter-group[data-group="season"] .filter-chip-clickable:first-child'
    );
    await expect(seasonChip).toBeVisible();
    await seasonChip.click();
    await expect(seasonChip).toHaveClass(/selected/);

    const filtered = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(initial);

    await seasonChip.click();
    await expect(seasonChip).not.toHaveClass(/selected/);
    const restored = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(restored).toBe(initial);
  });

  test('15. 탭 바가 결과 영역 최상단 — hero·진단·헤더는 모두 탭 콘텐츠 안', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    // tabs는 #results-section의 첫 자식이어야 함 (display:none 등 제외하고 첫 visible 자식)
    const tabsParent = await page.locator('[data-testid="tabs"]').evaluate(
      (el) => el.parentElement?.id || ''
    );
    expect(tabsParent).toBe('results-section');

    // tabs는 #tab-content-overview / #tab-content-deep과 같은 형제이며 그 *앞*에 있어야 함
    const orderResult = await page.evaluate(() => {
      const sec = document.getElementById('results-section');
      if (!sec) return null;
      const children = Array.from(sec.children);
      const tabIdx = children.findIndex(c => c.classList?.contains('tabs'));
      const overviewIdx = children.findIndex(c => c.id === 'tab-content-overview');
      const deepIdx = children.findIndex(c => c.id === 'tab-content-deep');
      return { tabIdx, overviewIdx, deepIdx };
    });
    expect(orderResult).not.toBeNull();
    expect(orderResult.tabIdx).toBe(0);
    expect(orderResult.overviewIdx).toBeGreaterThan(orderResult.tabIdx);
    expect(orderResult.deepIdx).toBeGreaterThan(orderResult.tabIdx);

    // hero·진단·필터 칩은 모두 전체 분석 탭 안
    const heroInOverview = await page.locator('#tab-content-overview [data-testid="hero-summary"]').count();
    const diagInOverview = await page.locator('#tab-content-overview [data-testid="diagnosis-text-wrap"]').count();
    const filterInOverview = await page.locator('#tab-content-overview [data-testid="filter-chips-wrap"]').count();
    expect(heroInOverview).toBe(1);
    expect(diagInOverview).toBe(1);
    expect(filterInOverview).toBe(1);
  });
});
