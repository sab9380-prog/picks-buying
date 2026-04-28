// Mock BI 데이터 3종 생성. 실 운영 시 BI 추출 파일로 교체.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEADER = '# MOCK_DATA — 운영시 BI 추출 파일로 교체\n';

// 200 SKU 마스터 (실제 가능 조합으로 다양화)
const BRANDS  = ['adidas', 'nike', 'newbalance', 'lacoste', 'birkenstock', 'puma'];
const STYLES  = {
  adidas:      ['SAMBA OG', 'GAZELLE', 'CAMPUS', 'SUPERSTAR', 'STAN SMITH', 'ULTRABOOST 22'],
  nike:        ['AIR FORCE 1', 'DUNK LOW', 'AIR MAX 90', 'AIR MAX 95', 'BLAZER MID', 'JORDAN 1 LOW'],
  newbalance:  ['990v6', '530', '574', '550', '2002R', '996'],
  lacoste:     ['L.12.12 POLO', 'CARNABY EVO', 'CROC HOODIE'],
  birkenstock: ['ARIZONA', 'BOSTON'],
  puma:        ['SUEDE CLASSIC']
};
const COLORS  = ['CORE BLACK', 'WHITE', 'NAVY', 'BEIGE', 'GREY'];
const SIZES_FOOTWEAR = ['39', '40', '41', '42', '43'];
const SIZES_APPAREL  = ['S', 'M', 'L', 'XL'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// ── 200 SKU 마스터 생성 ──
const skus = [];
let id = 1;
for (let i = 0; i < 200; i++) {
  const brandId = rand(BRANDS);
  const style = rand(STYLES[brandId]);
  const color = rand(COLORS);
  const isFootwear = ['adidas', 'nike', 'newbalance', 'birkenstock', 'puma'].includes(brandId);
  const size = isFootwear ? rand(SIZES_FOOTWEAR) : rand(SIZES_APPAREL);
  skus.push({
    skuId: 'MOCK-' + String(id++).padStart(4, '0'),
    brandId, style, color, size,
    category: isFootwear ? 'FOOTWEAR' : 'APPAREL'
  });
}

// ── 1) sales-history.csv (200 SKU × 24개월) ──
{
  const rows = ['week,brandId,style,color,size,qty'];
  for (const sku of skus) {
    // 24개월 = 약 104주
    const base = randInt(1, 8); // 평균 주간 판매
    for (let w = 0; w < 104; w++) {
      const wk = `2024-${String(Math.floor(w / 4) + 1).padStart(2, '0')}-W${(w % 4) + 1}`;
      const qty = Math.max(0, base + randInt(-3, 3));
      rows.push(`${wk},${sku.brandId},${sku.style},${sku.color},${sku.size},${qty}`);
    }
  }
  writeFileSync(resolve(__dirname, 'sales-history.csv'), HEADER + rows.join('\n') + '\n', 'utf8');
  console.log('✓ data/_mock/sales-history.csv (' + (rows.length - 1) + ' rows)');
}

// ── 2) inventory.csv (200 SKU × 12주 스냅샷) ──
{
  const rows = ['week,brandId,style,color,size,onHand'];
  for (const sku of skus) {
    let stock = randInt(50, 200);
    for (let w = 0; w < 12; w++) {
      const wk = `2025-W${String(w + 1).padStart(2, '0')}`;
      stock = Math.max(0, stock - randInt(0, 8));
      rows.push(`${wk},${sku.brandId},${sku.style},${sku.color},${sku.size},${stock}`);
    }
  }
  writeFileSync(resolve(__dirname, 'inventory.csv'), HEADER + rows.join('\n') + '\n', 'utf8');
  console.log('✓ data/_mock/inventory.csv (' + (rows.length - 1) + ' rows)');
}

// ── 3) incoming.csv (50 SKU × 4개월 입고예정) ──
{
  const rows = ['arrivalMonth,brandId,style,color,size,qty'];
  const sample = skus.slice(0, 50);
  for (const sku of sample) {
    for (let m = 0; m < 4; m++) {
      const month = `2026-${String(5 + m).padStart(2, '0')}`;
      const qty = randInt(20, 100);
      rows.push(`${month},${sku.brandId},${sku.style},${sku.color},${sku.size},${qty}`);
    }
  }
  writeFileSync(resolve(__dirname, 'incoming.csv'), HEADER + rows.join('\n') + '\n', 'utf8');
  console.log('✓ data/_mock/incoming.csv (' + (rows.length - 1) + ' rows)');
}

console.log('Mock BI 데이터 3종 생성 완료. 운영시 data/bi/ 경로에 실제 파일로 교체.');
