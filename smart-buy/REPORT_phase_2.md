# Round 3-B · Phase 2 — 레이아웃 골격 재구성

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 커밋 `7305ef7` (Phase 1) → Phase 2 commit 예정

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| `index.html` | `<style>` 영역 전체 재구성: header / main / mode-toggle / input-panel / file-drop / single-form / btn / tabs / empty-state / #status-bar |
| `index.html` `<body>` | `<header>` 마크업 — brand wrapper + brand-mark dot + h1 with .version-tag |

JS 변경 0. CSS 클래스명 / data-testid / id 변경 0 (E2E selector 보존).

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 |
|---|---|
| `engine/diagnose.test.mjs` | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | **9/9 pass** (16.16ms) ✓ |
| Playwright E2E 12/12 | **12/12 pass** (46.7s — Phase 1 1.4m → 정상 캐시화) ✓ |
| 콘솔 에러 (E2E test 1) | **0건** ✓ |
| `_oracle/v12-functions.mjs` 변경 | 0줄 ✓ |

---

## 3. 신규 시각

### 3.1 헤더 (Linear workspace 패턴)

**Before** (Phase 1 시점):
```
스마트 매입 NC PICKS v13-Lite v1.4 — Round 2     on-demand · 9개 진단 · ...
```
- 평면 텍스트, 단순 좌-우 정렬, 16px 24px 패딩

**After** (Phase 2):
```
[S] 스마트 매입 [v13-Lite · Round 3-B]            on-demand · 9개 진단 · ...
```
- `position: sticky; top: 0` + `backdrop-filter: blur(8px)` — 스크롤 시 상단 고정
- `.brand-mark` (24×24) — 액센트 보라 → 호버 보라 그라디언트 + "S" 모노그램
- `.version-tag` — 알약형 보더 칩 (Linear 워크스페이스 헤더 패턴)
- `padding: var(--space-3) var(--space-6)` (12px 24px) — 압축
- `background: var(--bg-elevated)` + `border-bottom: 1px solid var(--border-subtle)`

스크린샷은 다음 E2E 자동 갱신본 참조:
- `test/_screenshots/round2/01-dashboard-loaded.png` — 새 헤더 + sticky
- `test/_screenshots/round2/02-uploaded-dashboard.png` — 헤더 + 결과 영역

### 3.2 탭 (Linear active 패턴)

**Before**: 단순 텍스트, 4px gap, 하단 보더 active 표시
**After**:
- gap 0 (탭이 인접) + `padding: var(--space-3) var(--space-4)`
- 비활성: `var(--text-secondary)` + medium weight + transparent border
- active: `var(--text-primary)` + **semibold** + `var(--accent-primary)` 하단 보더
- hover: 색상 transition (`var(--dur-fast) var(--ease-standard)`)
- `margin-bottom: -1px` — 컨테이너 보더와 active border 정렬 (Linear 디테일)

### 3.3 모드 토글 (segmented control)

- 컨테이너에 `padding: 2px` + `background: var(--bg-card)` + `border-radius: var(--r-md)` (Linear 세그먼트)
- 비활성 hover: 텍스트만 밝아짐
- active: 액센트 보라 배경 + `--fw-semibold`

### 3.4 메인 컨테이너

- `max-width: 1400px → 1280px` (Linear 워크스페이스 톤)
- `padding: var(--space-6) var(--space-7)` (24px 32px)

### 3.5 폼 / 버튼 마이크로 디테일

- Input/select **focus ring** 추가: `box-shadow: 0 0 0 3px var(--accent-subtle)`
- `.btn` hover: opacity → background swap (`--accent-primary` → `--accent-hover`)
- File drop hover/over: 보더 보라 + 배경 `--accent-subtle`

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

Phase 2는 **신 토큰 추가 0** — 모두 Phase 1에서 정의한 79개 토큰 + 15 alias 활용.

### 4.1 Phase 2에서 처음 사용된 신 토큰 (사용처 ↔ 토큰)

| 토큰 | 사용처 | 비고 |
|---|---|---|
| `--bg-elevated` | header 배경, status-bar 배경 | 기존 `--panel` alias 거치지 않고 직접 |
| `--bg-card` | mode-toggle 컨테이너 | 기존 `--panel-2` 직접 |
| `--bg-base` | single-form input 배경 | 직접 |
| `--border-subtle` | header / input-panel / status-bar | 직접 |
| `--border-default` | mode-toggle 컨테이너 / file-drop / single-form input | 직접 |
| `--text-primary` | header h1 / tabs active / btn focus | 직접 |
| `--text-secondary` | mode-toggle 비활성 / single-form label / tabs 비활성 | 직접 |
| `--text-tertiary` | header version-tag / meta / empty-state | 직접 |
| `--accent-primary` | brand-mark / btn / mode-toggle active / tabs active border | 직접 |
| `--accent-hover` | brand-mark gradient / btn hover | 직접 |
| `--accent-subtle` | input focus ring / file-drop over | 직접 |
| `--space-1` ~ `--space-8` | 모든 padding / margin / gap | 8px grid |
| `--fs-xs / -sm / -base` | label / 본문 / 작은 텍스트 | |
| `--fw-medium / -semibold / -bold` | label / 탭 / 액션 / brand-mark | |
| `--r-sm / -md / -lg / -pill` | 버튼 / 컨테이너 / version-tag | |
| `--dur-fast`, `--ease-standard` | 모든 transition | |

### 4.2 Phase 1 alias 의존이 남은 영역 (Phase 4·5에서 직접 교체 예정)

- `dashboard.js` SVG `fill=` 인라인 hex (Phase 6 헬퍼화)
- `sku-table.js` 인라인 `style="color:var(--muted)"` 7건 (Phase 4·5에서 클래스화)
- index.html 내 `.dash-*` / `table.sku` / `.detail-panel` / `.actions` / `.btn-buy/-counter/-pass` / `.grade-badge` 영역 — Phase 3·4·5에서 토큰 직접 사용으로 교체

---

## 5. 함정 또는 의심 항목

### 5.1 sticky header + 결과 영역 스크롤 — 검증됨
`position: sticky; top: 0; z-index: 10`. 결과 영역의 표 스크롤(`max-height: 70vh`)과 충돌 없는지 E2E test 1·9에서 sticky 위치 영향 받는 selector 사용하지 않음 → 회귀 0. 단, Phase 7 시연 시 사용자 스크롤 체감 확인 권장.

### 5.2 backdrop-filter — Chromium만 검증
E2E는 Chromium만 사용. Safari 14+ / Firefox 103+에서 지원되나 라운드 5 다국어/다브라우저 검증에서 재확인 권장.

### 5.3 brand-mark "S" 모노그램
Linear는 워크스페이스 이니셜을 사용. 픽스 본체와 통합 시 픽스 로고로 교체 가능. 현재는 "S" (Smart-buy) 채택. 픽스 본체 정식 SVG 로고 입수 시 `<span class="brand-mark">` 내부만 교체.

### 5.4 max-width 1280px 변경의 가시 영향
1400 → 1280 변경으로 1400+ 화면에서 양 사이드 여백이 늘어남. 표(`min-width: 1100px`)는 여전히 들어맞으므로 가로 스크롤 발생 영향 없음. **Phase 7에서 1920×1080 캡처 검토 권장**.

### 5.5 인라인 style 잔존
`<header>` 안 인라인 `style="color:var(--muted);..."` (이전) → **제거 완료**. `index.html` 본문에 인라인 style 잔존 0건. `<section style="display:none;">` 1건은 JS가 토글하는 boolean 상태이므로 인라인 색상/폰트사이즈 금지 규정 대상 아님 (display 토글). 향후 Phase에서 `[hidden]` 속성 또는 클래스로 대체 가능.

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 3 진입 가능 (사용자 확인 필요한 단계).**

명령서 [자율 vs 사용자 확인 요청 기준]에 따라 Phase 3은 **KPI 위계 (어떤 KPI를 히어로로 올릴지)** 후보 2~3개를 사용자에게 제시하고 승인 대기. 회귀 / 콘솔 / 절대 규칙 위반 0.
