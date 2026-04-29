#!/usr/bin/env node
// smart-buy/ → dist/smart-buy/ 동기화. Node 표준 fs만 사용 (의존성 0).

import { rmSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'smart-buy');
const DEST = join(ROOT, 'dist', 'smart-buy');

const ROOT_FILES = [
  'index.html',
  'app.js',
  'dashboard.js',
  'sku-table.js',
  'vendor-adapter.js',
  'design-tokens.css',
];
const ROOT_DIRS = ['assets', 'data', 'engine', 'shared'];

const EXCLUDE_DIRS = new Set([
  'node_modules', 'test', '_oracle', 'screenshots', 'scripts', '.claude',
]);

function isExcludedFile(name) {
  if (name.endsWith('.test.mjs')) return true;
  if (name.startsWith('_tmp-')) return true;
  if (name === 'skills-lock.json') return true;
  if (/^package(-lock)?\.json$/.test(name)) return true;
  if (name.endsWith('.md')) return true;
  return false;
}

let fileCount = 0;
let totalBytes = 0;

function copyTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      copyTree(join(srcDir, entry.name), join(destDir, entry.name));
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      copyFileSync(srcPath, destPath);
      fileCount += 1;
      totalBytes += statSync(destPath).size;
    }
  }
}

console.log('[sync-dist] cleaning dist/smart-buy/...');
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

console.log('[sync-dist] copying root files...');
for (const f of ROOT_FILES) {
  const srcPath = join(SRC, f);
  const destPath = join(DEST, f);
  copyFileSync(srcPath, destPath);
  const size = statSync(destPath).size;
  fileCount += 1;
  totalBytes += size;
  console.log(`  + ${f}  (${size.toLocaleString()} B)`);
}

console.log('[sync-dist] copying directories...');
for (const d of ROOT_DIRS) {
  console.log(`  + ${d}/`);
  copyTree(join(SRC, d), join(DEST, d));
}

const kb = (totalBytes / 1024).toFixed(1);
console.log(`\n[sync-dist] done. ${fileCount} files, ${kb} KB → dist/smart-buy/`);
