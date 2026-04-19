# Power Automate 플로우 정의서

> 이 문서는 PA 플로우의 모든 단계를 정의합니다.
> 각 단계의 액션 타입, 설정값, PA 표현식을 포함합니다.
> PA 편집기에서 이 문서를 보면서 단계별로 만들면 됩니다.

---

## 플로우 변수 초기화

플로우 최상단에 아래 변수들을 '변수 초기화(Initialize variable)' 액션으로 만듭니다.

| 변수명 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| varNotionToken | String | (config.json 참조) | Notion API 인증 |
| varNotionVersion | String | 2022-06-28 | Notion API 버전 |
| varVideosDbId | String | (config.json 참조) | Videos DB ID |
| varTasksDbId | String | (config.json 참조) | Tasks DB ID |
| varSupadataKey | String | (config.json 참조) | Supadata API 키 |
| varClaudeKey | String | (config.json 참조) | Claude API 키 |
| varSlackBotToken | String | (config.json 참조) | Slack Bot Token |
| varVideoUrl | String | (비워둠) | 추출된 YouTube URL |
| varVideoId | String | (비워둠) | 추출된 Video ID |
| varVideoTitle | String | (비워둠) | 영상 제목 |
| varNotionPageId | String | (비워둠) | 생성된 Notion 페이지 ID |
| varTranscript | String | (비워둠) | 추출된 자막 텍스트 |
| varSlackChannel | String | (config.json 참조) | Slack 채널 ID |

---

## ═══════════════════════════════════════
## 기능 1: Slack → Notion 자동 입력
## ═══════════════════════════════════════

### Step 1.0: 트리거 — Slack 새 메시지 감지

- **액션:** Slack 커넥터 > "When a new message is posted to a channel"
- **채널:** #yt-learn
- **설정:**
  - Channel: #yt-learn 선택
  - 이 트리거는 채널에 새 메시지가 올라올 때마다 실행됨

---

### Step 1.1: YouTube URL 추출 (Compose)

Slack 메시지 텍스트에서 YouTube URL을 찾아냅니다.
PA에는 정규식이 없으므로 문자열 함수를 조합합니다.

- **액션:** Compose (데이터 작업 > 작성)
- **이름:** Compose_ExtractUrl
- **입력:**

```
@if(
  contains(triggerBody()?['text'], 'youtu.be/'),
  concat(
    'https://youtu.be/',
    first(
      split(
        last(split(triggerBody()?['text'], 'youtu.be/')),
        ' '
      )
    )
  ),
  if(
    contains(triggerBody()?['text'], 'youtube.com/'),
    concat(
      'https://www.youtube.com/',
      first(
        split(
          last(split(triggerBody()?['text'], 'youtube.com/')),
          ' '
        )
      )
    ),
    ''
  )
)
```

> **동작 설명:**
> 1. 메시지에 'youtu.be/'가 있으면 → 그 뒤의 텍스트를 공백 기준으로 잘라서 URL 복원
> 2. 'youtube.com/'가 있으면 → 같은 방식으로 URL 복원
> 3. 둘 다 없으면 → 빈 문자열 (일반 메시지)

---

### Step 1.2: URL 유효성 확인 (Condition)

- **액션:** Condition (조건)
- **이름:** Condition_HasYouTubeUrl
- **조건:** `@not(empty(outputs('Compose_ExtractUrl')))` is equal to `true`

#### If No (URL 없음) → 종료
- **액션:** Terminate (종료)
- **상태:** Succeeded
- **메시지:** "YouTube URL이 아닌 일반 메시지 — 무시"

#### If Yes (URL 있음) → 계속 진행

---

### Step 1.3: YouTube URL 정리 및 Video ID 추출

- **액션:** Compose (데이터 작업 > 작성)
- **이름:** Compose_CleanUrl
- **입력:** `@outputs('Compose_ExtractUrl')`

> URL에서 꺾쇠(<>) 제거 (Slack이 URL을 <>로 감싸는 경우 대응)

- **액션:** Compose
- **이름:** Compose_RemoveBrackets
- **입력:**
```
@replace(replace(outputs('Compose_CleanUrl'), '<', ''), '>', '')
```

- **액션:** 변수 설정 (Set variable)
- **변수:** varVideoUrl
- **값:** `@outputs('Compose_RemoveBrackets')`

---

### Step 1.4: Video ID 추출 (Compose)

- **액션:** Compose
- **이름:** Compose_ExtractVideoId
- **입력:**
```
@if(
  contains(variables('varVideoUrl'), 'v='),
  first(split(last(split(variables('varVideoUrl'), 'v=')), '&')),
  if(
    contains(variables('varVideoUrl'), 'youtu.be/'),
    first(split(last(split(variables('varVideoUrl'), 'youtu.be/')), '?')),
    if(
      contains(variables('varVideoUrl'), '/shorts/'),
      first(split(last(split(variables('varVideoUrl'), '/shorts/')), '?')),
      ''
    )
  )
)
```

- **액션:** 변수 설정
- **변수:** varVideoId
- **값:** `@outputs('Compose_ExtractVideoId')`

> **지원 URL 형식:**
> - `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`
> - `https://youtu.be/dQw4w9WgXcQ` → `dQw4w9WgXcQ`
> - `https://www.youtube.com/shorts/dQw4w9WgXcQ` → `dQw4w9WgXcQ`
> - `https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s` → `dQw4w9WgXcQ`

---

### Step 1.5: Notion 중복 체크 (HTTP)

- **액션:** HTTP
- **이름:** HTTP_NotionCheckDuplicate
- **Method:** POST
- **URI:** `https://api.notion.com/v1/databases/@{variables('varVideosDbId')}/query`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "filter": {
    "property": "YouTube URL",
    "url": {
      "equals": "@{variables('varVideoUrl')}"
    }
  }
}
```

---

### Step 1.6: 중복 여부 판단 (Condition)

- **액션:** Parse JSON
- **이름:** Parse_DuplicateCheck
- **Content:** `@body('HTTP_NotionCheckDuplicate')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "results": { "type": "array" }
  }
}
```

- **액션:** Condition
- **이름:** Condition_IsDuplicate
- **조건:** `@length(body('Parse_DuplicateCheck')?['results'])` is greater than `0`

#### If Yes (중복) → 종료
- **액션:** Terminate
- **상태:** Succeeded
- **메시지:** "이미 처리된 URL — 중복 생성 건너뜀"

#### If No (신규) → 계속

---

### Step 1.7: 영상 제목 가져오기 (HTTP — oEmbed)

YouTube oEmbed API로 영상 제목을 가져옵니다 (API 키 불필요).

- **액션:** HTTP
- **이름:** HTTP_GetVideoTitle
- **Method:** GET
- **URI:** `https://www.youtube.com/oembed?url=@{variables('varVideoUrl')}&format=json`

- **액션:** Parse JSON
- **이름:** Parse_VideoTitle
- **Content:** `@body('HTTP_GetVideoTitle')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "author_name": { "type": "string" }
  }
}
```

- **액션:** 변수 설정
- **변수:** varVideoTitle
- **값:** `@body('Parse_VideoTitle')?['title']`

---

### Step 1.8: Notion Videos DB 레코드 생성 (HTTP)

- **액션:** HTTP
- **이름:** HTTP_NotionCreateVideo
- **Method:** POST
- **URI:** `https://api.notion.com/v1/pages`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "parent": {
    "database_id": "@{variables('varVideosDbId')}"
  },
  "properties": {
    "Title": {
      "title": [
        {
          "text": {
            "content": "@{variables('varVideoTitle')}"
          }
        }
      ]
    },
    "YouTube URL": {
      "url": "@{variables('varVideoUrl')}"
    },
    "Status": {
      "status": {
        "name": "Processing"
      }
    }
  }
}
```

- **액션:** Parse JSON
- **이름:** Parse_CreatedPage
- **Content:** `@body('HTTP_NotionCreateVideo')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" }
  }
}
```

- **액션:** 변수 설정
- **변수:** varNotionPageId
- **값:** `@body('Parse_CreatedPage')?['id']`

---

> **기능 1 완료 시점:** Slack 메시지에서 YouTube URL을 추출하고,
> 중복이 아니면 Notion Videos DB에 Status: "Processing" 레코드가 자동 생성됨.

---

## ═══════════════════════════════════════
## 기능 2: 자막 자동 추출
## ═══════════════════════════════════════

### Step 2.1: Supadata API로 자막 요청 (HTTP)

- **액션:** HTTP
- **이름:** HTTP_GetTranscript
- **Method:** GET
- **URI:** `https://api.supadata.ai/v1/youtube/transcript?url=@{variables('varVideoUrl')}&text=true`
- **Headers:**
  | Key | Value |
  |---|---|
  | x-api-key | `@{variables('varSupadataKey')}` |
- **Settings (고급):**
  - Retry Policy: Fixed interval
  - Count: 3
  - Interval: PT10S (10초 간격)

> **Supadata 응답 예시 (text=true):**
> ```json
> {
>   "content": "안녕하세요 오늘은 AI 전략에 대해... (전체 자막 텍스트)",
>   "lang": "ko"
> }
> ```
> `text=true` 파라미터를 사용하면 타임스탬프 없이 순수 텍스트만 반환.

---

### Step 2.2: 자막 추출 결과 확인 (Condition)

- **액션:** Condition
- **이름:** Condition_TranscriptSuccess
- **조건:** `@outputs('HTTP_GetTranscript')['statusCode']` is equal to `200`

#### If No (자막 없음 또는 실패) → "No Transcript" 처리

- **액션:** HTTP
- **이름:** HTTP_NotionSetNoTranscript
- **Method:** PATCH
- **URI:** `https://api.notion.com/v1/pages/@{variables('varNotionPageId')}`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "properties": {
    "Status": {
      "status": {
        "name": "No Transcript"
      }
    }
  }
}
```

- **액션:** Terminate
- **상태:** Succeeded
- **메시지:** "자막 없는 영상 — Status를 'No Transcript'로 설정"

> **참고:** 기능 5에서 이 분기에도 Slack 알림을 추가합니다.

#### If Yes (자막 있음) → 계속

---

### Step 2.3: 자막 텍스트 저장

- **액션:** Parse JSON
- **이름:** Parse_Transcript
- **Content:** `@body('HTTP_GetTranscript')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "content": { "type": "string" },
    "lang": { "type": "string" }
  }
}
```

- **액션:** 변수 설정
- **변수:** varTranscript
- **값:** `@body('Parse_Transcript')?['content']`

### Step 2.4: 자막 길이 제한 (Compose)

Claude API의 입력 토큰 한도와 비용을 고려하여, 자막이 너무 길면 앞부분만 사용합니다.

- **액션:** Compose
- **이름:** Compose_TrimTranscript
- **입력:**
```
@if(
  greater(length(variables('varTranscript')), 100000),
  substring(variables('varTranscript'), 0, 100000),
  variables('varTranscript')
)
```

- **액션:** 변수 설정
- **변수:** varTranscript
- **값:** `@outputs('Compose_TrimTranscript')`

> **100,000자 = 약 25,000~30,000 토큰.** 대부분의 YouTube 영상 자막은 이 안에 들어옵니다.
> 2시간 이상 영상만 초과할 수 있으며, 이 경우 앞부분 기준으로 분석합니다.

---

> **기능 2 완료 시점:** YouTube 영상의 자막이 varTranscript 변수에 저장됨.
> 자막이 없는 영상은 Status: "No Transcript"로 표시되고 플로우가 정상 종료됨.

---

## ═══════════════════════════════════════
## 기능 3: AI 4계층 분석
## ═══════════════════════════════════════

### Step 3.1: Claude API 호출 (HTTP)

- **액션:** HTTP
- **이름:** HTTP_ClaudeAnalysis
- **Method:** POST
- **URI:** `https://api.anthropic.com/v1/messages`
- **Headers:**
  | Key | Value |
  |---|---|
  | x-api-key | `@{variables('varClaudeKey')}` |
  | anthropic-version | `2023-06-01` |
  | Content-Type | `application/json` |
- **Body:** (아래 참조)
- **Settings (고급):**
  - Timeout: PT120S (2분 — 긴 자막 분석에 충분한 시간)
  - Retry Policy: Fixed interval, Count: 2, Interval: PT30S

**Body 구성 (Compose 사용):**

시스템 프롬프트가 길기 때문에 Compose 액션으로 먼저 조립합니다.

- **액션:** Compose
- **이름:** Compose_ClaudeRequestBody
- **입력:**
```
{
  "model": "claude-sonnet-4-5-20241022",
  "max_tokens": 4096,
  "system": "You are a learning analyst for a retail strategist at E-Land's off-price retail division \"Picks\".\n\n## Analyst's Context\n- Position: Strategic planning lead at Picks (이랜드 OPR 사업부 '픽스' 전략기획 담당자)\n- Core responsibilities: Global OPR benchmarking (TJX, Brand for Less, Marshalls), AI automation strategy, reverse-planning framework, brand buying process management\n- Current projects: AI strategy advancement (14-stage pipeline), Q2 business plan restructuring, meeting automation pipeline, YouTube learning automation\n\n## 4-Layer Extraction Rules\n\n### Layer 1: Core Understanding\n- one_line_thesis: The video's CORE ARGUMENT in one sentence. Not a topic description but a claim. Must be scannable.\n- summary: 2-3 sentence summary with key terms in parentheses naturally.\n- framework: A thinking model ACTUALLY presented in the video. If none, write \"없음\". Never invent one.\n\n### Layer 2: Connection to My Work\n- relevance_to_picks: MUST reference specific Picks areas (brand buying, AI strategy, reverse-planning, TJX benchmarking). NEVER vague like \"유통업에 도움됨\".\n- challenges_assumption: Existing assumption this challenges. If none, \"없음\". Never force it.\n- connects_to: Connection to other concepts/frameworks. If none, \"없음\".\n\n### Layer 3: Application\n- apply_to_current: 1-2 changes for RIGHT NOW. Must be \"~에서 ~를 ~으로 바꾸기\" level, not \"~를 검토해보기\". Reference actual projects.\n- apply_to_future: For next quarter. If none, \"없음\".\n\n### Layer 4: Execution\n- next_action: THE ONE thing to do first. Instantly actionable. Format: [동사] + [구체적 대상] + [장소/도구]\n- deadline: \"이번 주\" / \"이번 달\" / \"다음 분기\" based on urgency\n- effort: \"small\" (30분) / \"medium\" (반나절) / \"large\" (하루+)\n- who: \"solo\" / \"team\" / \"approval\"\n\n## Rules\n1. All output in Korean. 2. Never be generic. 3. \"없음\" > forced answer. 4. next_action must pass the \"아, 이거 하면 되겠다\" test. 5. Valid JSON only.",
  "messages": [
    {
      "role": "user",
      "content": "아래 YouTube 영상의 자막을 분석하여 4계층 구조로 인사이트를 추출해주세요.\n\n영상 제목: @{variables('varVideoTitle')}\n\n자막:\n@{variables('varTranscript')}"
    }
  ],
  "output_config": {
    "format": {
      "type": "json_schema",
      "json_schema": {
        "name": "video_analysis",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "one_line_thesis": { "type": "string" },
            "summary": { "type": "string" },
            "framework": { "type": "string" },
            "relevance_to_picks": { "type": "string" },
            "challenges_assumption": { "type": "string" },
            "connects_to": { "type": "string" },
            "apply_to_current": { "type": "string" },
            "apply_to_future": { "type": "string" },
            "next_action": { "type": "string" },
            "deadline": { "type": "string", "enum": ["이번 주", "이번 달", "다음 분기"] },
            "effort": { "type": "string", "enum": ["small", "medium", "large"] },
            "who": { "type": "string", "enum": ["solo", "team", "approval"] }
          },
          "required": ["one_line_thesis","summary","framework","relevance_to_picks","challenges_assumption","connects_to","apply_to_current","apply_to_future","next_action","deadline","effort","who"],
          "additionalProperties": false
        }
      }
    }
  }
}
```

- **액션:** HTTP (위 Compose 결과를 Body로 사용)
- **이름:** HTTP_ClaudeAnalysis
- **Body:** `@outputs('Compose_ClaudeRequestBody')`

> **주의:** PA에서 JSON Body 안에 변수를 넣을 때, 자막 텍스트에 큰따옴표(")나
> 줄바꿈(\n)이 포함되면 JSON이 깨질 수 있습니다. Compose로 먼저 조립하면
> PA가 자동으로 이스케이프 처리합니다.

---

### Step 3.2: Claude 응답 파싱 (2단계 Parse)

Claude API 응답에서 4계층 데이터를 추출합니다. 응답 구조가 중첩되어 있으므로 2단계로 파싱합니다.

**1단계: 외부 응답 파싱**

- **액션:** Parse JSON
- **이름:** Parse_ClaudeResponse
- **Content:** `@body('HTTP_ClaudeAnalysis')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "text": { "type": "string" }
        }
      }
    },
    "stop_reason": { "type": "string" }
  }
}
```

**2단계: 내부 JSON 파싱 (4계층 데이터)**

- **액션:** Parse JSON
- **이름:** Parse_Analysis
- **Content:** `@{first(body('Parse_ClaudeResponse')?['content'])?['text']}`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "one_line_thesis": { "type": "string" },
    "summary": { "type": "string" },
    "framework": { "type": "string" },
    "relevance_to_picks": { "type": "string" },
    "challenges_assumption": { "type": "string" },
    "connects_to": { "type": "string" },
    "apply_to_current": { "type": "string" },
    "apply_to_future": { "type": "string" },
    "next_action": { "type": "string" },
    "deadline": { "type": "string" },
    "effort": { "type": "string" },
    "who": { "type": "string" }
  }
}
```

> **파싱 후 각 필드 접근 방법:**
> - `body('Parse_Analysis')?['one_line_thesis']`
> - `body('Parse_Analysis')?['summary']`
> - `body('Parse_Analysis')?['next_action']`
> - ... (나머지 동일 패턴)

---

### Step 3.3: stop_reason 확인 (Condition)

- **액션:** Condition
- **이름:** Condition_ClaudeComplete
- **조건:** `@first(body('Parse_ClaudeResponse')?['content'])?['type']` is equal to `text`

#### If No → 분석 실패 처리
- Notion Status를 "Error"로 업데이트 (기능 6에서 상세 구현)

#### If Yes → 기능 4로 진행 (Notion 저장)

---

> **기능 3 완료 시점:** Claude가 자막을 분석하여 12개 필드의 4계층 구조화 데이터가
> Parse_Analysis에 저장됨. Structured Outputs로 JSON 형식이 보장됨.

---

> **프롬프트 수정이 필요할 때:**
> `Compose_ClaudeRequestBody`의 `system` 필드 내용만 수정하면 됩니다.
> 전체 프롬프트는 `src/prompts/system-prompt.txt`에 원본이 보관되어 있습니다.
> 스키마에 필드를 추가하고 싶으면:
> 1. `Compose_ClaudeRequestBody`의 schema.properties에 필드 추가
> 2. schema.required 배열에 필드명 추가
> 3. `Parse_Analysis`의 Schema에 같은 필드 추가
> 4. 기능 4의 Notion 저장 단계에 매핑 추가

---

## ═══════════════════════════════════════
## 기능 4: Notion DB 자동 저장
## ═══════════════════════════════════════

### Step 4.1: Videos DB 업데이트 — 계층 1~3 저장 (HTTP PATCH)

- **액션:** HTTP
- **이름:** HTTP_NotionUpdateVideo
- **Method:** PATCH
- **URI:** `https://api.notion.com/v1/pages/@{variables('varNotionPageId')}`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "properties": {
    "Status": {
      "status": { "name": "Processed" }
    },
    "One Line Thesis": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['one_line_thesis']}" } }]
    },
    "Summary": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['summary']}" } }]
    },
    "Framework": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['framework']}" } }]
    },
    "Relevance to Picks": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['relevance_to_picks']}" } }]
    },
    "Challenges Assumption": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['challenges_assumption']}" } }]
    },
    "Connects To": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['connects_to']}" } }]
    },
    "Apply to Current": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['apply_to_current']}" } }]
    },
    "Apply to Future": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Analysis')?['apply_to_future']}" } }]
    },
    "Processed At": {
      "date": { "start": "@{utcNow()}" }
    }
  }
}
```

---

### Step 4.2: Deadline 날짜 계산 (Compose)

Claude가 반환한 deadline("이번 주", "이번 달", "다음 분기")을 실제 날짜로 변환합니다.

- **액션:** Compose
- **이름:** Compose_DeadlineDate
- **입력:**
```
@if(
  equals(body('Parse_Analysis')?['deadline'], '이번 주'),
  formatDateTime(addDays(utcNow(), sub(7, dayOfWeek(utcNow()))), 'yyyy-MM-dd'),
  if(
    equals(body('Parse_Analysis')?['deadline'], '이번 달'),
    formatDateTime(addDays(startOfMonth(addToTime(utcNow(), 1, 'Month')), -1), 'yyyy-MM-dd'),
    formatDateTime(addToTime(utcNow(), 3, 'Month'), 'yyyy-MM-dd')
  )
)
```

> **변환 규칙:**
> - "이번 주" → 이번 주 일요일 날짜
> - "이번 달" → 이번 달 말일
> - "다음 분기" → 오늘로부터 3개월 후

---

### Step 4.3: Tasks DB 레코드 생성 (HTTP POST)

- **액션:** HTTP
- **이름:** HTTP_NotionCreateTask
- **Method:** POST
- **URI:** `https://api.notion.com/v1/pages`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "parent": {
    "database_id": "@{variables('varTasksDbId')}"
  },
  "properties": {
    "Task": {
      "title": [{ "text": { "content": "@{body('Parse_Analysis')?['next_action']}" } }]
    },
    "Deadline": {
      "date": { "start": "@{outputs('Compose_DeadlineDate')}" }
    },
    "Effort": {
      "select": { "name": "@{body('Parse_Analysis')?['effort']}" }
    },
    "Who": {
      "select": { "name": "@{body('Parse_Analysis')?['who']}" }
    },
    "Source Video": {
      "relation": [{ "id": "@{variables('varNotionPageId')}" }]
    },
    "Completed": {
      "checkbox": false
    }
  }
}
```

---

### Step 4.4: Task 생성 결과 파싱 (Relation 연결 확인)

- **액션:** Parse JSON
- **이름:** Parse_CreatedTask
- **Content:** `@body('HTTP_NotionCreateTask')`
- **Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" }
  }
}
```

> **Relation 양방향 연결:**
> Notion에서 Tasks DB의 "Source Video" Relation을 설정하면,
> Videos DB의 "Tasks" Relation도 자동으로 연결됩니다 (양방향 Relation).
> 별도의 Videos DB 업데이트는 필요하지 않습니다.

---

> **기능 4 완료 시점:**
> - Videos DB: 계층 1~3 필드 + Status "Processed" + Processed At 타임스탬프
> - Tasks DB: next_action 레코드 + deadline/effort/who + Videos DB Relation 연결

---

## ═══════════════════════════════════════
## 기능 5: 완료 알림
## ═══════════════════════════════════════

### Step 5.1: 성공 알림 — Slack 메시지 전송

기능 4 완료 직후에 배치합니다.

- **액션:** Slack 커넥터 > "Post message (V2)"
- **이름:** Slack_SuccessNotification
- **Channel:** #yt-learn
- **Message Text:**
```
✅ @{variables('varVideoTitle')} 분석 완료 — @{body('Parse_Analysis')?['one_line_thesis']} | 태스크: @{body('Parse_Analysis')?['next_action']}
```

> **대안 (Slack 커넥터 대신 HTTP Action 사용):**
> Slack 커넥터가 불안정하면 HTTP Action + Slack API를 직접 사용할 수 있습니다.
>
> - **액션:** HTTP
> - **이름:** HTTP_SlackSuccessNotify
> - **Method:** POST
> - **URI:** `https://slack.com/api/chat.postMessage`
> - **Headers:**
>   | Key | Value |
>   |---|---|
>   | Authorization | `Bearer @{variables('varSlackBotToken')}` |
>   | Content-Type | `application/json` |
> - **Body:**
> ```json
> {
>   "channel": "@{variables('varSlackChannel')}",
>   "text": "✅ @{variables('varVideoTitle')} 분석 완료 — @{body('Parse_Analysis')?['one_line_thesis']} | 태스크: @{body('Parse_Analysis')?['next_action']}"
> }
> ```

---

### Step 5.2: "No Transcript" 알림 (기능 2 분기에 추가)

기능 2의 Step 2.2에서 "자막 없음" 분기(If No)에 Terminate 전에 추가합니다.

- **액션:** Slack 커넥터 > "Post message (V2)"
- **이름:** Slack_NoTranscriptNotification
- **Channel:** #yt-learn
- **Message Text:**
```
⚠️ @{variables('varVideoTitle')} — 자막이 없는 영상이라 분석을 건너뛰었습니다.
```

---

### Step 5.3: 실패 알림 (기능 6에서 상세 구현)

에러 발생 시 Slack 알림은 기능 6의 Scope + "Run After = Failed" 분기에서 처리합니다.
여기서는 메시지 포맷만 정의합니다.

- **메시지 포맷:**
```
❌ @{variables('varVideoTitle')} 실패 — 사유: @{variables('varErrorMessage')}
```

---

> **기능 5 완료 시점:**
> - 성공 시: "✅ [제목] 분석 완료 — [핵심 주장] | 태스크: [실행 태스크]"
> - 자막 없음: "⚠️ [제목] — 자막이 없는 영상이라 분석을 건너뛰었습니다."
> - 실패 시: "❌ [제목] 실패 — 사유: [에러]" (기능 6에서 완성)

---

## ═══════════════════════════════════════
## 기능 6: 에러 처리
## ═══════════════════════════════════════

### 전체 구조: Scope + Run After 패턴

Power Automate에서 try-catch를 구현하는 표준 패턴입니다.
기능 1~5의 모든 단계를 Scope로 감싸고, 실패 시 catch 분기에서 에러를 처리합니다.

```
[변수 초기화]
  ↓
[Scope: Main Pipeline]  ← 기능 1.1 ~ 5.1의 모든 단계가 여기 안에 들어감
  ↓ (성공 시 → 플로우 종료)
  ↓ (실패 시 → Run After: Failed/TimedOut)
[Scope: Error Handler]  ← 에러 처리 + Slack 알림 + Notion Status 업데이트
```

---

### Step 6.1: 변수 추가 — 에러 메시지 저장용

플로우 변수 초기화 섹션에 추가합니다.

| 변수명 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| varErrorMessage | String | (비워둠) | 에러 발생 시 사유 저장 |

---

### Step 6.2: Scope — Main Pipeline

- **액션:** Scope
- **이름:** Scope_MainPipeline
- **안에 포함:** Step 1.1 ~ Step 5.1의 모든 액션

> **Scope 사용 이유:** Scope 안의 어느 액션이든 실패하면,
> Scope 전체가 "Failed" 상태가 됩니다. 이를 감지해서
> catch 분기로 이동합니다.

---

### Step 6.3: Scope — Error Handler (Run After: Failed, TimedOut)

- **액션:** Scope
- **이름:** Scope_ErrorHandler
- **Run After 설정:**
  - Scope_MainPipeline → **has failed** 체크
  - Scope_MainPipeline → **has timed out** 체크
  - (has succeeded는 체크 해제)

> **설정 방법:** Scope_ErrorHandler의 "..." 메뉴 > "Run after 구성" >
> "has failed"와 "has timed out"만 선택

---

### Step 6.4: 에러 메시지 추출 (Compose)

Scope 내부에서 실패한 액션의 에러 메시지를 추출합니다.

- **액션:** Compose
- **이름:** Compose_ExtractError
- **입력:**
```
@{coalesce(
  result('Scope_MainPipeline')?[0]?['error']?['message'],
  actions('HTTP_GetTranscript')?['error']?['message'],
  actions('HTTP_ClaudeAnalysis')?['error']?['message'],
  actions('HTTP_NotionUpdateVideo')?['error']?['message'],
  actions('HTTP_NotionCreateTask')?['error']?['message'],
  '알 수 없는 에러'
)}
```

- **액션:** 변수 설정
- **변수:** varErrorMessage
- **값:** `@outputs('Compose_ExtractError')`

---

### Step 6.5: Notion Videos DB — Status를 "Error"로 변경

- **액션:** Condition
- **이름:** Condition_HasNotionPageId
- **조건:** `@not(empty(variables('varNotionPageId')))` is equal to `true`

#### If Yes (Notion 페이지가 이미 생성된 상태)

- **액션:** HTTP
- **이름:** HTTP_NotionSetError
- **Method:** PATCH
- **URI:** `https://api.notion.com/v1/pages/@{variables('varNotionPageId')}`
- **Headers:**
  | Key | Value |
  |---|---|
  | Authorization | `Bearer @{variables('varNotionToken')}` |
  | Notion-Version | `@{variables('varNotionVersion')}` |
  | Content-Type | `application/json` |
- **Body:**
```json
{
  "properties": {
    "Status": {
      "status": { "name": "Error" }
    }
  }
}
```
- **Settings (고급):**
  - Configure Run After: **is successful, has failed** (이 액션 자체 실패는 무시)

#### If No → Notion 업데이트 건너뜀

---

### Step 6.6: 실패 알림 — Slack 메시지 전송

- **액션:** Slack 커넥터 > "Post message (V2)" 또는 HTTP
- **이름:** Slack_ErrorNotification
- **Channel:** #yt-learn
- **Message Text:**
```
❌ @{if(empty(variables('varVideoTitle')), '(제목 미확인)', variables('varVideoTitle'))} 실패 — 사유: @{variables('varErrorMessage')}
```

> **대안 (HTTP Action):**
> - **Method:** POST
> - **URI:** `https://slack.com/api/chat.postMessage`
> - **Headers:**
>   | Key | Value |
>   |---|---|
>   | Authorization | `Bearer @{variables('varSlackBotToken')}` |
>   | Content-Type | `application/json` |
> - **Body:**
> ```json
> {
>   "channel": "@{variables('varSlackChannel')}",
>   "text": "❌ @{if(empty(variables('varVideoTitle')), '(제목 미확인)', variables('varVideoTitle'))} 실패 — 사유: @{variables('varErrorMessage')}"
> }
> ```

---

### Step 6.7: HTTP Action별 재시도 정책

각 HTTP Action의 Settings > Retry Policy를 아래와 같이 설정합니다.

| HTTP Action | Retry Policy | Count | Interval | 대상 에러 |
|---|---|---|---|---|
| HTTP_NotionCheckDuplicate | Fixed | 3 | PT5S | 429, 5xx |
| HTTP_GetVideoTitle | Fixed | 2 | PT3S | 5xx |
| HTTP_GetTranscript | Fixed | 3 | PT10S | 429, 5xx |
| HTTP_ClaudeAnalysis | Fixed | 2 | PT30S | 429, 529, 5xx |
| HTTP_NotionCreateVideo | Fixed | 3 | PT5S | 429, 5xx |
| HTTP_NotionUpdateVideo | Fixed | 3 | PT5S | 429, 5xx |
| HTTP_NotionCreateTask | Fixed | 3 | PT5S | 429, 5xx |

> **PA에서 설정 방법:**
> 각 HTTP 액션 > "..." > Settings > Retry Policy > "Fixed" 선택 >
> Count와 Interval 입력

---

### Step 6.8: Notion Rate Limit 대응 — 딜레이 삽입

Notion API 호출 사이에 1초 딜레이를 넣어 Rate Limit(3 req/s)를 준수합니다.

- **액션:** Delay
- **이름:** Delay_NotionRateLimit
- **Count:** 1
- **Unit:** Second

> **삽입 위치:** HTTP_NotionCreateVideo 후, HTTP_NotionUpdateVideo 전에 삽입.
> HTTP_NotionUpdateVideo 후, HTTP_NotionCreateTask 전에도 삽입.

---

### Step 6.9: 동시 실행 방지 (Concurrency Control)

같은 URL을 빠르게 여러 번 보내거나, 영상 5개를 연속으로 보낼 때
PA 플로우가 동시에 여러 개 실행되면 문제가 될 수 있습니다.

- **설정 위치:** 플로우 트리거(Slack) > "..." > Settings
- **Concurrency Control:** ON
- **Degree of Parallelism:** 1

> **효과:** 플로우 인스턴스가 한 번에 1개만 실행됩니다.
> 5개 영상을 연속 보내면 1개씩 순차 처리됩니다.
> 이렇게 하면 Notion Rate Limit도 자연스럽게 준수됩니다.

---

> **기능 6 완료 시점:**
> - 어느 단계에서 실패해도 Notion Status가 "Error"로 표시됨
> - 실패 시 Slack에 에러 사유가 포함된 알림이 전송됨
> - 플로우 전체가 멈추지 않음 (Scope + Run After 패턴)
> - 모든 HTTP Action에 재시도 정책 적용
> - 동시 실행 방지로 연속 처리 안정성 확보
