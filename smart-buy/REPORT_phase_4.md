# Round 3-B · Phase 4 — 18 컬럼 SKU 표 시각 개편

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 = Phase 3 commit → Phase 4 commit 예정

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| `index.html` `<style>` | `.table-layout`, `.table-wrap`, `table.sku` (헤더/본문/sticky/sort/hover/active/cell-mismatch/num/actions-cell), `.actions`, `.btn-buy/-counter/-pass`, `.btn-*.decided`, **`.src-tag` (신규 — Phase 0 미정의 발견 항목 해결)** |

JS 변경 0. **컬럼 수 18개, 정렬 동작, data-testid, 클래스명 모두 보존.**

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 |
|---|---|
| `engine/diagnose.test.mjs` | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | **9/9 pass** (12.92ms) ✓ |
| Playwright E2E | **12/12 pass** (1.7m) ✓ |
| 콘솔 에러 (E2E test 1) | **0건** ✓ |
| `_oracle/v12-functions.mjs` 변경 | 0줄 ✓ |

E2E test 4·5 (BUY 클릭 + decided 클래스 시각 피드백): ghost → solid 패턴으로 바뀌었으나 `.decided` 클래스 + 색상 적용 그대로 → 통과. Test 10 (cell-mismatch 빨간 배지): 색상이 `#ffb1ab` → `var(--signal-danger)`로 바뀌었으나 selector 보존 → 통과. Test 11 (sort-asc/-desc): 화살표 색상이 `--accent` → `--accent-primary`로 alias 경유 + 라벨 색 추가됐으나 클래스명 보존 → 통과.

---

## 3. 신규 시각

### 3.1 표 헤더 — Linear 02번 (display-options) 패턴

**Before**: 11px regular text-secondary, 정렬 화살표만 액센트
**After**:
- `var(--fs-xs)` semibold UPPERCASE + 0.04em tracking — Linear 섹션 라벨과 통일
- hover 시 텍스트 primary 컬러로 (`var(--text-secondary) → var(--text-primary)`) — 클릭 가능 신호
- sort-asc/-desc 시 라벨 텍스트도 primary 컬러 (이전: 화살표만 강조 → 헤더 전체 강조)
- 헤더 하단 1px 보더 strong (`--border-default` 사용 — body row보다 약간 짙게) → sticky 헤더 분리감

### 3.2 본문 행 — Linear 워크스페이스 표 톤

**Before**: 12px, padding 6px 8px, hover bg `--panel-2`
**After**:
- `var(--fs-sm)` (13px) — 본문 14px → 13px (테이블 밀도 유지)
- padding `var(--space-2) var(--space-3)` (8px 12px) — 좌우 살짝 넓힘
- hover: `var(--bg-card)` (subtle) + `var(--dur-fast)` transition
- **active row**: `var(--accent-subtle)` 배경 + **left 2px 보라 라인** (`box-shadow: inset 2px 0 0 var(--accent-primary)`) — Linear 선택 행 패턴

### 3.3 cell-mismatch (가격 모순) — Linear 톤

**Before**: `rgba(231, 76, 60, 0.18)` 배경 + `#ffb1ab` 텍스트 (인라인 hex) + bold
**After**:
- 배경: `rgba(235, 87, 87, 0.12)` (signal-danger 12% — Linear soft danger)
- 텍스트: `var(--signal-danger)` 직접
- weight: semibold
- ⚠ 아이콘 + 2px margin-right (시각 정렬)

### 3.4 결정 버튼 (BUY/COUNTER/PASS) — Linear ghost → solid 패턴

**Before**: 기본 상태부터 솔리드 컬러 채움 (BUY 녹/COUNTER 주/PASS 회), decided 시 box-shadow ring
**After**:
- 기본: ghost — 투명 배경 + `var(--border-default)` 보더 + `var(--text-secondary)` 텍스트
- hover: 매칭 시그널 컬러로 텍스트+보더 전환 (BUY → success, COUNTER → warning, PASS → strong)
- **decided**: 솔리드 채움 + 흰/검 텍스트
  - BUY: `var(--signal-success)` 배경 + 흰
  - COUNTER: `var(--signal-warning)` 배경 + 어두운 텍스트(노란 배경 명도 대비)
  - PASS: `var(--text-tertiary)` 배경 + bg-base 텍스트

이 변경으로 **결정된 행이 시각적으로 명확** — 이전엔 모든 버튼이 솔리드라 decided 구분이 box-shadow ring에 의존했지만, 이제 ghost↔solid 대비로 즉각 인지.

### 3.5 .src-tag — Phase 0 미정의 발견 항목 해결

`sku-table.js:38`에서 `<span class="src-tag">추정</span>`을 출력하지만 CSS 정의 없어 무스타일 표시. Phase 4에서 `table.sku .src-tag` 정의 추가:
- 작은 보더 칩 (1px var(--border-default))
- 텍스트: `var(--text-tertiary)` (값 옆에 작게)
- font-size: var(--fs-xs)

이는 **추정값(rrp_synth) 신호의 표 단위 시각화** — 명령서 [Phase 5] "회색 배지(rrp_synth)" 디테일 패널 부분과 통일된 톤으로 표 본문에서도 노출.

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

신 토큰 추가 0.

### Phase 4에서 처음 사용된 토큰

| 토큰 | 사용처 |
|---|---|
| `--bg-elevated` | table-wrap 배경 |
| `--bg-card` | th 배경 + tr hover |
| `--border-subtle` | tr 보더 |
| `--border-default` | th 하단 분리 보더 + 결정 버튼 ghost 보더 + .src-tag 보더 |
| `--border-strong` | PASS hover 보더 (subtle 강조) |
| `--accent-primary` | sort 화살표 + active row inset shadow |
| `--accent-subtle` | active row 배경 |
| `--signal-danger` | cell-mismatch 텍스트 |
| `--signal-success` | BUY hover/decided |
| `--signal-warning` | COUNTER hover/decided |
| `--text-tertiary` | PASS decided 배경 + .src-tag 텍스트 |
| `--fs-xs / -sm` | 헤더 / 본문 |
| `--fw-semibold` | 헤더 + 결정 버튼 |
| `--r-sm / -lg` | 결정 버튼 / 표 컨테이너 |
| `--dur-fast`, `--ease-standard` | 헤더/행/버튼 transition |

### `.src-tag` 신규 클래스 정의 — Phase 0 인벤토리에서 발견된 미정의 클래스 처리 완료.

---

## 5. 함정 또는 의심 항목

### 5.1 cell-mismatch RGBA 인라인 1건 잔존
`background: rgba(235, 87, 87, 0.12)` — `--signal-danger #EB5757`의 12% 투명도. 단일 hex 토큰만 정의해 RGBA 변환을 인라인. **Phase 6에서 `--signal-danger-soft` 같은 보조 토큰 추가 시 정리 가능**. 현재 인라인 4건 (등급 배지 4종) + 1건 (cell-mismatch) = 5건. 모두 명령서 "인라인 색상 금지"의 컴포넌트 hex 직접 박기 의미와는 다름 (토큰 hex의 투명도 변환 형태).

### 5.2 decided COUNTER 텍스트 컬러 `#1a1a1a` 인라인
노란 배경 + 흰 텍스트는 명도 대비 부족. WCAG 4.5:1 준수를 위해 어두운 텍스트(`#1a1a1a`) 사용. 토큰화하려면 `--text-on-warning` 같은 새 토큰 필요. **Phase 6에서 도입 예정** — 현재는 1건 인라인.

### 5.3 active row inset shadow vs sticky header
sticky 헤더의 z-index 1 + active row의 inset box-shadow가 시각 충돌하지 않는지 E2E test 9 + 11에서 검증됨. 사용자 시연 시 표 스크롤 시 active row가 헤더 아래로 들어가는 것 확인 권장.

### 5.4 ghost 결정 버튼의 클릭 영역
이전 솔리드보다 패딩 정렬 (3px 8px) — 클릭 영역은 동일하지만 hover 피드백이 달라짐. test 4 (firstBuy.click()) 통과 → 클릭 동작 정상.

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 5 진입 가능 (자율 진행).**

Phase 5는 디테일 패널 시각 개편 + `psychPriceSource: 'rrp_synth'` 회색 배지 추가. 디테일 패널의 `.detail-panel` 영역과 sku-table.js의 `renderDetail` 함수 일부 인라인 style 클래스화.
