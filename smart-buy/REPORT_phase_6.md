# Round 3-B · Phase 6 — 차트 / 분포 시각화 폴리싱

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 = Phase 5 commit → Phase 6 commit 예정

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| `dashboard.js` | **`tokenColor()` + 캐시 헬퍼 + `T` alias 객체 신규** (15 라인). SVG 인라인 hex 7건 모두 토큰 lookup으로 교체. 막대 둥글기 `rx=2` → `rx=3` |
| `index.html` `<style>` | `.dash-chart`, `.dash-stats-grid`, `.dash-stat`, `.toggle-bucket`, `.dash-summary-grid`, `.dash-summary-card`, `.buy-rate-cmp`, `.buy-rate-note` 전면 토큰화 + hover transition + segmented control 패턴 |

데이터 / 집계 / 휴리스틱 변경 0.

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 |
|---|---|
| `engine/diagnose.test.mjs` | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | **9/9 pass** (23.42ms) ✓ |
| Playwright E2E | **12/12 pass** (45.8s) ✓ |
| 콘솔 에러 (E2E test 1) | **0건** ✓ |
| `_oracle/v12-functions.mjs` 변경 | 0줄 ✓ |

E2E test 7 (등급 분포 SVG rect) + test 8 (통계 7종 SVG): 색상 변경됐으나 SVG 구조/카운트 보존 → 통과.

---

## 3. 신규 시각

### 3.1 SVG 차트 컬러 토큰화 — `tokenColor()` 헬퍼 패턴

SVG `fill=` 속성은 CSS `var(--token)` 직접 사용 불가 (구식 SVG 사양). `getComputedStyle`로 root에서 토큰값을 lookup하여 캐시.

```js
const _tokenCache = {};
function tokenColor(name, fallback = '#000') {
  if (_tokenCache[name]) return _tokenCache[name];
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return (_tokenCache[name] = v || fallback);
}
const T = {
  c1: () => tokenColor('--chart-color-1'),  // violet (accent)
  c2: () => tokenColor('--chart-color-2'),  // green
  c3: () => tokenColor('--chart-color-3'),  // amber
  c6: () => tokenColor('--chart-color-6'),  // orange
  txtSecondary: () => tokenColor('--text-secondary'),
  txtPrimary:   () => tokenColor('--text-primary')
};
```

### 3.2 SVG 인라인 hex 7건 → 토큰 lookup 교체

| 위치 | 이전 hex | 신규 토큰 | 의미 |
|---|---|---|---|
| `dashboard.js:11` (renderBarChart 기본 막대색) | `#4d9aff` | `T.c1()` → `--chart-color-1 #5E6AD2` (Linear 보라) | 모든 차트 기본 |
| `dashboard.js:25` (라벨 텍스트) | `fill="#8a93a4"` | `T.txtSecondary()` → `rgba(255,255,255,0.65)` | 차트 라벨 |
| `dashboard.js:27` (값 텍스트) | `fill="#e6e8ee"` | `T.txtPrimary()` → `rgba(255,255,255,0.95)` | 차트 값 |
| `dashboard.js:191` (등급 분포 막대) | `'#4d9aff'` | `T.c1()` | 등급 분포 |
| `dashboard.js:231` (가격대 JSC/RRP 토글) | `'#2ecc71' / '#f39c12'` | `T.c2() / T.c3()` (green/amber) | JSC=녹/RRP=황 |
| `dashboard.js:246` (도착월) | `'#4d9aff'` | `T.c1()` | 도착월 막대 |
| `dashboard.js:251` (채널) | `'#e67e22'` | `T.c6()` (orange) | 채널 막대 |

7건 모두 **토큰 단일 소스** 통과. 향후 `--chart-color-X` 값만 바꾸면 모든 차트가 일괄 변경.

### 3.3 통계 7종 / 매입조건 카드 시각 정렬

**Before** (.dash-stat / .dash-summary-card):
- `background: var(--panel-2)` (alias) + 보더 없음 + `border-radius: 6px`
- padding 12px

**After**:
- `background: var(--bg-card)` 직접 + **`border: 1px solid var(--border-subtle)`** (Linear 카드 패턴)
- padding `var(--space-4)` (16px)
- `.dash-stat:hover { border-color: var(--border-default); }` — 인터랙션 신호

### 3.4 가격대 JSC/RRP toggle — segmented control (Linear 패턴)

**Before**:
- `border: 1px solid var(--border)`, `gap: 0` (인접 버튼)
- 비활성: 텍스트만, 활성: `var(--accent)` 배경 + 흰

**After**:
- 외곽 컨테이너 padding 2px + 배경 `var(--bg-base)` + 보더
- 비활성 hover: 텍스트 primary 전환
- 활성: `var(--accent-primary)` 배경 + 흰 텍스트 + semibold + 내부 radius 3px
- `transition: color/background var(--dur-fast) var(--ease-standard)`

### 3.5 buy-rate-cmp (가중/단순 매입율 비교) — 위계 정렬

- 라벨: `var(--text-secondary)`, 값(b): `var(--accent-primary)` semibold + tabular-nums
- note (qty 가중 vs SKU 단순): dashed top border (`--border-subtle`) + italic 톤

### 3.6 막대 둥글기 정렬

- `<rect rx="2">` → `<rect rx="3">` — Linear 차트 막대 라운드 톤과 통일

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

신 디자인 토큰 추가 0. **JS 측 헬퍼 신규**: `tokenColor()`, `T` alias.

### Phase 6에서 처음 (또는 본격) 사용된 토큰

| 토큰 | 사용처 |
|---|---|
| `--chart-color-1` (violet) | 등급 분포 / 도착월 / 기본 막대 |
| `--chart-color-2` (green) | 가격대 JSC 막대 |
| `--chart-color-3` (amber) | 가격대 RRP 막대 |
| `--chart-color-6` (orange) | 채널 막대 |
| `--bg-card` | dash-stat / dash-summary-card 배경 |
| `--border-subtle / -default` | 카드 보더 + hover 전환 |
| `--accent-primary` | toggle-bucket active + buy-rate-cmp 값 |

### 미사용 chart palette (Phase 7 후 향후 확장 여유)

| 토큰 | 의도 |
|---|---|
| `--chart-color-4` (info blue) | 시즌별 막대 후보 |
| `--chart-color-5` (magenta) | 컬러 분포 막대 후보 |
| `--chart-color-7` (mint) | 카테고리/성별 보조 |
| `--chart-color-8` (red — danger) | 위험 SKU 강조 막대 후보 |

현재는 7개 통계 차트가 모두 동일 색(--chart-color-1)을 쓰는 단색 패턴. Phase 7 / 라운드 4에서 차트별 색 다르게 할 수 있는 기반 확보.

---

## 5. 함정 또는 의심 항목

### 5.1 `getComputedStyle` 호출 시점 — 토큰값 미주입 위험
`renderDashboard`는 페이지 로드 후 호출되며, design-tokens.css가 이미 적용된 상태. `tokenColor`는 첫 호출 시 한 번 캐시 → 동일 토큰 재사용 시 비용 0. **문제 없음**.

### 5.2 토큰값 변경 시 차트 미반영
`_tokenCache`는 페이지 라이프타임 동안 유지. 라이트/다크 테마 전환 같은 동적 토큰 변경 시 캐시 invalidate 필요 (현재는 단일 다크 테마만이라 무관). 향후 테마 전환 도입 시 `_tokenCache = {}` 호출 추가.

### 5.3 `rgba()` 토큰 변환
`--text-secondary: rgba(255,255,255,0.65)` 같은 RGBA 토큰을 `getComputedStyle`로 읽으면 그대로 RGBA 문자열 반환. SVG `fill=`은 RGBA 직접 지원 → 정상 동작. E2E test 7 통과로 확인.

### 5.4 chart-color-2 값 검증
`--chart-color-2: #27AE60`로 정의됨 (= `--signal-success`). 가격대 JSC 막대(녹)와 BUY 결정 버튼(녹)이 같은 톤 — Linear의 "한 가지 의미 = 한 가지 색" 원칙. 의도적 정합. 만약 분리 필요하면 chart-color-2를 `#6FCF97`(mint) 같은 별도 톤으로 변경 가능.

### 5.5 인라인 RGBA 잔존 (Phase 4 + 5)
- 등급 배지 4종 (rgba(39,174,96,0.10) 등) — Phase 4 잔존
- cell-mismatch (rgba(235,87,87,0.12)) — Phase 4 잔존

총 5건. 모두 단일 hex 토큰의 투명도 변환 형태. **Phase 7에서 `--signal-*-soft` 보조 토큰 추가**로 일괄 정리 가능 (선택 사항).

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 7 진입 가능 (자율 진행 — 단, Phase 7 끝나면 사용자 시연 요청).**

Phase 7은 최종 회귀 + 신규 시각 회귀 5종 + baseline vs round-3-B diff + 토큰 사용처 표 + tag round-3-b. 명령서 [승인 절차]: "Phase 7 끝나면 사용자에게 시연 요청".
