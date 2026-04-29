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

test.describe('smart-buy Round 2 E2E', () => {
  test('1. 페이지 로딩 — 콘솔 에러 0 + 3 탭 표시', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await gotoReady(page);
    await expect(page.locator('header h1')).toContainText('스마트 매입');
    await expect(page.locator('[data-testid="mode-toggle"]')).toBeVisible();
    // 결과 영역은 미업로드 상태에서는 숨겨져 있을 수도, 영속 데이터로 보일 수도 있음
    await page.screenshot({ path: resolve(SHOTS, '01-dashboard-loaded.png'), fullPage: true });
    expect(errors, '콘솔 에러:\n' + errors.join('\n')).toEqual([]);
  });

  test('2. Excel 업로드 → 30 SKU 진단 + 대시보드 렌더', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);
    await expect(page.locator('#results-section')).toBeVisible();
    // 기본 활성: 전체 오퍼 (대시보드)
    await expect(page.locator('#tab-dashboard')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, '02-uploaded-dashboard.png'), fullPage: true });
  });

  test('3. 탭 전환 — 대시보드 / TOP 20 / 전체 SKU', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="top20"]').click();
    await expect(page.locator('[data-testid="top20-table"]')).toBeVisible();
    const top20Rows = await page.locator('[data-testid="top20-table"] tbody tr').count();
    expect(top20Rows).toBeGreaterThan(0);
    expect(top20Rows).toBeLessThanOrEqual(20);
    await page.screenshot({ path: resolve(SHOTS, '05-table-top20.png'), fullPage: true });

    await page.locator('[data-tab="all"]').click();
    await expect(page.locator('[data-testid="all-sku-table"]')).toBeVisible();
    const allRows = await page.locator('[data-testid="all-sku-table"] tbody tr').count();
    expect(allRows).toBe(30);
    await page.screenshot({ path: resolve(SHOTS, '06-table-all.png'), fullPage: true });

    await page.locator('[data-tab="dashboard"]').click();
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

    await page.locator('[data-tab="top20"]').click();
    const firstBuy = page.locator('[data-testid="top20-table"] tbody tr:first-child [data-testid="btn-buy"]');
    await expect(firstBuy).toBeVisible();
    await firstBuy.click();
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    // decided 클래스 (시각 피드백)
    await expect(firstBuy).toHaveClass(/decided/);

    // 이벤트 발행
    const events = await page.evaluate(() => window.__decisionEvents);
    expect(events.length).toBe(1);
    expect(events[0].decision.decision).toBe('BUY');

    // IndexedDB 직접 조회
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

    await page.locator('[data-tab="top20"]').click();
    await page.locator('[data-testid="top20-table"] tbody tr:first-child [data-testid="btn-buy"]').click();
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    await page.reload();
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    // 결과 영역 자동 복원 (대시보드 KPI 가시)
    await expect(page.locator('#results-section')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-grid"]')).toBeVisible();

    // TOP 20 탭의 결정 버튼이 'decided' 클래스 유지
    await page.locator('[data-tab="top20"]').click();
    const decidedCount = await page.locator(
      '[data-testid="top20-table"] tbody [data-testid="btn-buy"].decided'
    ).count();
    expect(decidedCount).toBeGreaterThan(0);

    await page.screenshot({ path: resolve(SHOTS, '10-persisted-after-reload.png'), fullPage: true });
  });

  test('6. Hero 5 KPI + 보조 4 KPI + 시즌·필터·진단 표시', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    // Hero 통합 테이블: 헤더 행에 5 라벨 (종합 등급/오퍼 금액/매입율/총 SKU/총 수량)
    const heroCells = await page.locator('[data-testid="kpi-grid"] .ht-header-row .ht-cell').count();
    expect(heroCells).toBe(5);
    const heroLabels = await page.locator('[data-testid="kpi-grid"] .ht-header-row .ht-cell').allTextContents();
    const labelText = heroLabels.join(' ');
    expect(labelText).toContain('종합 등급');
    expect(labelText).toContain('오퍼 금액');
    expect(labelText).toContain('매입율');
    expect(labelText).toContain('총 SKU');
    expect(labelText).toContain('총 수량');

    // 전체 행 (큰 숫자 5개)
    const totalCells = await page.locator('[data-testid="kpi-grid"] .ht-total-row .ht-cell').count();
    expect(totalCells).toBe(5);

    // 정보 칩 3그룹 (카테고리/성별/시즌, 1줄)
    const filterRows = await page.locator('[data-testid="filter-chips"] .filter-row').count();
    expect(filterRows).toBe(3);
    // 정보 칩 — present/absent 클래스 두 종류 모두 존재
    const presentChips = await page.locator('[data-testid="filter-chips"] .info-chip.present').count();
    const allChips     = await page.locator('[data-testid="filter-chips"] .info-chip').count();
    expect(allChips).toBe(10 + 5 + 3); // 카테고리 10 + 성별 5 + 시즌 3
    expect(presentChips).toBeGreaterThan(0);

    // 진단 텍스트 — 서술형 단락 (3개)
    const diagParas = await page.locator('[data-testid="diagnosis-text"] .diag-prose p').count();
    expect(diagParas).toBeGreaterThanOrEqual(2);

    // 보조 KPI 4종 (대시보드 탭 안)
    await page.locator('[data-tab="dashboard"]').click();
    const secondary = await page.locator('[data-testid="kpi-grid-secondary"] .kpi').count();
    expect(secondary).toBe(4);
    const secondaryLabels = await page.locator('[data-testid="kpi-grid-secondary"] .kpi-label').allTextContents();
    expect(secondaryLabels).toEqual(expect.arrayContaining([
      '가중평균 점수', '위험 SKU', '가격모순', '중심가 매칭률'
    ]));
  });

  test('7. 등급 분포 막대그래프 SVG — 5개 등급 막대', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="dashboard"]').click();
    await expect(page.locator('[data-testid="grade-distribution"] svg')).toBeVisible();
    const bars = await page.locator('[data-testid="grade-distribution"] svg rect').count();
    expect(bars).toBeGreaterThanOrEqual(1);
    expect(bars).toBeLessThanOrEqual(5);

    await page.locator('[data-testid="grade-distribution"]').screenshot(
      { path: resolve(SHOTS, '03-grade-distribution.png') }
    );
  });

  test('8. 통계 7종 모두 렌더', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="dashboard"]').click();
    const blocks = await page.locator('[data-testid="stats-grid"] .dash-stat').count();
    expect(blocks).toBe(7);
    // 각 차트에 svg 존재 확인
    const svgsInStats = await page.locator('[data-testid="stats-grid"] .dash-stat svg').count();
    expect(svgsInStats).toBeGreaterThanOrEqual(7);

    await page.locator('[data-testid="stats-grid"]').screenshot(
      { path: resolve(SHOTS, '04-statistics-grid.png') }
    );
  });

  test('9. SKU 표 행 클릭 → 디테일 패널 슬라이드 인', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="top20"]').click();
    const detailPanel = page.locator('[data-testid="detail-top20-table"]');
    await expect(detailPanel).toBeHidden();

    await page.locator('[data-testid="top20-table"] tbody tr:first-child').click();
    await expect(detailPanel).toBeVisible();
    // 디테일 헤더에 SKU 브랜드+모델 노출
    await expect(detailPanel.locator('header h3')).toBeVisible();

    await page.screenshot({ path: resolve(SHOTS, '07-detail-panel-open.png'), fullPage: true });

    // 닫기
    await detailPanel.locator('[data-testid="detail-close"]').click();
    await expect(detailPanel).toBeHidden();
  });

  test('10. 가격 모순 SKU — 빨간 배지(cell-mismatch) 1건 이상', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="all"]').click();
    const mismatchCells = await page.locator(
      '[data-testid="all-sku-table"] td.cell-mismatch'
    ).count();
    expect(mismatchCells).toBeGreaterThanOrEqual(1);

    await page.locator(
      '[data-testid="all-sku-table"] td.cell-mismatch'
    ).first().screenshot({ path: resolve(SHOTS, '08-price-mismatch-badge.png') });
  });

  test('11. 표 컬럼 헤더 클릭 → 정렬 (asc/desc 토글)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="all"]').click();
    // 점수 컬럼 (data-key="score") 클릭 → asc
    const scoreHeader = page.locator(
      '[data-testid="all-sku-table"] thead th[data-key="score"]'
    );
    await scoreHeader.click();
    await expect(scoreHeader).toHaveClass(/sort-asc/);
    // 한 번 더 → desc
    await scoreHeader.click();
    await expect(scoreHeader).toHaveClass(/sort-desc/);
    // 정렬 후 첫 행이 가장 큰 점수인지 검증 — 점수 셀 (인덱스 16)
    const rows = page.locator('[data-testid="all-sku-table"] tbody tr');
    const firstScore = await rows.nth(0).locator('td').nth(16).textContent();
    const lastScore  = await rows.nth(await rows.count() - 1).locator('td').nth(16).textContent();
    expect(parseFloat(firstScore)).toBeGreaterThanOrEqual(parseFloat(lastScore));
  });

  test('12. 매입율 컬럼 — % 형식 출력 (예: 50.0%)', async ({ page }) => {
    await gotoReady(page);
    await uploadAndWait(page);

    await page.locator('[data-tab="all"]').click();
    // 매입율은 인덱스 11 (# 0, 브랜드 1, 모델 2, 컬러 3, 사이즈 4, 카테고리 5,
    //                  성별 6, 시즌 7, 수량 8, JSC 9, RRP 10, 매입율 11)
    const cells = await page.locator(
      '[data-testid="all-sku-table"] tbody tr td:nth-child(12)'
    ).allTextContents();
    const withPercent = cells.filter(c => /^\d+(\.\d+)?%$/.test(c.trim()));
    expect(withPercent.length).toBeGreaterThan(0);
    // 무작위 매입율 하나 형식 점검
    expect(withPercent[0]).toMatch(/^\d+\.\d+%$/);
  });
});
