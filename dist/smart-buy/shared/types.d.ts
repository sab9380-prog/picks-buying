// 공통 타입 정의 — 옆 메뉴 통합 대비 단일 진실.
// 사용처: smart-buy/* 전체 + (향후) 픽스 본체.

// ───────────────────────────────────────────────────────
// Brand
// ───────────────────────────────────────────────────────
export interface Brand {
  /** 정규화된 ID (예: "adidas"). normalizeBrandId() 출력값. */
  id: string;
  /** 원본 표기 (예: "ADIDAS Originals", "아디다스") */
  raw: string;
  /** 영문 표준 표기 (예: "ADIDAS") */
  displayEn?: string;
  /** 한글 표준 표기 (예: "아디다스") */
  displayKo?: string;
  /** brand-score-rules의 tier 점수 (있으면) */
  tierScore?: number;
  /** center-price-db에 카테고리별 평균가 (있으면) */
  centerPrice?: Record<string, number>;
}

// ───────────────────────────────────────────────────────
// OfferSKU — 매입 오퍼 1건 (4-tuple grain)
// ───────────────────────────────────────────────────────
export type Category = 'FOOTWEAR' | 'APPAREL' | 'ACCESSORY' | 'OTHER';
export type Gender   = 'MEN' | 'WOMEN' | 'UNISEX' | 'KIDS';
export type Channel  = 'OCEAN-OS' | 'AIR-OS' | 'DOM-LAND' | 'EXP-OS';

export interface OfferSKU {
  /** Excel/단건 입력에서 부여된 batch 식별자 (같은 묶음 SKU끼리 공유) */
  batchId: string;
  /** SKU 식별자 (brand|style|color|size 또는 자동 생성) */
  skuId: string;

  brand: string;      // raw 표기, normalize는 brandId 별도
  brandId: string;    // normalizeBrandId(brand)

  /** 4-tuple */
  style: string;      // 모델명 (예: "SAMBA OG")
  color: string;      // 컬러 (예: "CORE BLACK")
  size: string;       // 사이즈 (예: "42", "L")

  category: Category;
  gender: Gender;
  product?: string;   // 오퍼 컬럼 (예: "SNEAKERS", "TEE")
  sports?: string;    // ADIDAS 등에서 ORIGINALS/RUNNING 등

  /** 가격 — JSC 정상가 EUR / RRP 정상가 EUR */
  jsc?: number;
  rrp?: number;
  qty?: number;

  season?: string;     // SS26/FW25 등
  channel?: Channel;
  arrivalMonth?: string; // YYYY-MM
}

// ───────────────────────────────────────────────────────
// Diagnosis — v1.4 §5 9개 진단 항목
// ───────────────────────────────────────────────────────
export interface Diagnosis {
  skuId: string;
  batchId: string;
  /** 매칭 grain — 4-tuple 매칭 성공 여부 */
  matched: boolean;
  /** 매칭 실패 시 휴리스틱(v12 룰)으로 점수 산출 */
  fallbackHeuristic: boolean;

  /** v12 calcScore 결과 (휴리스틱) */
  heuristic: {
    brand: number; color: number; size: number; price: number; season: number;
    total: number;
    keywordBonus: number;
    keywordMatched: string[];
    label: string;       // 최우선 매입 / 적극 권장 / 조건부 / 신중 / 패스 / 키즈 매입 제외
    cls: string;
  };

  /** v1.4 §5 9개 진단 항목 (실 데이터 기반) */
  diagnosisItems?: {
    sellThrough?: { w4: number; w8: number; w16: number };
    inventoryStatus?: { onHand: number; incoming: number; avgSold: number };
    estimatedIMU?: Record<Channel, number>;
    decisionDeadline?: { weeks: number; tier: '🚨' | '⏰' | '🟢' };
    riskSignals?: string[];
    estimatedSellThruWeeks?: number;
    estimatedMargin?: number;
    estimatedGMROI?: number;
    segmentFit?: '골드라벨' | '일반' | '아이템조닝';
    budgetRemaining?: number;
  };

  /** 가격 산출 */
  pricing?: {
    landedCostKrw: number;
    targetPriceKrw: number;
    customerPsychPriceKrw: number;
    psychRatio: number;          // targetPrice / customerPsychPrice
    centerPriceFound: boolean;
  };

  /** 진단 시각 */
  diagnosedAt: string; // ISO
}

// ───────────────────────────────────────────────────────
// Decision — MD 결정 결과
// ───────────────────────────────────────────────────────
export type DecisionType = 'BUY' | 'COUNTER' | 'PASS';

export interface Decision {
  decisionId: string;
  skuId: string;
  batchId: string;
  decision: DecisionType;
  /** COUNTER 시 제안 가격 */
  counterPriceEur?: number;
  /** 결정 사유 (선택) */
  note?: string;
  /** 진단 스냅샷 (감사용) */
  diagnosisSnapshot: Diagnosis;
  /** 결정 시각 */
  decidedAt: string;
  /** 결정자 (옆 메뉴 통합 시 다중 사용자 대비) */
  decidedBy?: string;
}

// ───────────────────────────────────────────────────────
// CustomEvent payload (window 'picks:decision-made')
// ───────────────────────────────────────────────────────
export interface DecisionEventDetail {
  decision: Decision;
  source: 'smart-buy';
}
