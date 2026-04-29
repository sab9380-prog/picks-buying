// 공통 상수 — enum류.

export const CATEGORY = Object.freeze({
  FOOTWEAR: 'FOOTWEAR',
  APPAREL: 'APPAREL',
  ACCESSORY: 'ACCESSORY',
  OTHER: 'OTHER'
});

export const GENDER = Object.freeze({
  MEN: 'MEN',
  WOMEN: 'WOMEN',
  UNISEX: 'UNISEX',
  KIDS: 'KIDS'
});

// v1.4 §6 매입 채널 (data/channels.json과 동기)
export const CHANNEL = Object.freeze({
  OCEAN_OS: 'OCEAN-OS',
  AIR_OS:   'AIR-OS',
  DOM_LAND: 'DOM-LAND',
  EXP_OS:   'EXP-OS'
});

export const DECISION = Object.freeze({
  BUY: 'BUY',
  COUNTER: 'COUNTER',
  PASS: 'PASS'
});

// IndexedDB store 명 (5종)
export const DB_NAME = 'smart-buy';
export const DB_VERSION = 1;
export const STORE = Object.freeze({
  BRANDS_MASTER: 'brands_master',
  OFFERS:        'offers',
  DIAGNOSES:     'diagnoses',
  DECISIONS:     'decisions',
  STATIC_ASSETS: 'static_assets'
});

// CustomEvent 이름 (옆 메뉴와 통신)
export const EVENT = Object.freeze({
  DECISION_MADE: 'picks:decision-made'
});

// 결정시한 tier
export const DEADLINE_TIER = Object.freeze({
  URGENT:  '🚨', // ≤ 1주
  WARNING: '⏰', // 1~4주
  SAFE:    '🟢'  // > 4주
});
