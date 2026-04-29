// Playwright 스크린샷 캡처 — http://localhost:4173 메인 화면 풀 페이지.
// 사용 패턴은 test/smart-buy.e2e.mjs 와 동일 (chromium, viewport 1280x800).
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const URL = 'http://localhost:4173';
const OUT = resolve(process.cwd(), 'screenshots/test-main.png');
const VIEWPORT = { width: 1280, height: 800 };

async function main() {
  await mkdir(dirname(OUT), { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    console.log(`[screenshot] navigating to ${URL}`);
    const response = await page.goto(URL, { waitUntil: 'networkidle', timeout: 15_000 });
    if (!response || !response.ok()) {
      throw new Error(`page load failed: status=${response?.status() ?? 'no-response'}`);
    }

    await page.screenshot({ path: OUT, fullPage: true });
    console.log(`[screenshot] saved to ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[screenshot] failed:', err.message);
  process.exit(1);
});
