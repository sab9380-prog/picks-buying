// IndexedDB 5-store 레이어. 브라우저와 fake-indexeddb (테스트) 양쪽 동작.
import { DB_NAME, DB_VERSION, STORE, EVENT } from './constants.js';

// ── openDB ──────────────────────────────────────────────────────────
// 5 store 초기화. static_assets는 호출 후 별도로 seedStaticAssets() 호출.
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE.BRANDS_MASTER)) {
        db.createObjectStore(STORE.BRANDS_MASTER, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.OFFERS)) {
        const s = db.createObjectStore(STORE.OFFERS, { keyPath: 'skuId' });
        s.createIndex('batchId', 'batchId', { unique: false });
        s.createIndex('brandId', 'brandId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.DIAGNOSES)) {
        const s = db.createObjectStore(STORE.DIAGNOSES, { keyPath: 'skuId' });
        s.createIndex('batchId', 'batchId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.DECISIONS)) {
        const s = db.createObjectStore(STORE.DECISIONS, { keyPath: 'decisionId' });
        s.createIndex('skuId', 'skuId', { unique: false });
        s.createIndex('decidedAt', 'decidedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.STATIC_ASSETS)) {
        db.createObjectStore(STORE.STATIC_ASSETS, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── 일반 헬퍼 ───────────────────────────────────────────────────────
function tx(db, storeName, mode = 'readonly') {
  const t = db.transaction(storeName, mode);
  return { tx: t, store: t.objectStore(storeName) };
}

function reqToPromise(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ── 브랜드 마스터 (빈 상태 시작, 옆 메뉴 통합 시 채워짐) ──────────────
export async function putBrand(db, brand) {
  const { store } = tx(db, STORE.BRANDS_MASTER, 'readwrite');
  return reqToPromise(store.put(brand));
}
export async function getBrand(db, id) {
  const { store } = tx(db, STORE.BRANDS_MASTER);
  return reqToPromise(store.get(id));
}
export async function listBrands(db) {
  const { store } = tx(db, STORE.BRANDS_MASTER);
  return reqToPromise(store.getAll());
}

// ── Offers ──────────────────────────────────────────────────────────
export async function putOffer(db, offer) {
  const { store } = tx(db, STORE.OFFERS, 'readwrite');
  return reqToPromise(store.put(offer));
}
export async function putOffersBulk(db, offers) {
  const { tx: t, store } = tx(db, STORE.OFFERS, 'readwrite');
  for (const o of offers) store.put(o);
  return new Promise((res, rej) => {
    t.oncomplete = () => res(offers.length);
    t.onerror    = () => rej(t.error);
  });
}
export async function getOffer(db, skuId) {
  const { store } = tx(db, STORE.OFFERS);
  return reqToPromise(store.get(skuId));
}
export async function getOffersByBatch(db, batchId) {
  const { store } = tx(db, STORE.OFFERS);
  const idx = store.index('batchId');
  return reqToPromise(idx.getAll(batchId));
}
export async function listOffers(db) {
  const { store } = tx(db, STORE.OFFERS);
  return reqToPromise(store.getAll());
}

// ── Diagnoses ───────────────────────────────────────────────────────
export async function putDiagnosis(db, diag) {
  const { store } = tx(db, STORE.DIAGNOSES, 'readwrite');
  return reqToPromise(store.put(diag));
}
export async function getDiagnosis(db, skuId) {
  const { store } = tx(db, STORE.DIAGNOSES);
  return reqToPromise(store.get(skuId));
}
export async function listDiagnosesByBatch(db, batchId) {
  const { store } = tx(db, STORE.DIAGNOSES);
  const idx = store.index('batchId');
  return reqToPromise(idx.getAll(batchId));
}

// ── Decisions ───────────────────────────────────────────────────────
export async function putDecision(db, decision) {
  const { store } = tx(db, STORE.DECISIONS, 'readwrite');
  await reqToPromise(store.put(decision));

  // 결정 이벤트 발행 — 옆 메뉴 통합 인터페이스 ④
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(EVENT.DECISION_MADE, {
      detail: { decision, source: 'smart-buy' }
    }));
  }
  return decision;
}
export async function listDecisions(db) {
  const { store } = tx(db, STORE.DECISIONS);
  return reqToPromise(store.getAll());
}
export async function getDecisionsBySku(db, skuId) {
  const { store } = tx(db, STORE.DECISIONS);
  const idx = store.index('skuId');
  return reqToPromise(idx.getAll(skuId));
}

/** 결정 이벤트 구독 헬퍼 (브라우저 전용) */
export function subscribeDecisions(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => callback(e.detail);
  window.addEventListener(EVENT.DECISION_MADE, handler);
  return () => window.removeEventListener(EVENT.DECISION_MADE, handler);
}

// ── Static Assets (data/*.json 시드) ────────────────────────────────
export async function putStaticAsset(db, name, content) {
  const { store } = tx(db, STORE.STATIC_ASSETS, 'readwrite');
  return reqToPromise(store.put({ name, content, updatedAt: Date.now() }));
}
export async function getStaticAsset(db, name) {
  const { store } = tx(db, STORE.STATIC_ASSETS);
  const r = await reqToPromise(store.get(name));
  return r ? r.content : null;
}

/**
 * data/*.json 13개 자동 시드.
 * 브라우저: fetch 사용 (smart-buy/data/*.json 정적 호스팅 가정)
 * 노드 테스트: 호출자가 별도로 시드
 */
export async function seedStaticAssetsFromFetch(db, baseUrl = './data/') {
  const files = [
    'center-price-db', 'brand-size-db', 'model-keyword-rules',
    'color-trend-rules', 'brand-score-rules', 'offer-mc-map',
    'price-rules', 'season-rules', 'size-rules',
    'grade-labels', 'kids-exclusion', 'category-inference', 'channels'
  ];
  for (const f of files) {
    const res = await fetch(`${baseUrl}${f}.json`);
    if (!res.ok) throw new Error(`${f}.json fetch 실패: ${res.status}`);
    const json = await res.json();
    await putStaticAsset(db, f, json);
  }
  return files.length;
}

// ── 전체 초기화 (테스트용) ──────────────────────────────────────────
export async function clearAll(db) {
  const stores = Object.values(STORE);
  const t = db.transaction(stores, 'readwrite');
  for (const s of stores) t.objectStore(s).clear();
  return new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror    = () => rej(t.error);
  });
}
