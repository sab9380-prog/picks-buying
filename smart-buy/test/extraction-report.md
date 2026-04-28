# Phase 1 추출 리포트

> 자동 생성: `node _oracle/extract.mjs` 실행 결과 + sanity test
> 대상: `_archive/v12-original.html` (2570 lines, 144KB)

## 13개 JSON 산출물

| # | 파일 | v12 source lines | v1.4 §9-2 매핑 | 항목 수 |
|---|---|---|---|---|
| 1 | `data/center-price-db.json` | 886 | (1) NC 중심가 DB | 150+ 브랜드 키 (한·영 양쪽) |
| 2 | `data/brand-size-db.json` | 764–870 | (2) 브랜드 사이즈 DB | 4개 브랜드 (ADIDAS/NIKE/LACOSTE/NEW BALANCE) |
| 3 | `data/model-keyword-rules.json` | 1377–1424 | (3) 모델 키워드 룰 | 17 룰셋 (정장류 1개 추가됨) |
| 4 | `data/color-trend-rules.json` | 1238–1340 (sColor) | (4) 컬러 트렌드 룰 | 16 tier (S~K, default 포함) |
| 5 | `data/brand-score-rules.json` | 1072–1153 + 1182–1231 | (5) 브랜드 점수 룰 | 80+ 브랜드 + ADIDAS/NIKE/NB Tier |
| 6 | `data/offer-mc-map.json` | 897–957 | (6) OFFER → MC 매핑 | 60+ 합성 키 |
| 7 | `data/price-rules.json` | 1350–1363 (sPrice) | (7) 가격 점수 룰 | 5단 tier + 환율 |
| 8 | `data/season-rules.json` | 1365–1372 (sSeason) | (8) 시즌 점수 룰 | 4단 tier + default |
| 9 | `data/size-rules.json` | 1342–1348 (sSize) | (9) 사이즈 점수 룰 | 3 카테고리 + default |
| 10 | `data/grade-labels.json` | 1463–1477 | (10) 등급 라벨 룰 | 5단 tier |
| 11 | `data/kids-exclusion.json` | 1442–1447 | (11) 키즈 자동 제외 | 1 룰 |
| 12 | `data/category-inference.json` | 997–1022 + 1494–1515 | (12) 카테고리 자동 추론 | category·gender·season·product_type |
| 13 | `data/channels.json` | v1.4 §6 (v12 미포함) | — | 4 채널 (OCEAN/AIR/DOM/EXP) |

## 메타데이터 보존

각 JSON 최상단 `_meta` 필드:
- `schema_version`: '1.0'
- `source`: 'v12-original.html' (또는 v1.4 spec)
- `source_lines`: 정확한 라인 범위
- 추가 컨텍스트: 출처 xlsx, 평가 순서, 환율 버그 등

## v12 환율 불일치 명시

`data/price-rules.json._meta`:
- `fx.jsc_eur_krw: 1740`
- `fx.rrp_eur_krw: 1700`
- `fx.known_inconsistency`: "v12 C3 버그 — JSC/RRP 다른 환율. v1.4에서 단일 환율 통일 권장하나 v12 값 보존"

## 한·영 키 보존 검증

`center-price-db.json` 샘플 확인:
- "아디다스" + "ADIDAS" — 다수 브랜드에서 양쪽 키 존재
- "버버리"/"BURBERRY", "캘빈클라인"/"CALVIN KLEIN" 등 모두 보존
- 부분 매핑: `getCenterPrice` 함수에서 괄호 제거·부분 매칭으로 fallback

## Oracle 함수 모듈 (`_oracle/v12-functions.mjs`)

DOM 의존 없는 순수 함수 추출:
- `euRange`, `getSizeDB`
- `normBrand`, `normCat`, `getBrandScore`
- **`sBrand(r, brand)`** — `STATE.brand` 의존 제거, brand 인자 명시
- `sColor`, `sSize`, `sPrice`, `sSeason`
- `applyKeywordBonus`, `MODEL_KEYWORD_RULES`
- **`calcScore(r, brand)`** — brand 인자 명시
- `gradeLabel`, `gradeCls`
- `inferCat`, `inferGender`, `inferSeason`, `inferProductType`

## Sanity Test 결과

`_oracle/v12-functions.test.mjs`:
- **총 46건 — 46 pass, 0 fail**
- 카테고리: helpers, BRAND_SIZE_DB, BRAND_TIER_DB, sBrand, sColor, sSize/Price/Season, applyKeywordBonus, calcScore, grade/infer
- 핵심 통합 케이스: ADIDAS SAMBA BLACK SS26 → total 100점 (최우선 매입) 일치 확인

## 누락 의심 구간 — 없음

v12 HTML 데이터 영역(line 700~1515)을 모두 13 JSON에 매핑.
Phase 5 진단 엔진에서 v12-baseline.json 재현 시 100% 일치 확인 예정.

## v12 미사용 함수 (의도적 제외)

다음은 DOM·Excel·UI 의존이라 oracle에 포함하지 않음:
- `findBestSheet`, `findCol` (Excel 컬럼 탐지) — Phase 6에서 별도 구현
- `STATE` 글로벌, `renderTop20`, DOM 핸들러 — UI 코드, Phase 6에서 새로 작성
- `inferProductType`은 데이터로 분리(`category-inference.json`)했지만 함수는 oracle에도 보존
