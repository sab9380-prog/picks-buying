# YouTube 학습 파이프라인 — 제품 계획서 v3

> 작성일: 2026-04-04 | 유형: 제품 수준 계획 (구현 방법은 생성자 에이전트가 결정)

---

## 이 파이프라인이 해결하는 문제

유튜브 영상을 보고 배운 내용을 수동으로 정리하면 시간이 오래 걸리고, 정리 안 한 영상은 잊어버린다. 정리하더라도 "좋은 영상이었다"에서 끝나고 실제 업무에 적용되지 않는다. URL 하나만 던지면 자동으로 분석하고, 내 업무 맥락에 연결하고, 실행 가능한 태스크까지 만들어주는 파이프라인이 필요하다.

---

## 사용자 시나리오

1. 재열이 유튜브 앱(모바일) 또는 브라우저(노트북)에서 유용한 영상을 발견한다.
2. **공유 버튼 → Slack #yt-learn 채널로 전송한다.** (이것이 유일한 수동 작업, 2~3초)
3. 파이프라인이 자동으로 실행되어:
   - Slack 메시지에서 YouTube URL을 추출한다
   - Notion Videos DB에 레코드를 자동 생성한다
   - 영상 자막을 추출한다
   - AI가 4계층 구조로 분석한다 (핵심 파악 → 연결 → 적용 → 실행)
   - 결과를 Notion Videos DB와 Tasks DB에 자동 저장한다
4. 재열은 나중에 Notion에서 확인만 한다:
   - Videos DB: one_line_thesis 칼럼을 훑으며 "최근에 뭘 배웠지?"
   - Tasks DB: deadline 기준으로 "이번 주에 뭘 해야 하지?"
5. (선택) Slack에 처리 완료 알림이 돌아온다 — "✅ [영상 제목] 분석 완료, 태스크 1개 생성"

---

## 4계층 추출 구조

### 계층 1: 핵심 파악 (이해)
- **one_line_thesis**: 영상의 핵심 주장 한 문장. 50개 영상이 쌓여도 한눈에 훑을 수 있어야 한다.
- **summary**: 2~3문장 요약. 핵심 용어가 있으면 괄호 안에 자연스럽게 포함한다 (별도 용어 DB 없음).
- **framework**: 영상이 소개하는 사고 모델 또는 프레임워크. 없으면 "없음".

### 계층 2: 내 상황과 연결 (연결)
- **relevance_to_picks**: 이 내용이 이랜드 Picks OPR 업무에 어떻게 연결되는가.
- **challenges_assumption**: 기존에 갖고 있던 가정 중 이 영상이 뒤집거나 수정하는 것. 없으면 "없음".
- **connects_to**: 이전에 접한 다른 개념·영상·프레임워크와의 연결점. 없으면 "없음".

### 계층 3: 적용 방안 (적용)
- **apply_to_current**: 지금 진행 중인 업무에 바로 적용할 수 있는 변화 (1~2개).
- **apply_to_future**: 다음 분기 또는 새 프로젝트에서 고려할 점 (1~2개). 없으면 "없음".

### 계층 4: 실행 태스크 (실행)
- **next_action**: 가장 먼저 할 한 가지. 반드시 1개만.
- **deadline**: 언제까지. 영상 내용 기준으로 긴급도를 판단하여 제안 (이번 주 / 이번 달 / 다음 분기).
- **effort**: small (30분 이내) / medium (반나절) / large (하루 이상).
- **who**: solo (나 혼자) / team (팀 협의 필요) / approval (상사 승인 필요).

---

## 기능 요구사항

### 기능 1: Slack → Notion 자동 입력
- Slack #yt-learn 채널에 YouTube URL이 포함된 메시지가 올라오면 파이프라인이 시작된다.
- 메시지에서 YouTube URL을 자동 추출한다 (youtube.com/watch, youtu.be, /shorts/ 등 다양한 형식 지원).
- 추출된 URL로 Notion Videos DB에 새 레코드를 자동 생성한다 (Status: "New").
- URL이 아닌 일반 메시지는 무시한다.
- 이미 처리된 URL이 다시 올라오면 중복 생성하지 않는다.

### 기능 2: 자막 자동 추출
- YouTube URL에서 자막(한국어 또는 영어)을 자동으로 가져온다.
- 자막이 없는 영상이면 에러 없이 Status를 "No Transcript"로 표시하고 넘어간다.

### 기능 3: AI 4계층 분석
- 자막 전체를 AI에게 보내서 위 4계층 구조를 추출한다.
- AI에게 Picks OPR 업무 맥락을 시스템 프롬프트로 제공하여, 계층 2~4가 재열의 실제 업무에 맞게 나오도록 한다.
- 출력은 JSON Structured Output으로 강제한다.

### 기능 4: Notion DB 자동 저장
- **Videos DB**: 계층 1~3 결과를 저장한다. Status를 "Processed"로 변경한다.
- **Tasks DB**: 계층 4의 next_action을 레코드로 생성한다. Videos DB와 Relation으로 연결한다.

### 기능 5: 완료 알림
- 처리 완료 시 Slack #yt-learn 채널에 결과 요약 메시지를 자동 전송한다.
- 포맷: "✅ [영상 제목] 분석 완료 — [one_line_thesis] | 태스크: [next_action]"
- 실패 시: "❌ [영상 제목] 실패 — 사유: [에러 내용]"

### 기능 6: 에러 처리
- 어느 단계에서 실패하더라도 Videos DB의 Status에 실패 원인이 표시된다.
- 자막 추출 실패, API 에러 등 예외 상황에서 플로우 전체가 멈추지 않는다.

---

## 기술 스택 (방향만, 세부 선택은 생성자가 결정)

| 구간 | 방향 | 참고 |
|---|---|---|
| 입력 경로 | Slack #yt-learn 채널 (메시지 트리거) | PA에 Slack 커넥터 내장 |
| 자동화 엔진 | Power Automate | 이미 라이선스 보유 |
| 자막 추출 | REST API 우선 (셋업 간단), 필요시 Azure Function | research.md §2 참조 |
| AI 분석 | Claude API (Structured Outputs 사용) | research.md §4 참조 |
| 데이터 저장 | Notion API | research.md §3 참조 |
| 완료 알림 | Slack 메시지 전송 | PA Slack 커넥터 |

---

## 전체 플로우 개요

```
[모바일/노트북]
  YouTube 영상 공유 → Slack #yt-learn

[Power Automate]
  Slack 메시지 트리거
    → YouTube URL 추출
    → Notion Videos DB 레코드 자동 생성 (Status: Processing)
    → 자막 추출 (REST API)
    → Claude API 4계층 분석
    → Videos DB 업데이트 (계층 1~3 + Status: Processed)
    → Tasks DB 레코드 생성 (계층 4)
    → Slack에 완료/실패 알림

[Notion — 확인만]
  Videos DB: "최근에 뭘 배웠지?"
  Tasks DB: "이번 주에 뭘 해야 하지?"
```

---

## Notion DB 스키마

### Videos DB

| 속성 | 타입 | 용도 |
|---|---|---|
| Title | Title | 영상 제목 |
| YouTube URL | URL | 영상 링크 |
| Status | Status | New → Processing → Processed / Error / No Transcript |
| One Line Thesis | Rich Text | 핵심 주장 한 문장 |
| Summary | Rich Text | 2~3문장 요약 (핵심 용어 포함) |
| Framework | Rich Text | 소개된 사고 모델/프레임워크 |
| Relevance to Picks | Rich Text | Picks 업무와의 연결점 |
| Challenges Assumption | Rich Text | 기존 가정을 뒤집는 인사이트 |
| Connects To | Rich Text | 다른 개념/영상과의 연결점 |
| Apply to Current | Rich Text | 지금 바로 적용할 변화 |
| Apply to Future | Rich Text | 다음 분기 이후 고려사항 |
| Tasks | Relation → Tasks DB | 실행 태스크 연결 |
| Processed At | Date | 처리 완료 시간 |

### Tasks DB

| 속성 | 타입 | 용도 |
|---|---|---|
| Task | Title | 가장 먼저 할 한 가지 |
| Deadline | Date | 제안된 기한 |
| Effort | Select | small / medium / large |
| Who | Select | solo / team / approval |
| Source Video | Relation → Videos DB | 출처 영상 |
| Completed | Checkbox | 실행 완료 여부 |

---

## AI 시스템 프롬프트에 포함할 맥락 (생성자 참고용)

Claude API 호출 시 시스템 프롬프트에 아래 맥락을 포함하여, 계층 2~4의 출력이 재열의 실제 업무에 맞게 나오도록 한다.

> 분석 대상자: 이랜드 OPR(오프프라이스 리테일) 사업부 '픽스(Picks)'의 전략기획 담당자.
> 주요 업무: 글로벌 OPR 벤치마크(TJX, Brand for Less, Marshalls) 기반 사업 모델 구축, AI 자동화 전략, 역기획 프레임워크 활용, 브랜드 매입 프로세스 관리.
> 현재 진행 중인 프로젝트: AI 전략 고도화(14단계 파이프라인), 2분기 사업계획 재구조화, 회의 자동화 파이프라인, 유튜브 학습 자동화.
> 이 맥락을 기반으로 relevance_to_picks, challenges_assumption, apply_to_current, apply_to_future, next_action을 구체적으로 작성할 것.

---

## 성공 기준

1. YouTube 앱에서 **공유 → Slack 전송 2~3초**만에 입력이 완료된다.
2. Slack 메시지 전송 후 **10분 이내**에 Notion에 분석 결과가 채워진다.
3. 자막이 있는 영상은 **4계층 전체(thesis~task)가 모두 채워진다.**
4. relevance_to_picks가 "일반적 조언"이 아니라 **Picks 업무에 구체적으로 맵핑**된 내용이다.
5. Tasks DB의 next_action이 **바로 실행 가능한 수준**이다 ("알아보기"가 아니라 "~를 ~에서 ~하기").
6. 처리 완료/실패 시 **Slack에 알림**이 돌아온다.
7. 자막 없는 영상, API 에러 등 예외 상황에서 플로우 전체가 멈추지 않는다.
8. 연속 5개 영상을 공유했을 때 전부 정상 처리된다.
9. 같은 URL을 두 번 공유해도 중복 생성되지 않는다.
