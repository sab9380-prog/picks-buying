# smart-buy — NC PICKS v13-Lite v1.4

픽스 앱 옆 메뉴로 통합될 **스마트 매입 단독 페이지**. 신규 오퍼(Excel 묶음 또는 단건)를 받아 9개 진단 + TOP 20 매입 추천 + 고객심리가/목표판매가를 산출.

## 진실의 소스

- 설계: `../../AI 라이프/AI 스마트 매입 (오퍼 피드백)/NC_PICKS_v13_설계_v1.4.md`
- v12 원본 백업: `_archive/v12-original.html`

## 폴더 구조

```
smart-buy/
├── index.html              # 단일 진입점 (Phase 6)
├── shared/                 # 옆 메뉴 통합 대비 표준 인터페이스
│   ├── brand-normalize.js  # 브랜드 정규화 단일 진실
│   ├── types.d.ts          # Brand/OfferSKU/Diagnosis/Decision
│   ├── constants.js        # 채널·카테고리·gender enum
│   └── db.js               # IndexedDB 5-store
├── engine/                 # 진단·가격·랭킹
│   ├── diagnose.js
│   ├── price.js
│   └── rank.js
├── data/                   # v12에서 이관된 정적 자산 13종
│   ├── center-price-db.json
│   ├── brand-size-db.json
│   ├── model-keyword-rules.json
│   ├── color-trend-rules.json
│   ├── brand-score-rules.json
│   ├── offer-mc-map.json
│   ├── price-rules.json
│   ├── season-rules.json
│   ├── size-rules.json
│   ├── grade-labels.json
│   ├── kids-exclusion.json
│   ├── category-inference.json
│   ├── channels.json
│   └── _mock/              # 운영시 BI 추출 파일로 교체
├── _oracle/                # v12 순수 함수 (회귀 테스트용)
├── _archive/               # v12 원본 백업
└── test/                   # 회귀·E2E·스크린샷
```

## 확장성 인터페이스

옆 메뉴 통합을 처음부터 염두:
1. `shared/brand-normalize.js` — 브랜드명 정규화 단일 진실 (한↔영)
2. `shared/types.d.ts` — Brand/OfferSKU/Diagnosis/Decision 인터페이스
3. IndexedDB 5 store: `brands_master / offers / diagnoses / decisions / static_assets`
4. 결정 이벤트: `window.dispatchEvent(new CustomEvent('picks:decision-made', {detail}))`

## 의존성

- 프로덕션: 0개 (vanilla JS, ES Modules)
- Excel I/O: SheetJS CDN lazy load
- 개발 only: fake-indexeddb, playwright
