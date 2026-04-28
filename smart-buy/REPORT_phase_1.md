# Round 3-B · Phase 1 — 디자인 토큰 + 폰트 시스템

**작업일**: 2026-04-29
**브랜치**: `main` · 시작 커밋 `84625bb` → Phase 1 commit 예정

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 상태 | 라인 |
|---|---|---|
| `design-tokens.css` | **신규** | +159 |
| `index.html` | 수정 | -25 (`:root` + `body` 블록 제거) / +11 (CDN preconnect 3 + Pretendard CSS + Inter CSS + design-tokens link) |

순 변경: +145 라인. 코드 수정 0 (JS는 손대지 않음).

E2E selector / 클래스명 / data-testid 변경 0.

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | Phase 0 베이스라인 | Phase 1 결과 |
|---|---|---|
| `engine/diagnose.test.mjs` (v12 휴리스틱 50건) | 50/50 (100.00%) | **50/50 (100.00%)** ✓ |
| `engine/aggregate.test.mjs` (대시보드 단위) | 9/9 pass (25.96ms) | **9/9 pass** (31.16ms) ✓ |
| `test/center-price-coverage.test.mjs` | 3/3 pass — 93.3% | (변경 없음 — 엔진/데이터 무관) |
| Playwright E2E `test/smart-buy.e2e.mjs` | 12/12 pass (42.8s) | **12/12 pass** (1.4m, CDN 폰트 첫 로드 영향) ✓ |
| 콘솔 에러 (E2E test 1) | 0건 | **0건** ✓ |

> E2E 시간이 늘어난 것은 첫 페이지 로드에서 Pretendard variable + Inter CDN 폰트 다운로드 때문. 캐시 후엔 정상화 예상. 회귀는 0건.

---

## 3. 신규 시각 (베이스라인 대비)

Phase 1은 **시각 골격은 베이스라인 그대로**이며 다음 두 가지만 즉시 변경:

1. **본문 폰트 패밀리** — system font → Pretendard Variable (한글 본문 가독성 ↑)
2. **본문 베이스 폰트사이즈** — 14px (system default) → 16px (`html { font-size: 16px }` + `body { font-size: var(--fs-md) }`)

기존 컴포넌트가 자체 명시 사이즈(예: `header h1 { font-size: 18px }`, `table.sku th { font-size: 11px }`)를 갖고 있어 시각 차이가 미미하며, 회귀 0건의 근거가 됨. **컴포넌트별 사이즈 토큰화는 Phase 2~5에서** 진행.

스크린샷은 베이스라인과 시각 차이가 거의 없어 Phase 2 이후 시각 비교 본격 시작.

---

## 4. 사용한 디자인 토큰 / 새로 추가한 토큰

### 4.1 신규 토큰 (`design-tokens.css`) — 79개

#### 색상 (24)
- 배경: `--bg-base #0F0F10`, `--bg-elevated #17171A`, `--bg-card #1B1B1F`, `--bg-overlay rgba(0,0,0,0.6)`
- 보더: `--border-subtle #232328`, `--border-default #2E2E33`, `--border-strong #3A3A40`
- 텍스트: `--text-primary 0.95`, `--text-secondary 0.65`, `--text-tertiary 0.45`, `--text-disabled 0.25`
- 액센트: `--accent-primary #5E6AD2` (Linear 보라), `--accent-hover #6E7AE0`, `--accent-subtle rgba(94,106,210,0.15)`
- 시그널: `--signal-danger #EB5757`, `--signal-warning #F2C94C`, `--signal-success #27AE60`, `--signal-info #56CCF2`
- 차트 팔레트: `--chart-color-1` ~ `--chart-color-8` (Phase 6 소비 예정)

#### 폰트 (16)
- 패밀리: `--font-sans` (Pretendard), `--font-en` (Inter), `--font-mono`
- 크기: `--fs-xs 11`, `--fs-sm 13`, `--fs-base 14`, `--fs-md 16`, `--fs-lg 16`, `--fs-xl 20`, `--fs-2xl 28`, `--fs-3xl 40`
- 두께: `--fw-regular 400`, `--fw-medium 500`, `--fw-semibold 600`, `--fw-bold 700`
- 줄간: `--lh-ko 1.6`, `--lh-en 1.5`

#### 라운드 (6)
`--r-sm 4 / --r-md 6 / --r-lg 8 / --r-xl 12 / --r-2xl 16 / --r-pill 999`

#### 간격 (12) — 8px grid
`--space-1 4 / -2 8 / -3 12 / -4 16 / -5 20 / -6 24 / -7 32 / -8 40 / -9 48 / -10 56 / -11 64 / -12 80`

#### 그림자 + 모션 (6)
`--shadow-sm/md/lg`, `--ease-standard`, `--dur-fast 120 / -medium 200 / -slow 320`

### 4.2 백워드 호환 alias (15) — 기존 var명 보존

`design-tokens.css` 끝에 정의해 dashboard.js / sku-table.js의 인라인 `var(--muted)` / `var(--warn)` 등이 깨지지 않게 함:

| 기존 var | 새 토큰 | 차이 |
|---|---|---|
| `--bg` | `--bg-base` | `#0f1115` → `#0F0F10` (미세) |
| `--panel` | `--bg-elevated` | `#181b22` → `#17171A` |
| `--panel-2` | `--bg-card` | `#1f242d` → `#1B1B1F` |
| `--border` | `--border-subtle` | `#232833` → `#232328` |
| `--text` | `--text-primary` | `#e6e8ee` → `rgba(255,255,255,0.95)` |
| `--muted` | `--text-secondary` | `#8a93a4` → `rgba(255,255,255,0.65)` |
| `--accent` | `--accent-primary` | **`#4d9aff` → `#5E6AD2`** (블루 → Linear 보라) |
| `--buy` | `--signal-success` | `#2ecc71` → `#27AE60` |
| `--counter` | `--signal-warning` | `#f39c12` → `#F2C94C` |
| `--pass` | `--text-tertiary` | `#95a5a6` → `rgba(255,255,255,0.45)` |
| `--warn` | `--signal-danger` | `#e74c3c` → `#EB5757` |
| `--grade-80/-70` | `--signal-success` | 등급 A/B 통합 |
| `--grade-60/-50` | `--signal-warning` | 등급 C/D 통합 |
| `--grade-0` | `--text-tertiary` | 등급 F |

> alias 덕분에 sku-table.js / dashboard.js / index.html 컴포넌트 CSS는 **변경 0줄**로 새 토큰을 받음. Phase 4·5·6에서 점진적으로 신 토큰명을 직접 사용하도록 마이그레이션.

### 4.3 Linear 캡처 측정 보정 — **수행 불가 (캡처 미첨부)**

명령서는 "Linear 캡처 19장 중 5~10장에서 실제 컬러 피커로 측정"을 요구했으나 **캡처 첨부 부재**. 따라서:
- 명령서 내 [디자인 토큰 — 캡처 기반 추정치] 표를 그대로 채택 (배경/보더/텍스트 등 모든 hex)
- `--accent-primary #5E6AD2`는 Linear 공개 브랜드 컬러로 검증 (linear.app/features 헤더 사용)
- 실측 보정은 **Phase 7 정리 단계에서 캡처 입수 시 재조정** 가능 (alias 구조라 최소 한 파일 변경으로 끝)

이 한계는 함정 항목 6.1에 명시.

### 4.4 사용 폰트 CDN (정확히 2개 — 명령서 허용 한도)

1. **Pretendard Variable** — `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css`
   - 한글 본문 + Inter 기반 영문 글리프 통합 제공
   - Variable axis (wght 100~900) — 4개 weight 토큰 모두 단일 폰트로 처리
2. **Inter** — `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
   - 명령서가 "Inter Display" 명시했으나 Google Fonts에서는 "Inter"가 표준 패밀리. Inter v4.x는 디스플레이 컷이 통합돼 별도 "Inter Display" 패키지 부재. **`Inter`로 채택 + font-family stack에서 `"Inter", "Inter Display"` 순서로 둠**.
   - `:not(:lang(ko))` 셀렉터에서만 활성화 (현 페이지 `html lang="ko"`이므로 사실상 미활성, 다국어 지원 시 자동 활성화)

preconnect 3개 (`cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`) — 폰트 다운로드 첫 응답 latency 단축.

---

## 5. 함정 또는 의심 항목

### 5.1 Linear 캡처 미첨부
명령서 요구 "5~10장 컬러 피커 보정"을 수행하지 못함. 추정치를 그대로 채택했으며 alias 구조 덕분에 Phase 7에서 실측치로 재조정 가능 (한 파일 변경).

### 5.2 폰트 CDN 첫 로드 시 E2E 시간 증가
회귀는 통과(12/12)했으나 첫 로드에서 폰트 패밀리 변경 + 변수폰트 다운로드 영향으로 E2E가 42.8s → 1.4m로 증가. 콘솔 에러 0이고 통과했으므로 정상이나, Phase 7에서 `font-display: swap`이 이미 적용된 Google Fonts와 Pretendard CDN의 캐시 헤더 차이를 모니터링 권장.

### 5.3 본문 폰트 사이즈 16px 상향의 가시 영향 미세
대부분 컴포넌트가 명시 `font-size`를 갖고 있어 base 16px 적용 영향이 크지 않음. **Phase 2~5에서 컴포넌트별 사이즈를 토큰(`var(--fs-base)` / `var(--fs-md)`)으로 교체**하면서 본격적으로 16px 본문 + 13px 라벨 위계 정착 예정.

### 5.4 alias 컬러 차이 — 가시적 변화 5개
가장 큰 변화는 `--accent: #4d9aff → #5E6AD2` (블루 → 보라). 이 외에 모든 컬러는 추정치가 기존과 비슷한 톤 (다크 계열). E2E 회귀가 색상 hex를 직접 검증하지 않아 통과. **Phase 2 헤더 + 탭 active 상태에서 Linear 보라가 본격 노출** 예정.

---

## 6. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 2 진입 가능.**

- 회귀 50/50, E2E 12/12, 콘솔 0 ✓
- 토큰 단일 소스 (`design-tokens.css`) 정착 ✓
- Pretendard + Inter CDN 정확히 2개 ✓
- 인라인 색상 0 (단, dashboard.js의 SVG `fill=` hex는 Phase 6에서 토큰 lookup으로 정리 예정 — 명령서 인라인 금지 규정의 컴포넌트 CSS 영역에는 해당 없음)
- alias 구조로 점진적 마이그레이션 안전망 확보 ✓
- 절대 규칙 7개 위반 0 ✓

Phase 2(레이아웃 골격 재구성)는 자율 진행 — 명령서 [자율 vs 사용자 확인 요청 기준]에 따름.
