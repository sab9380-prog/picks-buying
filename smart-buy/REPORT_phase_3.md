# Round 3-B · Phase 3 — KPI 카드 + 정보 위계

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 커밋 = Phase 2 commit → Phase 3 commit 예정

**사용자 선택 (Phase 3 승인)**: **후보 C — 종합 등급 + 가중평균 매입율** 히어로 2개 + 보조 6개

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| `index.html` `<style>` | `.grade-badge`, `.overall-grade-badge`, `.dash-section`, `.kpi`, `.kpi-grid`, `.kpi.kpi-hero`, `.kpi-value-hero` — 100여 라인 토큰화 + hero 패턴 추가 |
| `dashboard.js` | KPI inner HTML 빌더 재구성 (`heroGrade`, `heroBuyRate` 2개 + 기존 `kpiCard` 6개 호출) — 약 14 라인 |

JS 로직 변경 0 (집계는 `aggregate.js` 그대로), 매칭률 라벨 "33.3% (db만 매칭)" 정직성 보존 ✓.

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 |
|---|---|
| `engine/diagnose.test.mjs` | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | **9/9 pass** (17.51ms) ✓ |
| Playwright E2E | **12/12 pass** (47.4s) ✓ |
| 콘솔 에러 (E2E test 1) | **0건** ✓ |
| `_oracle/v12-functions.mjs` 변경 | 0줄 ✓ |

**E2E test 6 호환성 검증**: `[data-testid="kpi-grid"] .kpi` 카운트 = 8 (히어로 2 + 보조 6). 라벨 텍스트 검증 7종 모두 포함 (`총 SKU`, `총 수량`, `가중평균 매입율`(히어로 라벨), `가중평균 점수`, `위험 SKU`, `가격모순`, `중심가 매칭률`).

---

## 3. 신규 시각

### 3.1 KPI 영역 — Hero 2 + Compact 6 (Linear 15번 캡처 패턴)

**Before** (Round 2):
```
[총 SKU] [총 수량] [가중평균 매입율] [가중평균 점수]
[종합 등급] [위험 SKU] [가격모순] [중심가 매칭률]
```
4×2 균등 그리드, 모든 카드 동일 사이즈, 종합 등급은 작은 배지로 함몰

**After** (Phase 3):
```
┌─────────────────────────┐  ┌─────────────────────────┐
│  종합 등급                │  │  가중평균 매입율          │
│  ┌──────┐                │  │                         │
│  │  B+  │   ← 28px        │  │   47.3%   ← 40px         │
│  └──────┘                │  │                         │
│  60.4점 · 가중평균        │  │  단순 49.1%              │
└─────────────────────────┘  └─────────────────────────┘
[총SKU] [총수량] [가중점수] [위험SKU] [가격모순] [매칭률]
```

- **CSS Grid** `repeat(6, minmax(0, 1fr))` + `.kpi-hero { grid-column: span 3 }` → 한 컨테이너로 두 row 처리
- 히어로 카드:
  - `padding: var(--space-5) var(--space-6)` (20px 24px) — 보조 카드 대비 1.7×
  - `::before` radial-gradient (`var(--accent-subtle)` → transparent) — Linear의 미묘한 보라 글로우
  - 라벨: 12px → 13px (`--fs-sm`), no-uppercase (보조와 위계 분리)
  - 값: 20px → 40px (`--fs-3xl`) — 즉각 인지 사이즈
  - 종합 등급: 배지 안에 들어가지만 hero 컨텍스트에서 28px (`--fs-2xl`)로 키움
  - sub: "60.4점 · 가중평균" / "단순 49.1%" 정직 표기 보존
- 보조 카드:
  - 6개가 균등 1열씩 (각 `span 1`)
  - 라벨: 11px UPPERCASE (위계 명확)
  - 값: 20px (`--fs-xl`)
  - hover 시 보더 색만 변화 (`--border-subtle` → `--border-default`)

### 3.2 매칭률 정직 라벨 강화

**Before**: `중심가 매칭률 / 33.3% / 10/30 (db만)`
**After**: `중심가 매칭률 / 33.3% / 10/30 (db만 매칭)`

라운드 2 컨텍스트의 "함정 1번" — 28/30(93.3%)이 RRP 추정 포함이라 사실은 db 직접 매칭률 33.3%가 정직한 수치 — 그대로 보존하면서 "(db만 매칭)" 문구를 좀 더 명시적으로.

### 3.3 등급 배지 — Linear 좌측 컬러점 + 라벨 패턴

**Before**: 컬러 배경 + 흰 텍스트 (블록 채움)
**After**: 컬러 보더 + 매칭 컬러 텍스트 + 좌측 6×6 컬러 점 + 살짝 투명 배경 (rgba 0.08~0.10)

```
[● A]   [● B+]   [● C]   [● D]   [● F]
green    green    amber   amber   gray
```
Linear 18번 (priority) 누적 막대에서 사용된 컬러 점 + 라벨 패턴 차용. dashboard.js의 `.overall-grade-badge`도 동일 패턴 (점 없이 배경 보더 색만, 좀 더 강조).

### 3.4 dash-section 정렬

- background: `var(--panel)` → **`var(--bg-elevated)`** (직접 토큰)
- border: `var(--border)` → **`var(--border-subtle)`**
- padding: 16px → **`var(--space-5)`** (20px)
- h3: 14px regular → **`var(--fs-sm)` semibold + `letter-spacing: -0.01em`**
- h4: 12px medium → **`var(--fs-xs)` UPPERCASE + tracking 0.04em** (Linear 섹션 라벨 패턴)

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

Phase 3은 신 토큰 추가 0. Phase 1에서 정의한 79개 + 15 alias 사용.

### 4.1 Phase 3에서 처음 사용된 토큰

| 토큰 | 사용처 |
|---|---|
| `--fs-3xl` (40px) | hero KPI 값 |
| `--fs-2xl` (28px) | hero 종합 등급 배지 |
| `--signal-success rgba(0.10/0.14)` | 등급 A/B 배지 배경 |
| `--signal-warning rgba(0.10/0.14)` | 등급 C/D 배지 배경 |
| `--accent-subtle radial-gradient` | hero 카드 글로우 |
| `--border-subtle / --border-default` | 카드 보더 + hover transition |
| `--bg-card` | hero 배경 + 보조 카드 배경 |
| `--r-pill` | 등급 점 (6×6) + (Phase 2의 version-tag 재사용) |
| `letter-spacing: -0.02em` | 큰 숫자 시각 압축 (Linear 톤) |
| `letter-spacing: 0.04em` UPPERCASE | 섹션/카드 라벨 (Linear 패턴) |

### 4.2 신호 컬러 RGBA 공식

투명도 처리는 토큰 정의 시 단일 hex로만 정의되어 있어 인라인 RGBA가 필요했음. Phase 6에서 `--signal-success-bg-soft` / `--signal-success-bg-strong` 같은 보조 토큰을 추가하면 인라인 RGBA를 제거 가능. 현재는 4건만 인라인 (등급 4종 배경) — 명령서 인라인 색상 금지의 의도(컴포넌트별 직접 hex)에는 해당하지 않으나 토큰 일관성 차원에서 Phase 6 정리 후보.

---

## 5. 함정 또는 의심 항목

### 5.1 hero 카드의 종합 등급 — `g-0` (등급 미산출) 시 회색 보더
샘플 데이터(30 SKU)에서는 항상 등급이 산출되어 `g-0`이 빈 batch에서만 발생. 빈 배치 케이스는 `aggregate.test.mjs` "빈 입력" 테스트에서 검증되며 회귀 통과.

### 5.2 매칭률 KPI의 "33.3% (db만 매칭)" 라벨
명령서 [Phase 3] 요구사항 "함정 1번 그대로 보존" — 정직 표기 유지. RRP 추정 포함한 93.3%를 KPI에 노출하면 사용자가 매칭 신뢰도를 과대평가할 위험. **Phase 5 디테일 패널에서 `psychPriceSource: 'rrp_synth'` 배지 추가**로 SKU 단위에서도 추정 소스 명시 예정.

### 5.3 hero 글로우 (radial-gradient)
`::before` overlay 사용. 텍스트와 겹치지 않도록 `position: relative; z-index: ...` 처리. E2E는 픽셀 비교 안 하므로 회귀 영향 없음. 사용자 시연 시 Linear 톤 글로우의 강도(`--accent-subtle 0.15`) 조정 필요할 수 있음.

### 5.4 KPI 8개 카운트 — E2E test 6 의존
구조 변경(4×2 → 1×2 hero + 1×6 compact)했지만 `.kpi` 클래스 8개 그대로 유지해 test 6 통과. **Phase 4·5·6에서 KPI 구조 추가 변경 시 이 8개 카운트 보존 주의**.

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 4 진입 가능 (자율 진행).**

명령서 [자율 vs 사용자 확인 요청 기준]에 따라 Phase 4(SKU 표 시각 디테일)는 자율. Phase 4 / 5 / 6는 시각 디테일이라 회귀 0 게이트 + commit 단위로 자율 진행 후 Phase 7에서 종합 검토.
