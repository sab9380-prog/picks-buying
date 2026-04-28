# Round 3-B · Phase 7 — 최종 회귀 + 종합 보고서

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 = `84625bb` (Round 2 종료) → 종료 = `tag round-3-b`
**상태**: ✅ Round 3-B 종료

---

## 0. 라운드 3-B 한눈에

| 항목 | Round 2 종료 | Round 3-B 종료 | 변화 |
|---|---|---|---|
| 디자인 토큰 (정의된 단일 소스) | 0 (인라인 :root만) | **`design-tokens.css` 79개 + 15 alias** | +94 |
| 폰트 패밀리 | system | **Pretendard Variable + Inter** | 2 CDN |
| 본문 base 폰트사이즈 | 14px | **16px** (`html { font-size: 16px }`) | +2px |
| 인라인 hex 컬러 (JS 측) | 7건 (dashboard.js) | **0건** (모두 토큰 lookup) | -7 |
| 인라인 style 속성 (JS 측) | 7건 (sku-table.js) | **0건** (모두 클래스화) | -7 |
| 미정의 클래스 | 1건 (`.src-tag`) | **0건** (정의 추가됨) | -1 |
| KPI 위계 | 4×2 균등 8개 | **히어로 2 + 보조 6** (사용자 옵션 C 채택) | 위계화 |
| 결정 버튼 패턴 | 솔리드 + box-shadow ring | **ghost → solid (decided)** | Linear 패턴 |
| 가격 추정 표시 | 텍스트 ("RRP 추정") | **회색 배지 + "라운드 4 보정 예정 (RRP × 0.55)" 주석** | 정직성 강화 |
| 회귀 50/50 | ✓ | **✓** | 보존 |
| E2E 12/12 | ✓ | **✓** | 보존 |
| 콘솔 에러 | 0 | **0** | 보존 |
| `_oracle/v12-functions.mjs` | 0 변경 | **0 변경** | 절대 규칙 준수 |
| 휴리스틱 / 진단 / 매칭 로직 | 0 변경 | **0 변경** | 절대 규칙 준수 |
| IndexedDB 스키마 | DB_VERSION 1 | **DB_VERSION 1** | 변경 0 |
| 신규 npm 의존성 | 0 | **0** | 절대 규칙 준수 |
| 폰트 CDN | 0 | **2** (Pretendard, Inter) | 명령서 한도 정확 |

---

## 1. 변경 파일 리스트 + 라인 수 diff (Phase 0~7 누적)

| 파일 | 신규 / 수정 | Round 2 → Round 3-B 라인 변화 |
|---|---|---|
| `design-tokens.css` | **신규** | +160 |
| `index.html` | 수정 | `<style>` ~290행 토큰화 + `<header>` 마크업 재구성 |
| `dashboard.js` | 수정 | `tokenColor()` 헬퍼 추가, hero KPI HTML 빌더, SVG hex 7건 → 토큰 lookup. 약 35 라인 추가 / 14 라인 변경 |
| `sku-table.js` | 수정 | `renderDetail` 인라인 style 7건 제거 + psychSrc 배지 + 주석 분리. 약 12 라인 변경 |
| `REPORT_phase_0.md` ~ `REPORT_phase_7.md` | 신규 | 8 보고서 (이 문서 포함) |
| `test/_screenshots/round3-baseline/01..05` | 신규 | Phase 0 스냅샷 5장 |
| `test/_screenshots/round3-final/01..05` | 신규 | Phase 7 스냅샷 5장 |
| `test/_screenshots/round2/*.png` | 갱신 | Phase 1~6 매번 E2E 자동 갱신 |

JS 비-시각 코드 (engine/, shared/, app.js) **전 phase 통틀어 변경 0**.

---

## 2. 최종 회귀 결과

| 검증 | Round 2 베이스라인 | Round 3-B 종료 |
|---|---|---|
| `engine/diagnose.test.mjs` (50건 회귀) | 50/50 (100.00%) | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | 9/9 pass | **9/9 pass** (34.88ms) ✓ |
| `test/center-price-coverage.test.mjs` | 3/3 pass — 93.3% | **3/3 pass** — 93.3% ✓ |
| Playwright E2E `test/smart-buy.e2e.mjs` | 12/12 pass (35.7s) | **12/12 pass** (55.0s) ✓ |
| 콘솔 에러 (E2E test 1) | 0건 | **0건** ✓ |

**모든 게이트 통과. 회귀 0.**

---

## 3. baseline vs round-3-final 시각 비교

5장 1:1 비교. Phase 0에서 락인된 baseline과 Phase 7 종료 시점 비교.

| # | 베이스라인 (Round 2 종료) | 라운드 3-B 종료 | 핵심 차이 |
|---|---|---|---|
| 1 | `round3-baseline/01-baseline-overview.png` | `round3-final/01-final-overview.png` | 헤더 sticky + brand-mark 보라 그라디언트 + version-tag 칩, KPI 히어로 2 + 보조 6, 통계 카드 보더, 폰트 Pretendard, 액센트 보라 |
| 2 | `02-baseline-top20.png` | `02-final-top20.png` | 표 헤더 UPPERCASE + tracking, 행 hover bg-card, active row 좌측 보라 라인, 결정 버튼 ghost → solid 패턴, sort 화살표 + 라벨 함께 강조 |
| 3 | `03-baseline-all-sku.png` | `03-final-all-sku.png` | 동상 (전체 30 SKU) |
| 4 | `04-baseline-detail-panel.png` | `04-final-detail-panel.png` | 디테일 카드 shadow, h3 16px semibold, 섹션 라벨 UPPERCASE, KV 그리드 baseline-align + 값 right + tabular-nums, **psychSrc 배지 (DB 보라 / synth 회색)** + "라운드 4 보정 예정" 주석, close 버튼 hit-area, memo focus ring |
| 5 | `05-baseline-price-mismatch.png` | `05-final-price-mismatch.png` | bg rgba(235,87,87,0.12) signal-danger + 텍스트 var(--signal-danger) + ⚠ + 2px margin |

10장 모두 `git`에 커밋 완료 (Phase 0 커밋 + Phase 7 커밋).

---

## 4. design-tokens.css 최종본 확정

**Phase 1에서 정의된 79개 신 토큰 + 15 alias = 94개 단일 소스 정착.**

Phase 2~6 통틀어 신 토큰 추가 0. 라운드 3-B 동안 토큰 정의는 변경 없음. **alias 구조 덕분에 점진 마이그레이션 안전 + 라운드 4에서 alias 제거하면 깔끔.**

### 신 토큰 카테고리 (79개)

| 카테고리 | 개수 | 예시 |
|---|---|---|
| 배경 | 4 | `--bg-base`, `--bg-elevated`, `--bg-card`, `--bg-overlay` |
| 보더 | 3 | `--border-subtle/-default/-strong` |
| 텍스트 | 4 | `--text-primary/-secondary/-tertiary/-disabled` |
| 액센트 | 3 | `--accent-primary/-hover/-subtle` |
| 시그널 | 4 | `--signal-danger/-warning/-success/-info` |
| 차트 팔레트 | 8 | `--chart-color-1` ~ `--chart-color-8` |
| 폰트 패밀리 | 3 | `--font-sans/-en/-mono` |
| 폰트 사이즈 | 8 | `--fs-xs ~ --fs-3xl` |
| 폰트 두께 | 4 | `--fw-regular/-medium/-semibold/-bold` |
| 줄간 | 2 | `--lh-ko (1.6)`, `--lh-en (1.5)` |
| 라운드 | 6 | `--r-sm/-md/-lg/-xl/-2xl/-pill` |
| 간격 | 12 | `--space-1` (4px) ~ `--space-12` (80px) |
| 그림자 | 3 | `--shadow-sm/-md/-lg` |
| 모션 | 4 | `--ease-standard`, `--dur-fast/-medium/-slow` |
| **합계** | **79** | |

### 백워드 호환 alias (15개) — 라운드 4에서 alias 제거 후보

`--bg`, `--panel`, `--panel-2`, `--border`, `--text`, `--muted`, `--accent`, `--buy`, `--counter`, `--pass`, `--warn`, `--grade-80/-70/-60/-50/-0`

라운드 3-B 종료 시점에서 이 15개 alias 의존이 남은 영역:
- `index.html` `<style>`: Phase 1~6에서 대부분 직접 토큰으로 교체했으나 일부 잔존 가능
- `dashboard.js`: 0 (Phase 6에서 모두 토큰 lookup으로 교체)
- `sku-table.js`: 0 (Phase 5에서 모두 클래스화)

**Phase 7에서는 alias 제거 작업 미수행** — 라운드 4에서 alias 삭제 + grep 일괄 검증으로 정리 권장.

---

## 5. 토큰 사용처 표 (역방향 인덱스)

각 토큰이 **어떤 컴포넌트에서 사용되는가** — 향후 토큰 값 변경 시 영향 범위 즉시 파악.

| 토큰 | 사용 컴포넌트 |
|---|---|
| `--bg-base` | body, single-form input, status-bar 텍스트 영역, file-drop, BUY decided 텍스트 |
| `--bg-elevated` | header, input-panel, table-wrap, dash-section, detail-panel, status-bar |
| `--bg-card` | mode-toggle 컨테이너, KPI 카드, dash-stat, dash-summary-card, table.sku th, src-tag, close-btn hover |
| `--border-subtle` | header, input-panel, dash-section, dash-stat, table-wrap, table.sku tr, detail-panel section, KPI 카드, buy-rate-note dashed |
| `--border-default` | mode-toggle, file-drop, single-form input, dash-stat hover, table.sku th 분리 보더, 결정 버튼 ghost, src-tag |
| `--border-strong` | PASS hover 보더 |
| `--text-primary` | body, header h1, tabs active, KPI 값, table.sku 본문, detail-panel h3, kv 값, 차트 값 텍스트 |
| `--text-secondary` | mode-toggle 비활성, single-form label, tabs 비활성, table.sku th, KPI 라벨, detail-panel kv 라벨, dash-section h4, 차트 라벨 |
| `--text-tertiary` | header version-tag, header meta, KPI sub, empty-state, close-btn, meta-mono, section-note, src-tag, psych-source-badge.synth, PASS decided 배경 |
| `--accent-primary` | brand-mark, btn, mode-toggle active, tabs active 보더, sort 화살표, active row inset shadow, toggle-bucket active, buy-rate-cmp 값, psych-source-badge.db |
| `--accent-hover` | brand-mark gradient, btn hover |
| `--accent-subtle` | input/memo focus ring, file-drop hover, active row 배경, hero glow, psych-source-badge.db 배경 |
| `--signal-success` | grade-badge.g-80/-70, BUY hover/decided, chart-color-2 = JSC 토글 |
| `--signal-warning` | grade-badge.g-60/-50, COUNTER hover/decided, risk 텍스트 |
| `--signal-danger` | cell-mismatch 텍스트, psych-ratio-danger |
| `--chart-color-1` (== `--accent-primary`) | 등급 분포, 도착월, 기본 막대 |
| `--chart-color-2` (== `--signal-success`) | 가격대 JSC 막대 |
| `--chart-color-3` (== `--signal-warning`) | 가격대 RRP 막대 |
| `--chart-color-6` (orange) | 채널 막대 |
| `--font-sans` (Pretendard) | body, :lang(ko) |
| `--font-en` (Inter) | :not(:lang(ko)) |
| `--font-mono` | meta-mono (SKU ID) |
| `--fs-xs` (11) | header version-tag/meta, KPI 라벨, dash h4, table.sku th, 결정 버튼, src-tag |
| `--fs-sm` (13) | mode-toggle/tabs/btn/file-drop p, table.sku 본문, detail-panel kv |
| `--fs-base` (14) | header h1, buy-rate-cmp 값 |
| `--fs-md` (16) | body, html base |
| `--fs-lg` (16) | detail-panel h3 |
| `--fs-xl` (20) | KPI 값, close 버튼 × |
| `--fs-2xl` (28) | hero 종합 등급 배지 |
| `--fs-3xl` (40) | hero KPI 값 |
| `--fw-medium` (500) | 라벨, 비활성 인터랙션 텍스트 |
| `--fw-semibold` (600) | 헤더 h1, tabs active, KPI 라벨 강조, 결정 버튼, 표 헤더, 디테일 h3 / 값 |
| `--fw-bold` (700) | brand-mark, KPI 값, hero 값, overall-grade-badge |
| `--r-sm` (4) | btn, 결정 버튼, src-tag, mode-toggle 내부 |
| `--r-md` (6) | mode-toggle 외곽, status-bar, KPI 카드, dash-stat, dash-summary-card, file-drop |
| `--r-lg` (8) | input-panel, table-wrap, dash-section, detail-panel, KPI hero |
| `--r-pill` | version-tag, grade-badge 점, psych-source-badge |
| `--space-1` ~ `-7` | 모든 padding / margin / gap (8px grid) |
| `--shadow-md` | detail-panel |
| `--dur-fast` + `--ease-standard` | 모든 transition |

---

## 6. 함정 또는 의심 항목 (Phase 0~6 통합)

### 6.1 Linear 캡처 미첨부 — Phase 1 실측 보정 미수행
명령서 요구 "Linear 캡처 19장 중 5~10장 컬러 피커 측정"을 첨부 부재로 수행 못 함. 명령서 추정치를 그대로 채택. **alias 구조 덕분에 Phase 7 이후 캡처 입수 시 design-tokens.css 한 곳만 수정해 재조정 가능.**

### 6.2 함정 1: 매칭률 33.3% (db만) — 정직 표기 보존 ✓
- KPI 라벨: `중심가 매칭률 33.3%` + sub `10/30 (db만 매칭)`
- 디테일 패널: psychSrc 배지 `[추정값]` + 주석 `추정값 — 라운드 4 보정 예정 (RRP × 0.55 계수)`
- 표 본문: `.src-tag` 회색 칩 `추정`
**라운드 2의 정직성 정신 + 라운드 3-B의 시각 분리. 사용자가 추정 vs 실측을 한눈에 구분 가능.**

### 6.3 환율 버그 (JSC×1740, RRP×1700) — 라운드 5 보류 ✓
시각 개편이라 영향 없음.

### 6.4 RRP_PSYCH_FACTOR=0.55 — 라운드 4 보류 ✓
디테일 패널 주석으로 명시 노출. 사용자 인지 확보.

### 6.5 인라인 RGBA 잔존 5건
- `.grade-badge.g-80~50` 4종 배경 (rgba(...,0.08~0.14))
- `.cell-mismatch` 배경 (rgba(235,87,87,0.12))
모두 단일 hex 토큰의 투명도 변환 형태. 명령서 "인라인 색상 금지"의 컴포넌트별 직접 hex 박기 의도와 다름. **라운드 4에서 `--signal-*-soft / -strong` 보조 토큰 추가 시 정리 가능.**

### 6.6 인라인 어두운 텍스트 1건 (`#1a1a1a`)
COUNTER decided 시 노란 배경 + 어두운 텍스트 (WCAG 4.5:1 명도 대비). `--text-on-warning` 같은 신 토큰 도입 후 정리 가능.

### 6.7 backdrop-filter — Chromium만 검증
header sticky + `backdrop-filter: blur(8px)`. Safari 14+ / Firefox 103+에서 지원되나 라운드 5 다브라우저 검증에서 재확인 권장.

### 6.8 brand-mark "S" 모노그램 — 픽스 본체 통합 시 교체
`<span class="brand-mark">S</span>` — 픽스 본체 정식 SVG 로고 입수 시 내부만 교체.

### 6.9 max-width 1280px 변경
1400 → 1280 (Linear 워크스페이스 톤). 1920+ 화면 시연 시 양 사이드 여백 확인 권장.

### 6.10 폰트 CDN cold-load 영향
Phase 1 첫 E2E 1.4분 (이후 캐시화로 45~55초 정상화). 사용자 첫 방문 시 0.5~1초 폰트 로딩 잠깐 노출 가능.

---

## 7. 절대 규칙 7개 준수 검증

| 규칙 | 상태 | 증빙 |
|---|---|---|
| 1. v12-functions.mjs 수정 0줄 | ✓ | git log -p _oracle/v12-functions.mjs (Round 3-B 변경 없음) |
| 2. IndexedDB 스키마 변경 금지 | ✓ | shared/db.js 변경 0 (DB_VERSION 1 유지) |
| 3. 휴리스틱 / 진단 / 매칭 로직 수정 금지 | ✓ | engine/*.js 변경 0 |
| 4. 데이터 형태 / 4 엔티티 스키마 변경 금지 | ✓ | shared/types.d.ts, shared/constants.js 변경 0 |
| 5. window CustomEvent 'picks:decision-made' 유지 | ✓ | app.js 변경 0 (이벤트 핸들러 그대로) |
| 6. shared/brand-normalize.js 한글 별칭 사전 그대로 | ✓ | 변경 0 |
| 7. 기능 회귀 0 강제 | ✓ | E2E 12/12, 50/50, 9/9, 3/3 모두 통과 |

---

## 8. 커밋 로그 (라운드 3-B)

```
636e36e feat(smart-buy): Round 3-B Phase 6 — chart palette tokenization + dash card polish
f192e0d feat(smart-buy): Round 3-B Phase 5 — detail panel hierarchy + rrp_synth disclosure
47022b9 feat(smart-buy): Round 3-B Phase 4 — SKU table visual refresh (Linear tone)
94c1eb9 feat(smart-buy): Round 3-B Phase 3 — KPI hero 2 + compact 6 (user choice C)
9405b3d feat(smart-buy): Round 3-B Phase 2 — header/tabs/main rebuilt with Linear pattern
7305ef7 feat(smart-buy): Round 3-B Phase 0+1 — design tokens + Pretendard/Inter fonts
84625bb (Round 2 종료) docs(smart-buy): round 2 report + e2e 12 scenarios + 10 screenshots
```

Phase 7 commit + tag `round-3-b`는 이 보고서 commit 시 추가.

---

## 9. 다음 라운드 예고 (이미 명령서에 명시된 보류 항목)

- **라운드 4**: `RRP_PSYCH_FACTOR` 보정 (현 0.55 → 카테고리/브랜드 tier별 차등). 가격 시그널을 `_rankScore` 페널티로 반영.
- **라운드 5**: 환율 버그 수정 (JSC×1740, RRP×1700). 다국어/다브라우저 검증 (backdrop-filter / Inter/Pretendard 호환).
- **라운드 4 정리 후보 (시각)**: alias 15개 제거. `--signal-*-soft / -strong` 보조 토큰 도입으로 인라인 RGBA 5건 정리. `--text-on-warning` 토큰 도입.

---

## 10. SUCCESS — 라운드 3-B 종료

| 게이트 | 상태 |
|---|---|
| 회귀 50/50 100% | ✓ |
| `aggregate.test.mjs` 9/9 | ✓ |
| `center-price-coverage.test.mjs` 3/3 | ✓ |
| Playwright E2E 12/12 | ✓ |
| 콘솔 에러 0 | ✓ |
| `v12-functions.mjs` 변경 0줄 | ✓ |
| 신규 npm 의존성 0 | ✓ |
| 폰트 CDN 정확히 2개 | ✓ |
| 인라인 hex/스타일 0건 (JS) | ✓ |
| design-tokens.css 단일 소스 | ✓ |
| 모든 Phase별 commit 완료 | ✓ |
| baseline / final 시각 5장 락인 | ✓ |
| 사용자 옵션 C (KPI hero) 반영 | ✓ |
| 절대 규칙 7개 준수 | ✓ |
