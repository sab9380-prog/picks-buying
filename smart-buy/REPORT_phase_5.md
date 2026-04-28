# Round 3-B · Phase 5 — 디테일 패널 시각 개편

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 = Phase 4 commit → Phase 5 commit 예정

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| `index.html` `<style>` | `.detail-panel` 영역 전면 토큰화 + `psych-source-badge` (DB/synth/none) + `psych-source-note` + `meta-mono` + `section-note` + `psych-ratio-danger` + `data-empty` + `cell-empty` + `diagnosis-items` 신규 클래스 |
| `sku-table.js` | `renderDetail` 인라인 style **7건 모두 제거** + psychPriceSource 회색 배지 노출 + "추정값 — 라운드 4 보정 예정 (RRP × 0.55 계수)" 주석 표시. **휴리스틱 / 가격 계산 로직 변경 0**. |

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 |
|---|---|
| `engine/diagnose.test.mjs` | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` | **9/9 pass** (26.55ms) ✓ |
| Playwright E2E | **12/12 pass** (51.4s) ✓ |
| 콘솔 에러 (E2E test 1) | **0건** ✓ |
| `_oracle/v12-functions.mjs` 변경 | 0줄 ✓ |

E2E test 9 (디테일 패널 슬라이드 인 + `header h3` 가시 + close 버튼): selector / DOM 구조 보존 → 통과.

---

## 3. 신규 시각

### 3.1 디테일 패널 컨테이너 (Linear card)
- background: `var(--bg-elevated)` + `var(--border-subtle)` + `var(--shadow-md)` (다크 톤에서도 카드 부유감 표현)
- padding: 16px → `var(--space-5)` (20px)
- 내부 sticky `top: var(--space-4)`

### 3.2 헤더 영역 (상단 큰 컨텍스트 — Linear 04번 / 14번 패턴)
- h3: 14px → `var(--fs-lg)` (16px) semibold + `letter-spacing: -0.01em` + line-height 1.3
- close 버튼: 호버 시 텍스트 primary + 배경 `var(--bg-card)` (Linear 액션 버튼 패턴)
- meta 부제: `var(--fs-xs)` text-tertiary

### 3.3 섹션 + 라벨 위계
- 섹션 라벨 (h4): UPPERCASE + 0.04em tracking + semibold (이전 12px regular → 11px semibold UPPERCASE)
- 섹션 보더: `var(--border-subtle)` + padding-top `var(--space-3)`
- 섹션 간 마진 `var(--space-4)`

### 3.4 KV 그리드 정렬 — Linear 메타 그리드 패턴
- grid-template-columns: 1fr 1fr → **`minmax(0, 0.9fr) minmax(0, 1.1fr)`** (라벨 약간 좁게)
- gap 4px 8px → `var(--space-1) var(--space-3)`
- 값(b): `text-align: right` + `font-variant-numeric: tabular-nums` + semibold (Linear 메트릭 표시 패턴)
- 라벨(span): `var(--text-secondary)`, 값: `var(--text-primary)`
- baseline 정렬 → 라벨/값 시각 baseline 일치

### 3.5 가격 시그널 — psychPriceSource 회색 배지 (명령서 핵심 요구)

**Before** (인라인 + 안의 텍스트만):
```
고객심리가  | 199,500 (RRP 추정)     ← 텍스트로만
심리가대비 | 92.3%                  ← 인라인 색상 분기
```

**After**:
```
고객심리가  | 199,500 [추정값]       ← psych-source-badge.synth
                                   ↳ 추정값 — 라운드 4 보정 예정 (RRP × 0.55 계수)
                                     (psych-source-note · italic · text-tertiary)

고객심리가  | 220,000 [DB 매칭]      ← psych-source-badge.db (보라 보더)

심리가대비 | 92.3% (signal-danger)   ← psych-ratio-danger 클래스
```

**3종 배지 스타일**:
| psychPriceSource | 클래스 | 시각 |
|---|---|---|
| `'db'` | `.db` | `var(--accent-primary)` 보더 + `var(--accent-subtle)` 배경 — 직접 매칭 신뢰 |
| `'rrp_synth'` | `.synth` | `var(--border-default)` 보더 + `var(--bg-card)` 배경 + tertiary 텍스트 — 추정 |
| `undefined` | `.none` | `.synth`와 동일 (회색) |

**라운드 4 보정 예정 주석**: `rrp_synth`인 경우에만 노출. 명령서 [Phase 5] 요구사항의 "휴리스틱은 손대지 않음. 표시만 분리." 정확히 준수.

### 3.6 인라인 style 7건 → 클래스화 완료

| 위치 | 이전 인라인 | 신규 클래스 |
|---|---|---|
| `sku-table.js:37` (psychPrice 미산출) | `style="color:var(--muted)"` | `class="cell-empty"` |
| `sku-table.js:213` (9개 진단 미보유) | `style="color:var(--muted)"` | `class="data-empty"` |
| `sku-table.js:230` (SKU ID 작게) | `style="font-size:10px"` | `class="meta-mono"` (모노 + var(--fs-xs)) |
| `sku-table.js:244` (psychRatio>1) | `style="${...?'color:var(--warn)':''}"` | `class="psych-ratio-danger"` (조건부) |
| `sku-table.js:246` (price note) | `class="meta" style="margin-top:6px"` | `class="section-note"` (italic + tertiary) |
| `sku-table.js:259` (keywords) | `class="meta" style="margin-top:6px"` | `class="section-note"` (동상) |
| `sku-table.js:264` (9개 진단 본문) | `style="font-size:12px"` | `class="diagnosis-items"` (var(--fs-sm) + flex column) |

**인라인 style 잔존 0건** (sku-table.js).

### 3.7 메모 입력 (textarea)
- focus ring 추가: `box-shadow: 0 0 0 3px var(--accent-subtle)` + `border-color: var(--accent-primary)`
- min-height 36px → 56px (실제 메모 작성 공간 확장)
- padding tokenized

### 3.8 이전 결정 history
- font-size: var(--fs-xs)
- 결정 텍스트(b): primary + semibold

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

신 디자인 토큰 추가 0. **신규 CSS 클래스 9개**:
- `.psych-source-badge` + `.db / .synth` modifier
- `.psych-source-note`
- `.meta-mono`
- `.section-note`
- `.psych-ratio-danger`
- `.data-empty`
- `.cell-empty` (table.sku 안)
- `.diagnosis-items`

### Phase 5에서 처음 사용된 토큰

| 토큰 | 사용처 |
|---|---|
| `--shadow-md` | 디테일 패널 컨테이너 부유감 |
| `--font-mono` | SKU ID (`meta-mono`) |
| `--fs-lg` | 디테일 패널 h3 |
| `--fs-xl` | close 버튼 × |
| `--accent-primary / -subtle` | psych-source-badge.db |
| `--signal-warning` | risk 텍스트 |
| `--signal-danger` | psych-ratio-danger |

---

## 5. 함정 또는 의심 항목

### 5.1 휴리스틱 손대지 않음 ✓
명령서 [Phase 5] "단, 휴리스틱은 손대지 않음. 표시만 분리." 정확히 준수. `engine/price.js`, `engine/diagnose.js` 변경 0줄. `psychPriceSource` 값 자체는 `engine/price.js`에서 그대로 산출되며 디테일 패널은 그 값을 시각화만 함.

### 5.2 "라운드 4 보정 예정" 주석 — 핵심 정직성 신호
`rrp_synth` 추정값 노출 시 사용자가 "이 가격이 실제 매출 데이터 기반인가?"로 오해할 수 있음. Phase 5에서 **추정 사실 + 0.55 계수 + 라운드 4 보정 약속**을 명시 표기 → 사용자 신뢰 + 데이터 한계 정직성 확보. 이는 라운드 2 보고서의 "함정 1번" 정신을 디테일 패널까지 확장.

### 5.3 detail-panel header sticky 충돌
외부 페이지 `<header>`가 sticky인데 `.detail-panel header`가 같은 태그 사용. CSS는 `.detail-panel header`에 명시적으로 `position: static; backdrop-filter: none; padding: 0; border: 0;`로 외부 헤더 규칙 무력화. E2E test 9 통과 → 정상.

### 5.4 close 버튼 확장 hit-area
이전 인라인 18px 텍스트만 → 패딩 + radius + hover bg로 클릭 영역 확대 (Linear 액션 패턴). 모바일 친화 + 시각 정렬.

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 6 진입 가능 (자율 진행).**

Phase 6은 차트 / 분포 시각화 폴리싱 — `dashboard.js` SVG 인라인 hex 7건을 `--chart-color-1~8` 토큰 lookup으로 교체 + 통계 7종 톤 정렬. 명령서 [Phase 6] Linear 16번 (Effort Distribution) / 17번 (시계열) / 18번 (Priority 누적) 차용.
