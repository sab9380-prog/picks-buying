// Playwright E2E — v1.4 핵심 시나리오 5단계 + 스크린샷 5장.
import { test, expect } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4173';
const SHOTS = resolve(__dirname, '_screenshots');
const SAMPLE_XLSX = resolve(__dirname, '_mock/sample-offer.xlsx');

test.describe('smart-buy E2E', () => {
  test('1. 페이지 로딩 — 콘솔 에러 0', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(BASE + '/index.html');
    // 헤더 + 모드 토글 표시 확인
    await expect(page.locator('header h1')).toContainText('스마트 매입');
    await expect(page.locator('[data-testid="mode-toggle"]')).toBeVisible();

    // 초기화 완료 대기 (status bar에 "준비 완료")
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    await page.screenshot({ path: resolve(SHOTS, '01-loaded.png'), fullPage: true });
    expect(errors, '콘솔 에러:\n' + errors.join('\n')).toEqual([]);
  });

  test('2. Excel 업로드 → 30 SKU 진단 표시', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    // 파일 input은 hidden이라 setInputFiles로 직접 주입
    await page.setInputFiles('#file-input', SAMPLE_XLSX);
    // 진단 완료 대기
    await expect(page.locator('#status-bar.show')).toContainText(/진단 완료/, { timeout: 15_000 });
    await expect(page.locator('#results-section')).toBeVisible();
    // TOP 20 테이블이 보여야 함
    await expect(page.locator('[data-testid="top20-table"]')).toBeVisible();

    await page.screenshot({ path: resolve(SHOTS, '02-uploaded.png'), fullPage: true });
  });

  test('3. TOP 20 탭 확인', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });
    await page.setInputFiles('#file-input', SAMPLE_XLSX);
    await expect(page.locator('#status-bar.show')).toContainText(/진단 완료/, { timeout: 15_000 });

    // 기본 활성 탭이 TOP 20
    await expect(page.locator('#tab-top20')).toHaveClass(/active/);
    const rows = await page.locator('[data-testid="top20-table"] tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThanOrEqual(20);

    await page.screenshot({ path: resolve(SHOTS, '03-top20.png'), fullPage: true });
  });

  test('4. 첫 SKU에 BUY 클릭 → IndexedDB 저장 + decision-made 이벤트', async ({ page }) => {
    await page.goto(BASE + '/index.html');
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });
    await page.setInputFiles('#file-input', SAMPLE_XLSX);
    await expect(page.locator('#status-bar.show')).toContainText(/진단 완료/, { timeout: 15_000 });

    // 이벤트 캡처: window에 카운터 부착
    await page.evaluate(() => {
      window.__decisionEvents = [];
      window.addEventListener('picks:decision-made', (e) => {
        window.__decisionEvents.push(e.detail);
      });
    });

    // 첫 SKU의 BUY 버튼
    const firstBuyBtn = page.locator('[data-testid="btn-buy"]').first();
    await expect(firstBuyBtn).toBeVisible();
    await firstBuyBtn.click();

    // status bar 업데이트
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    // 이벤트 발행 확인
    const events = await page.evaluate(() => window.__decisionEvents);
    expect(events.length).toBe(1);
    expect(events[0].decision.decision).toBe('BUY');
    expect(events[0].source).toBe('smart-buy');

    // IndexedDB 확인
    const decisions = await page.evaluate(async () => {
      const req = indexedDB.open('smart-buy', 1);
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return new Promise((res, rej) => {
        const t = db.transaction('decisions', 'readonly');
        const r = t.objectStore('decisions').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    });
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].decision).toBe('BUY');

    await page.screenshot({ path: resolve(SHOTS, '04-buy-clicked.png'), fullPage: true });
  });

  test('5. 페이지 새로고침 → Decision 영속성', async ({ page }) => {
    // 같은 Playwright 컨텍스트 = 같은 IndexedDB. upload → BUY → reload → 영속성 확인.
    await page.goto(BASE + '/index.html');
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    await page.setInputFiles('#file-input', SAMPLE_XLSX);
    await expect(page.locator('#status-bar.show')).toContainText(/진단 완료/, { timeout: 15_000 });

    // BUY 결정 1건 저장
    await page.locator('[data-testid="btn-buy"]').first().click();
    await expect(page.locator('#status-bar.show')).toContainText(/결정 저장: BUY/, { timeout: 5_000 });

    // 페이지 새로고침
    await page.reload();
    await expect(page.locator('#status-bar.show')).toContainText(/준비 완료/, { timeout: 10_000 });

    // IndexedDB 직접 조회 — 새로고침 후에도 살아있어야 함
    const decisions = await page.evaluate(async () => {
      const req = indexedDB.open('smart-buy', 1);
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return new Promise((res, rej) => {
        const t = db.transaction('decisions', 'readonly');
        const r = t.objectStore('decisions').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    });
    expect(decisions.length).toBeGreaterThan(0);
    const buyDec = decisions.find(d => d.decision === 'BUY');
    expect(buyDec).toBeTruthy();
    expect(buyDec.diagnosisSnapshot).toBeTruthy();

    await page.screenshot({ path: resolve(SHOTS, '05-persisted.png'), fullPage: true });
  });
});
