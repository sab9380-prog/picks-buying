# Round 3-B · Phase 0 — 베이스라인 수립

**버전**: smart-buy v0.2.0 (Round 2 종료 시점)
**작업일**: 2026-04-29
**브랜치**: `main` · 커밋 `84625bb` 시작점
**Phase 0 변경 라인**: 0 (read-only / 베이스라인 작업, commit 없음)

---

## 1. 변경 파일 리스트 + 라인 수 diff

| 파일 | 변경 |
|---|---|
| (없음) | Phase 0은 read-only — 회귀 재현 + 인벤토리 + 베이스라인 스크린샷만 |

신규 파일 (commit 없음, 베이스라인 산출물):
- `REPORT_phase_0.md` (이 문서)
- `test/_screenshots/round3-baseline/01..05-baseline-*.png` (5장)

> Phase 0은 commit 없이 종료. Phase 1부터 commit 발생.

---

## 2. 회귀 결과 (50/50, E2E 12/12, 콘솔 0)

| 검증 | 결과 | 명령 |
|---|---|---|
| `engine/diagnose.test.mjs` (v12 휴리스틱 50건 회귀) | **50/50 (100.00%)** | `node engine/diagnose.test.mjs` |
| `engine/aggregate.test.mjs` (대시보드 집계 단위) | **9/9 pass** (25.96ms) | `node engine/aggregate.test.mjs` |
| `test/center-price-coverage.test.mjs` (매칭률 게이트) | **3/3 pass** — 매칭률 93.3% (db 10 / rrp_synth 18 / 미매칭 2) | `node test/center-price-coverage.test.mjs` |
| Playwright E2E `test/smart-buy.e2e.mjs` | **12/12 pass** (42.8s) | `npx playwright test` |
| 콘솔 에러 (E2E test 1 추적) | **0건** | pageerror + console.error 합산 |

**서버 환경 주의**: 명령서는 "vite + vite preview (포트 4173)"으로 명시됐으나 실제 `playwright.config.mjs`의 `webServer.command`는 `npx http-server . -p 4173 --silent -c-1` (vite 미설치, devDependencies 부재). 같은 포트라 Playwright가 자동 기동·재사용하므로 호환 정상. Phase 1 이후도 이 구성 그대로 사용 예정.

---

## 3. 신규 시각 (베이스라인 스크린샷 5종)

명령서 요구 사항 매핑 — Phase 7에서 라운드 3-B 신규 시각과 1:1 비교를 위한 baseline.

| # | 명령서 요구 | 파일 | 출처 |
|---|---|---|---|
| 1 | 전체 오퍼 (대시보드) | `test/_screenshots/round3-baseline/01-baseline-overview.png` | E2E test 2 (`02-uploaded-dashboard.png`) |
| 2 | TOP 20 | `test/_screenshots/round3-baseline/02-baseline-top20.png` | E2E test 3 (`05-table-top20.png`) |
| 3 | 전체 SKU 표 | `test/_screenshots/round3-baseline/03-baseline-all-sku.png` | E2E test 3 (`06-table-all.png`) |
| 4 | 디테일 패널 열림 | `test/_screenshots/round3-baseline/04-baseline-detail-panel.png` | E2E test 9 (`07-detail-panel-open.png`) |
| 5 | 가격모순 배지 표시 | `test/_screenshots/round3-baseline/05-baseline-price-mismatch.png` | E2E test 10 (`08-price-mismatch-badge.png`) |

뷰포트: 1400×900 (Desktop Chrome, headless), `fullPage: true` (1·2·3·4) 또는 셀 단독 (5).

---

## 4. CSS / 컴포넌트 인벤토리 — "어느 파일이 어느 시각 영역을 책임지는가"

### 4.1 파일별 시각 책임 분포

| 파일 | 라인 수 | 시각 책임 | Round 3-B 영향 |
|---|---|---|---|
| `index.html` | 240 | **모든 CSS 단일 소스 (`<style>` 7~169행)** + DOM 골격 | **개편 핵심**: Phase 1 토큰화, Phase 2 헤더/탭 골격, Phase 3 KPI, Phase 4 표, Phase 5 디테일 |
| `dashboard.js` | 220 | 대시보드 탭 SVG 차트 + KPI 카드 inner HTML. **인라인 hex 컬러 7개**, 인라인 `font-size="11"`/`"10"` | Phase 3 KPI 위계 + Phase 6 차트 팔레트 |
| `sku-table.js` | 326 | 18-컬럼 표 + 디테일 패널 inner HTML. **인라인 `style="color:var(--muted)"` 등 7건**, `.src-tag` 클래스 사용하지만 CSS 미정의 | Phase 4 표 시각 + Phase 5 디테일 패널 |
| `app.js` | 274 | 오케스트레이션·이벤트 바인딩. 시각 책임 0 | 변경 없음 |
| `engine/*.js`, `shared/*.js` | — | 도메인 로직. 시각 책임 0 | **변경 금지 (절대 규칙 1·3)** |

### 4.2 index.html `<style>` 영역 구조 (line 7~169)

| 라인 범위 | 영역 | 라운드 3-B 개편 Phase |
|---|---|---|
| 8~25 | `:root` 변수 (현 토큰) | **Phase 1 — 전면 교체** (design-tokens.css로 이동) |
| 26~31 | `*`, `body` 리셋 + 폰트 | **Phase 1 — 폰트 family 교체** (Pretendard + Inter Display) |
| 32~37 | `header` | **Phase 2 — 재구성** (로고/탭/우측 액션 Linear 톤) |
| 38 | `main` (max-width: 1400px) | Phase 2 — 컨테이너 규정 검토 |
| 41~43 | `.mode-toggle` | Phase 2 — 액션 영역으로 통합 |
| 46~52 | `.input-panel`, `.file-drop` | Phase 2 — 카드 톤 정렬 |
| 55~64 | `.single-form`, `.btn` | Phase 2 — 폼 컨트롤 톤 정렬 |
| 67~73 | `.tabs` | **Phase 2 — Linear active 패턴** |
| 76~84 | `.grade-badge`, `.overall-grade-badge` | Phase 4 — 좌측 컬러 점 + 라벨 패턴 |
| 86~114 | 대시보드 (`.dash`, `.kpi`, `.dash-stat`, ...) | **Phase 3 — 위계 재구성** |
| 117~132 | `table.sku` (헤더 sticky, 정렬 화살표, `.cell-mismatch`) | **Phase 4 — 시각만 개편** |
| 134~151 | `.detail-panel` (sticky, kv 그리드, history) | **Phase 5 — 위계 개편** |
| 153~163 | `.actions`, `.btn-buy/-counter/-pass`, `.decided` shadow | Phase 4 — 결정 버튼 톤 |
| 165~168 | `.empty-state`, `#status-bar` | Phase 2 — 톤 정렬 |

### 4.3 인라인 색상 / 폰트사이즈 (Phase 1 토큰화 시 반드시 제거 대상)

#### `dashboard.js` — 인라인 hex 컬러 7건 (`var(--token)`로 대체 필요)

| 라인 | 코드 | 의도 | 매핑 토큰 (Phase 1 예정) |
|---|---|---|---|
| 11 | `opts.color \|\| '#4d9aff'` | 막대 기본색 (현 --accent) | `--accent-primary` |
| 25 | `fill="#8a93a4"` | 라벨 텍스트 (현 --muted) | `--text-secondary` |
| 27 | `fill="#e6e8ee"` | 값 텍스트 (현 --text) | `--text-primary` |
| 157 | `color: '#4d9aff'` | 등급 분포 막대색 | `--accent-primary` |
| 197 | `'#2ecc71' : '#f39c12'` | 가격대 JSC/RRP 토글 | `--chart-color-2`, `--chart-color-3` |
| 212 | `color: '#4d9aff'` | 도착월 막대 | `--accent-primary` |
| 217 | `color: '#e67e22'` | 채널 막대 | `--chart-color-3` |

추가: 인라인 `font-size="11"` (라벨), `font-size="10"` (값) — Phase 1에서 토큰화하지 않고 SVG attribute로 두되 Phase 6에서 일괄 재검토.

#### `sku-table.js` — 인라인 style 7건

| 라인 | 코드 | 처리 (Phase 5 예정) |
|---|---|---|
| 37 | `style="color:var(--muted)"` (psychPrice 미산출 - 표시) | 토큰 var는 그대로, 토큰명만 Phase 1에서 변경 적용 → `var(--text-tertiary)` |
| 213 | `style="color:var(--muted)"` (9개 진단 미보유 안내) | 동상 |
| 230 | `style="font-size:10px"` (SKU ID 작게) | `class="meta-mono"` 같은 클래스로 분리 |
| 244 | `style="color:var(--warn)"` (psychRatio>1 강조) | `class="ratio-danger"` 분리 |
| 246, 259 | `style="margin-top:6px"` | 클래스화 (간격 토큰) |
| 264 | `style="font-size:12px"` (9개 진단 본문) | 클래스화 |

`.src-tag` (line 38) — 클래스만 있고 CSS 정의 없음 → Phase 5에서 추가 정의 필요.

### 4.4 컴포넌트 ↔ 테스트 ID 매핑 (회귀 0 검증 기준)

E2E가 의존하는 selector — Phase 1~7 동안 **절대 보존** (변경 시 회귀 깨짐):

| selector | 사용 테스트 | 의미 |
|---|---|---|
| `header h1` | test 1 | 페이지 타이틀 |
| `[data-testid="mode-toggle"]` | test 1 | 모드 전환 |
| `#status-bar.show` 텍스트 `준비 완료` / `진단 완료` / `결정 저장: BUY` | test 1·2·4·5 | 상태바 메시지 |
| `#results-section` | test 2·5 | 결과 영역 가시성 |
| `#tab-dashboard.active` / `[data-tab="..."]` | test 2·3 | 탭 active 클래스 |
| `[data-testid="kpi-grid"] .kpi` | test 2·6 | KPI 8개 카드 |
| `[data-testid="kpi-grid"] .kpi-label` 텍스트 | test 6 | 라벨 7종 (총 SKU/총 수량/가중평균 매입율/가중평균 점수/위험 SKU/가격모순/중심가 매칭률) |
| `[data-testid="grade-distribution"] svg rect` | test 7 | 등급 막대 |
| `[data-testid="stats-grid"] .dash-stat` | test 8 | 통계 7종 블록 |
| `[data-testid="top20-table"] tbody tr`, `[data-testid="all-sku-table"] tbody tr` | test 3·4·5·11 | 표 행 |
| `[data-testid="btn-buy"].decided` | test 4·5 | 결정 시각 피드백 |
| `[data-testid="detail-top20-table"]`, `[data-testid="detail-close"]` | test 9 | 디테일 패널 |
| `td.cell-mismatch` | test 10 | 가격모순 셀 |
| `thead th[data-key="score"].sort-asc/-desc` | test 11 | 정렬 |
| `tbody tr td:nth-child(12)` % 형식 | test 12 | 매입율 컬럼 위치 (인덱스 11, 12번째 td) |

> **함의**: HTML 구조 / data-testid / CSS 클래스명 (`active`, `decided`, `cell-mismatch`, `sort-asc`, `sort-desc`, `kpi`, `kpi-label`, `dash-stat`) **변경 금지**. 시각만 개편 (보더, 컬러, 패딩, 라운드 등).

---

## 5. 사용한 디자인 토큰 / 새로 추가한 토큰

Phase 0은 토큰 추가 0. **현 토큰 (지원 종료 예정 — Phase 1에서 design-tokens.css로 교체)**:

| 카테고리 | 현 토큰 (index.html) | Phase 1 신 토큰 (예정) |
|---|---|---|
| 배경 | `--bg #0f1115`, `--panel #181b22`, `--panel-2 #1f242d` | `--bg-base`, `--bg-elevated`, `--bg-card` |
| 보더 | `--border #232833` | `--border-subtle`, `--border-default`, `--border-strong` |
| 텍스트 | `--text #e6e8ee`, `--muted #8a93a4` | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-disabled` |
| 액센트 | `--accent #4d9aff` | `--accent-primary #5E6AD2`, `--accent-hover`, `--accent-subtle` |
| 시그널 | `--buy #2ecc71`, `--counter #f39c12`, `--pass #95a5a6`, `--warn #e74c3c` | `--signal-success`, `--signal-warning`, `--signal-danger`, + `--signal-info` |
| 등급 | `--grade-80/-70/-60/-50/-0` | (보존 — `--signal-success/--accent-primary/--signal-warning/--signal-danger/--text-tertiary` 매핑) |

Linear 캡처 19장 측정값 기반 보정은 **Phase 1에서 컬러 피커로 검증** 후 최종 픽스.

---

## 6. 함정 또는 의심 항목

### 6.1 검증된 함정 (Round 2 보고서 보존, Round 3-B에서 시각 처리만 개편)
1. **중심가 매칭률 33.3% (db만)** — KPI에서 "93.3%"가 아닌 "33.3% (db만 매칭)"로 정직하게 표기 중. Phase 3에서 라벨 그대로 유지하되 시각 위계로 정직성 강화.
2. **`psychPriceSource: 'rrp_synth'` 추정값** — `RRP_PSYCH_FACTOR=0.55`. Round 4 보류. Phase 5에서 회색 배지 + "추정값 — 라운드 4 보정 예정" 라벨로 시각 분리.
3. **환율 버그 (JSC×1740, RRP×1700)** — Round 5 보류. 시각 개편 영향 없음.
4. **수량 분포 5번째 막대(평균)** — `dashboard.js` 라인 188 `qtyBins[4].value = qd.mean`이지만 라인 189 `qtyBins.slice(0, 4)`로 막대그래프에서 제거. 평균은 라벨로만 표시. Phase 6에서 의도 확인 필요.

### 6.2 신규 발견 (Phase 0)
1. **`.src-tag` 클래스 미정의** — `sku-table.js` 라인 38 `<span class="src-tag">추정</span>` 출력하지만 index.html `<style>`에 CSS 없음. 현재는 무스타일 텍스트로 노출. Phase 5에서 정의 추가 필요.
2. **인라인 hex 컬러 7개** — `dashboard.js`에 직접 박힘. Phase 1 토큰화 + 신호: SVG `fill=` 속성은 CSS 변수 직접 못 받으므로 JS 코드에서 토큰 lookup 헬퍼 필요 (예: `getComputedStyle(document.documentElement).getPropertyValue('--accent-primary')`). Phase 6에서 차트 팔레트 정의 시 이 패턴 정형화.
3. **`<header>` 셀렉터 충돌** — `index.html`의 `header` 태그와 `.detail-panel header` (디테일 패널 내부 nested header)가 동일 태그. CSS는 `.detail-panel header { padding: 0; border: 0; ... }`로 분리 처리 중 (line 136). Phase 2/5에서 헤더 톤 분리 시 영향 없음.

---

## 7. 다음 Phase 진입 가능 여부 (Y/N)

**Y — Phase 1 진입 가능.**

근거:
- 회귀 50/50, E2E 12/12, 콘솔 0 모두 재현 ✓
- 베이스라인 스크린샷 5종 확보 ✓
- CSS/컴포넌트 책임 인벤토리 완료 ✓
- E2E selector / 클래스명 보존 대상 식별 완료 ✓
- 인라인 색상·폰트사이즈 위치 7+7건 식별 완료 ✓
- 명령서 절대 규칙 7개 위반 0 (코드 변경 0줄)

Phase 1 진입 시 사용자 승인 절차에 따라 보고 후 Phase 2 자율 진행 예정.
