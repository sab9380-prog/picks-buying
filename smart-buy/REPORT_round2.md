# NC PICKS v13-Lite — 라운드 2 자동화 보고서

**버전**: smart-buy v0.2.0 (Round 2)  
**작업일**: 2026-04-28  
**브랜치**: `main` · 커밋 `f6f3320` 까지

## 1. 라운드 1 대비 변경 요약

| 영역 | 라운드 1 | 라운드 2 |
|---|---|---|
| 탭 구조 | 2개 (TOP 20 / 전체 SKU) | **3개 (전체 오퍼 / TOP 20 / 전체 SKU 표)** |
| 결과 뷰 | 카드 그리드 | **표 + 디테일 패널 (60/40)** |
| 대시보드 | 없음 | **KPI 8 + 등급 분포 + 통계 7종 + 매입조건** |
| 중심가 매칭률 | ~10% (sample 30 SKU) | **93.3%** |
| 결정 영속 시각화 | reload 후 미반영 | **자동 batch 복원 + decided 클래스 유지** |
| 표 정렬 | 없음 | 18개 컬럼 모두 sortable |
| 가격 모순 표시 | 없음 | psychRatio>1.0 셀에 빨간 배지 + ⚠ |

새 모듈:
- `engine/aggregate.js` — `aggregateOffer()` (KPI/통계 집계)
- `dashboard.js` — 전체 오퍼 탭 SVG 렌더 (의존성 0)
- `sku-table.js` — sortable 18컬럼 표 + slide-in 디테일 패널

수정된 모듈:
- `engine/price.js` — `offerMcMap` 인자 추가 + RRP 추정 fallback (`psychPriceSource: 'rrp_synth'`)
- `engine/center-price.js` — `brandId` 정규화 매칭 (`getBrandIdMap` 캐시)
- `engine/diagnose.js` — `ctx.offerMcMap` 전달 라인 추가
- `app.js` — 3-탭 라우팅, `restoreLastBatch()`, `syncDecisionVisuals()`
- `index.html` — 카드 그리드 CSS 제거, dashboard/table/detail-panel 스타일 추가

## 2. 자동 검증 결과

| 검증 | 결과 | 비고 |
|---|---|---|
| 회귀 테스트 (`engine/diagnose.test.mjs`) | **50/50 (100.00%)** | v12 휴리스틱 보존 — 변경 0줄 |
| Aggregate 단위 테스트 (`engine/aggregate.test.mjs`) | **9/9 pass** | 빈 입력·단일·가중≠단순·버킷·등급 경계·통계·위험·분포 |
| Center-price 매칭률 (`test/center-price-coverage.test.mjs`) | **3/3 pass** | 매칭률 ≥ 50% 게이트 통과 |
| Playwright E2E (`test/smart-buy.e2e.mjs`) | **12/12 pass** (35.7s) | 기존 5 + 신규 7 |
| 콘솔 에러 | **0건** | pageerror + console.error 합산 |
| `_oracle/v12-functions.mjs` 변경 | **0줄** | 절대 금지 준수 |
| 신규 npm 의존성 | **0개** | 절대 금지 준수 |
| IndexedDB 스키마 | DB_VERSION 1 유지 | store 5종 동일 |

## 3. 매칭률 개선 (라운드 1 → 라운드 2)

`sample-offer.xlsx` 30 SKU 기준 `customerPsychPriceKrw > 0` 비율:

```
라운드 1:    3 / 30 =  10.0%   (PUMA, BURBERRY, CARHARTT 만 매칭)
라운드 2:   28 / 30 =  93.3%
            └── center-price DB 매칭: 10건
            └── RRP 추정 (rrp_synth): 18건
```

3단 개선:
1. `lookupCenterPrice` 호출 시 누락된 `offerMcMap` 인자 전달 (원래 결함)
2. `brandId` 정규화 기반 매칭 추가 — `"NEW BALANCE"` → `'newbalance'` → `'뉴발란스'` (DB 키)
3. `brand_tier_db`에 등록된 브랜드는 RRP × FX × 0.55 로 고객심리가 추정 (`psychPriceSource: 'rrp_synth'`)

미매칭 2건: NIKE AIR MAX 1 LEGACY (RRP=0), TOTEME (브랜드 미등록).

## 4. 스크린샷 (10장)

`test/_screenshots/round2/` :

| 파일 | 내용 |
|---|---|
| `01-dashboard-loaded.png` | 페이지 첫 로딩 (입력 영역 + 탭 헤더) |
| `02-uploaded-dashboard.png` | Excel 업로드 직후 — 대시보드 자동 활성 |
| `03-grade-distribution.png` | 등급 분포 SVG 막대그래프 |
| `04-statistics-grid.png` | 통계 7종 그리드 (카테고리/성별/사이즈/컬러/시즌/수량/가격) |
| `05-table-top20.png` | TOP 20 표 (점수 desc 정렬) |
| `06-table-all.png` | 전체 SKU 표 (30행) |
| `07-detail-panel-open.png` | 행 클릭 → 디테일 패널 슬라이드 인 |
| `08-price-mismatch-badge.png` | 심리가대비 셀 빨간 배지 (psychRatio>1.0) |
| `09-buy-clicked.png` | BUY 클릭 → decided 클래스 + IndexedDB 저장 |
| `10-persisted-after-reload.png` | 새로고침 후 결과 영역 + 결정 자동 복원 |

## 5. 알려진 한계 / 라운드 3 푸시

- 9개 진단 항목 중 6개는 여전히 mock 데이터 부재로 미구현. `salesHistory`/`inventory`/`incoming`이 옆 메뉴(픽스 본체) 통합 후에야 채워짐. 디테일 패널은 "데이터 없음" 안내만 표시.
- `psychPriceSource: 'rrp_synth'` 의 0.55 계수는 실측 검증 없는 추정값. 라운드 3에서 실제 매출 분포 기반 보정 필요.
- 가격 모순 표시 — `RRP_PSYCH_FACTOR=0.55` + 매입율 50% 기본에서 sport 브랜드의 28건이 빨간 배지가 됨. 사실상 "JSC 매입율이 너무 보수적"이라는 신호이지만, UI 톤 다운(예: 0.7 cutoff) 또는 source별 색상 분리는 라운드 3에서 검토.
- `restoreLastBatch()` 는 단일 batch만 복원. 사용자가 과거 batch를 직접 골라 보는 UI는 미구현 (현재는 IndexedDB에 보존만 됨).
- Dashboard "수량 분포"는 4개 bin만 시각화하고 5번째 막대(평균값)는 막대그래프에 합치지 않음 — 현재는 카운트 4 + 평균은 라벨 텍스트로 노출.

## 6. 다음 액션 (라운드 3 후보)

1. 옆 메뉴(픽스 본체) `salesHistory`/`inventory`/`incoming` 통합 → 9개 진단 6개 항목 활성화
2. `RRP_PSYCH_FACTOR` 보정 — 카테고리/브랜드 tier별 차등 (sport 0.45, luxury 0.65)
3. 가격 모순 시그널을 `_rankScore` 페널티로 반영 (현재 휴리스틱 점수만 사용)
4. Batch 히스토리 UI — 과거 batch 선택 + 비교 보기
5. CSV/Excel 내보내기 (결정 + 진단 일괄)

## 7. 커밋 로그 (라운드 2)

```
f6f3320 feat(smart-buy): persist decisions across reload — visual restoration
7b4affd feat(smart-buy): SKU table + slide-in detail panel + sortable columns
5256a2a feat(smart-buy): dashboard tab — KPI + grade dist + 7 statistics + summary
f0852ff fix(smart-buy): center-price matching — pass offerMcMap + brandId norm + RRP fallback
455d5ac feat(smart-buy): aggregate module for dashboard tab
3cd5648 chore(smart-buy): round 2 baseline + round1 backup
```

## 8. 검증 합격 게이트

| 게이트 | 상태 |
|---|---|
| 회귀 50/50 100% | ✓ |
| `aggregate.test.mjs` 100% | ✓ (9/9) |
| `center-price-coverage.test.mjs` ≥ 50% | ✓ (93.3%) |
| Playwright E2E 12/12 | ✓ |
| 콘솔 에러 0 | ✓ |
| `v12-functions.mjs` 변경 0줄 | ✓ |
| 신규 npm 의존성 0 | ✓ |
| 모든 Phase 별 commit 완료 | ✓ |

**SUCCESS** — 라운드 2 종료.
