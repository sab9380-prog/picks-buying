# YouTube 학습 파이프라인 — 셋업 가이드

> 비개발자용. 아래 순서대로 따라하면 파이프라인이 완성됩니다.

---

## 사전 준비 (한 번만)

### 1. Notion 설정

**1-1. Notion Integration 생성**
1. [notion.so/my-integrations](https://www.notion.so/my-integrations) 접속
2. "새 통합" 클릭 > 이름: `yt-learn-pipeline`
3. 기능: "콘텐츠 읽기", "콘텐츠 업데이트", "콘텐츠 삽입" 모두 체크
4. "제출" 후 **Internal Integration Secret** 복사 → `config.json`의 `notion.api_token`에 저장

**1-2. Videos DB 만들기**
1. Notion에 새 데이터베이스 생성 (풀 페이지)
2. 아래 속성(Property)을 추가:

| 속성명 | 타입 | 설정 |
|---|---|---|
| Title | Title | (기본 제공) |
| YouTube URL | URL | |
| Status | Status | 옵션: New, Processing, Processed, Error, No Transcript |
| One Line Thesis | Text | |
| Summary | Text | |
| Framework | Text | |
| Relevance to Picks | Text | |
| Challenges Assumption | Text | |
| Connects To | Text | |
| Apply to Current | Text | |
| Apply to Future | Text | |
| Tasks | Relation | → Tasks DB (아래에서 생성 후 연결) |
| Processed At | Date | |

3. DB 페이지 URL에서 **DB ID** 복사 (notion.so/ 뒤 32자리, 하이픈 제외)
   → `config.json`의 `notion.videos_db_id`에 저장

**1-3. Tasks DB 만들기**
1. 새 데이터베이스 생성
2. 속성 추가:

| 속성명 | 타입 | 설정 |
|---|---|---|
| Task | Title | (기본 제공) |
| Deadline | Date | |
| Effort | Select | 옵션: small, medium, large |
| Who | Select | 옵션: solo, team, approval |
| Source Video | Relation | → Videos DB |
| Completed | Checkbox | |

3. DB ID 복사 → `config.json`의 `notion.tasks_db_id`에 저장

**1-4. Integration 연결**
1. Videos DB 페이지 우측 상단 "..." > "연결" > `yt-learn-pipeline` 선택
2. Tasks DB도 동일하게 연결

---

### 2. Slack 설정

**2-1. Slack App 생성**
1. [api.slack.com/apps](https://api.slack.com/apps) > "Create New App" > "From scratch"
2. App Name: `YT Learn Bot`, Workspace 선택
3. **OAuth & Permissions** > Bot Token Scopes 추가:
   - `channels:history` (채널 메시지 읽기)
   - `chat:write` (메시지 보내기)
4. "Install to Workspace" > 허용
5. **Bot User OAuth Token** 복사 (`xoxb-...`) → `config.json`의 `slack.bot_token`에 저장

**2-2. #yt-learn 채널 만들기**
1. Slack에서 #yt-learn 채널 생성
2. 채널에 YT Learn Bot 앱 추가 (채널 설정 > 통합 > 앱 추가)
3. 채널 ID 복사 (채널 이름 클릭 > 하단 "채널 ID") → `config.json`의 `slack.channel_id`에 저장

---

### 3. Supadata 설정

1. [supadata.ai](https://supadata.ai) 가입
2. Dashboard > API Keys > 키 생성
3. API Key 복사 → `config.json`의 `supadata.api_key`에 저장

> 무료 티어: 월 100크레딧 (영상 100개). 초과 시 유료 플랜 필요.

---

### 4. Claude API 설정

1. [console.anthropic.com](https://console.anthropic.com) 가입
2. API Keys > "Create Key"
3. API Key 복사 (`sk-ant-...`) → `config.json`의 `claude.api_key`에 저장

> 비용: 영상 1개 분석 약 $0.01~0.05 (자막 길이에 따라 다름)

---

## Power Automate 플로우 만들기

### Step 1: 새 플로우 생성

1. [make.powerautomate.com](https://make.powerautomate.com) 접속
2. "만들기" > "자동화된 클라우드 플로우"
3. 플로우 이름: `YT Learn Pipeline`
4. 트리거: "Slack" 검색 > "When a new message is posted to a channel" 선택

### Step 2: 변수 초기화

`src/pa-flow-definition.md`의 "플로우 변수 초기화" 섹션 참조.
각 변수를 "변수 초기화" 액션으로 추가합니다.

### Step 3: Scope 만들기

1. "Scope" 액션 추가 > 이름: `Scope_MainPipeline`
2. 이 Scope 안에 기능 1~5의 모든 단계를 넣습니다

### Step 4: 기능 1~5 단계 추가

`src/pa-flow-definition.md`를 보면서 Step 1.1부터 Step 5.1까지 순서대로 추가합니다.

> 각 HTTP Action의 Headers, Body, URI를 정확히 복사해서 넣으세요.
> `@{variables('...')}` 같은 PA 표현식은 PA 편집기의 "동적 콘텐츠" 또는
> "식" 탭에서 입력합니다.

### Step 5: Error Handler 추가

1. Scope_MainPipeline 다음에 "Scope" 추가 > 이름: `Scope_ErrorHandler`
2. "..." > "Run after 구성" > "has failed"와 "has timed out" 체크
3. Scope 안에 Step 6.4 ~ 6.6 추가

### Step 6: Concurrency 설정

1. 트리거(Slack) > "..." > Settings
2. Concurrency Control: ON
3. Degree of Parallelism: 1

### Step 7: 저장 및 테스트

1. 플로우 저장
2. Slack #yt-learn에 YouTube URL 하나 보내기
3. PA에서 실행 기록 확인 > 각 단계 성공 여부 체크
4. Notion Videos DB에 레코드가 생성되었는지 확인
5. Notion Tasks DB에 태스크가 생성되었는지 확인
6. Slack에 완료 알림이 왔는지 확인

---

## 테스트 체크리스트

| # | 테스트 | 예상 결과 |
|---|---|---|
| 1 | YouTube URL 1개 보내기 | Notion 레코드 생성 + 4계층 채워짐 + Slack 알림 |
| 2 | 일반 텍스트 보내기 | 무시됨 (플로우 종료) |
| 3 | 같은 URL 다시 보내기 | 중복 방지 (플로우 종료) |
| 4 | youtu.be/ 형식 URL | 정상 처리 |
| 5 | /shorts/ 형식 URL | 정상 처리 |
| 6 | 자막 없는 영상 URL | Status "No Transcript" + Slack 알림 |
| 7 | 영상 5개 연속 보내기 | 순차 처리, 전부 성공 |

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 플로우가 시작 안 됨 | Slack 트리거 설정 오류 | PA에서 트리거 > 채널 재선택 |
| Notion 401 에러 | API 토큰 만료/오류 | config.json 토큰 재확인, Integration 연결 확인 |
| Notion 404 에러 | DB ID 오류 | 하이픈 없는 32자리 ID 확인 |
| Claude 429 에러 | Rate limit 초과 | 자동 재시도됨. 반복 시 API 플랜 확인 |
| Supadata 402 에러 | 무료 크레딧 소진 | Supadata 대시보드에서 잔여 크레딧 확인 |
| "No Transcript" 반복 | 자막 비활성화된 영상 | 정상 동작. 자막 있는 영상으로 테스트 |

---

## 파일 구조

```
yt-learn-pipeline/
├── product-plan.md            # 제품 요구사항
├── evaluation-criteria.md     # 평가 기준
├── setup-guide.md             # 이 파일 (셋업 가이드)
├── reference/
│   └── research.md            # 기술 리서치
└── src/
    ├── config.json            # 설정값 (API 키, DB ID 등)
    ├── pa-flow-definition.md  # PA 플로우 전체 정의 (핵심 문서)
    ├── prompts/
    │   ├── system-prompt.txt  # Claude 시스템 프롬프트 원본
    │   └── output-schema.json # Claude 출력 JSON 스키마
    └── templates/
        ├── claude-request.json         # Claude API 요청 템플릿
        ├── notion-query-duplicate.json # 중복 체크 쿼리
        ├── notion-create-video.json    # Videos DB 레코드 생성
        ├── notion-update-video.json    # Videos DB 업데이트
        ├── notion-create-task.json     # Tasks DB 레코드 생성
        └── slack-notification.json     # Slack 알림 템플릿
```

> **수정이 가장 잦은 파일:** `src/prompts/system-prompt.txt`
> Claude의 분석 품질을 조정하고 싶을 때 이 파일을 수정하고,
> `pa-flow-definition.md`의 Compose_ClaudeRequestBody에 반영하면 됩니다.
