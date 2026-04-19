# Power Automate 자동화 플로우 구현 계획서

> 작성일: 2026-04-02 | 상태: 미구현 (계획)

---

## 전체 플로우 개요

```
[Notion Videos DB] ─ 새 레코드 ─→ [Power Automate]
                                      │
                                      ├─ Step 1: 새 레코드 감지 (트리거)
                                      ├─ Step 2: YouTube URL에서 Video ID 추출
                                      ├─ Step 3: 자막(Transcript) 가져오기
                                      ├─ Step 4: Claude API로 구조화 분석
                                      ├─ Step 5: Notion Terms DB에 용어 레코드 생성
                                      ├─ Step 6: Notion Actions DB에 액션 레코드 생성
                                      └─ Step 7: Videos DB 원본 레코드 업데이트 (상태 + Relations)
```

---

## MVP 범위 (1차)
- Step 1~4 + Step 7만 구현 (Videos DB 저장까지)
- Step 5 (Terms DB), Step 6 (Actions DB) 분리는 2단계
- 트리거는 폴링만 (웹훅은 2단계)
- 자막 추출은 Azure Function 없이 Supadata REST API 사용

---

## Step 1: 새 레코드 감지 (트리거)

### 방식: Recurrence 폴링 (5분 간격)

네이티브 Notion 트리거가 없으므로 Recurrence + HTTP 폴링으로 구현.

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 1.1 | **Recurrence** | 5분 간격 트리거 |
| 1.2 | **Compose** (Get Checkpoint) | SharePoint 리스트 또는 변수에서 마지막 처리 타임스탬프 가져오기 |
| 1.3 | **HTTP** (Query Notion DB) | Notion API로 Videos DB 쿼리 |
| 1.4 | **Parse JSON** | 응답 파싱 |
| 1.5 | **Condition** | results 배열이 비어있으면 종료 |
| 1.6 | **Apply to each** | 신규 레코드마다 Step 2~7 실행 |

### 입력 (1.3 HTTP 요청)

```http
POST https://api.notion.com/v1/databases/{VIDEOS_DB_ID}/query
Headers:
  Authorization: Bearer ntn_xxxxx
  Notion-Version: 2022-06-28
  Content-Type: application/json
```

```json
{
  "filter": {
    "and": [
      {
        "timestamp": "created_time",
        "created_time": { "after": "@{outputs('Get_Checkpoint')}" }
      },
      {
        "property": "Status",
        "status": { "equals": "New" }
      }
    ]
  },
  "sorts": [{ "timestamp": "created_time", "direction": "ascending" }]
}
```

### 출력 (1.4 Parse JSON 스키마)

```json
{
  "results": [
    {
      "id": "page-uuid-1",
      "created_time": "2026-04-02T10:30:00.000Z",
      "properties": {
        "Title": {
          "title": [{ "plain_text": "Buying Negotiation Tips" }]
        },
        "YouTube URL": {
          "url": "https://www.youtube.com/watch?v=abc123def"
        },
        "Status": {
          "status": { "name": "New" }
        }
      }
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| HTTP 401 | Notion 토큰 만료/잘못됨 | Azure Key Vault에서 토큰 관리, 알림 설정 |
| HTTP 429 | Rate limit 초과 | Retry 정책 (Exponential, 5회) |
| 빈 results | 신규 레코드 없음 | Condition에서 조기 종료 (정상 동작) |
| 100건 초과 | 페이지네이션 필요 | Do Until `has_more == false` 루프 |

---

## Step 2: YouTube URL에서 Video ID 추출

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 2.1 | **Compose** (Extract Video ID) | 정규식 또는 문자열 조작으로 Video ID 추출 |

### 입력

```
https://www.youtube.com/watch?v=abc123def
```

### 처리 (Compose 표현식)

```
@{last(split(first(split(items('Apply_to_each')?['properties']?['YouTube URL']?['url'], '&')), 'v='))}
```

또는 정규식이 필요하면 Azure Function에서 처리.

### 출력

```
abc123def
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| URL 형식 불일치 | youtu.be 단축 URL, /shorts/ 등 | 다중 패턴 매칭 또는 Azure Function에서 정규식 처리 |
| URL 없음 | YouTube URL 속성이 비어있음 | Condition 체크 → 해당 레코드 스킵, Status를 "Error" 로 갱신 |

---

## Step 3: 자막(Transcript) 가져오기

### 방식 선택

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. Azure Function + youtube-transcript-api** | 무료, 커스터마이징 가능 | IP 차단 리스크, 셋업 필요 |
| **B. Supadata REST API** | 셋업 간단, IP 차단 없음 | 100크레딧/월 무료, 이후 유료 |
| **C. TranscriptAPI REST API** | 셋업 간단 | 100크레딧 무료, 이후 유료 |

### 옵션 A: Azure Function 경유


#### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 3.1 | **HTTP** (Get Transcript) | Azure Function 호출 |
| 3.2 | **Parse JSON** | 트랜스크립트 응답 파싱 |
| 3.3 | **Compose** (Join Transcript) | 텍스트 연결하여 단일 문자열 생성 |

#### 입력 (3.1 HTTP 요청)

```http
GET https://your-function.azurewebsites.net/api/transcript?video_id=abc123def&code=FUNCTION_KEY
```

#### 출력 (3.2 Parse JSON)

```json
{
  "video_id": "abc123def",
  "transcript": [
    { "text": "Today we're going to talk about", "start": 0.0, "duration": 2.5 },
    { "text": "minimum order quantities", "start": 2.5, "duration": 1.8 },
    { "text": "and how to negotiate them", "start": 4.3, "duration": 2.1 }
  ]
}
```

#### 출력 (3.3 Compose — 전체 텍스트 결합)

```
Today we're going to talk about minimum order quantities and how to negotiate them
```

**표현식:**
```
join(xpath(xml(json(concat('{"r":{"t":', string(body('Parse_Transcript')?['transcript']), '}}'))), '//text/text()'), ' ')
```

또는 Select → Join 방식:
```
// Select Action: From = transcript 배열, Map = item()?['text']
// Compose: join(body('Select'), ' ')
```

### 옵션 B: Supadata REST API (간단)

```http
GET https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=abc123def&lang=en
Headers:
  x-api-key: YOUR_API_KEY
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| HTTP 404 | 자막 없는 영상 | Status를 "No Transcript"로 갱신, 스킵 |
| HTTP 500 (Azure Fn) | IP 차단 | 프록시 설정 또는 서드파티 API로 폴백 |
| 타임아웃 | 긴 영상 처리 시간 | Azure Function 타임아웃 300초로 설정, PA HTTP 타임아웃 조정 |
| 자막 너무 김 | Claude API 토큰 제한 초과 | Step 4에서 텍스트 트리밍 (처음 N자로 제한) |

---

## Step 4: Claude API로 구조화 분석

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 4.1 | **Compose** (Trim Transcript) | 트랜스크립트를 최대 길이로 자르기 (토큰 제한 대비) |
| 4.2 | **HTTP** (Call Claude API) | Claude Messages API 호출 |
| 4.3 | **Parse JSON** (Outer) | Claude 응답 전체 파싱 |
| 4.4 | **Compose** (Extract Inner JSON) | content[0].text에서 JSON 문자열 추출 |
| 4.5 | **Parse JSON** (Inner) | 구조화된 용어/액션 데이터 파싱 |

### 입력 (4.2 HTTP 요청)

```http
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: sk-ant-xxxxx
  anthropic-version: 2023-06-01
  Content-Type: application/json
```

```json
{
  "model": "claude-sonnet-4-5-20241022",
  "max_tokens": 4096,
  "system": "You are a buying/procurement terminology expert. Analyze the YouTube video transcript and extract:\n1. Key buying/procurement terms with definitions\n2. Actionable items for buyers\n\nReturn structured JSON matching the provided schema. For each term, provide a clear definition relevant to the buying context. For actions, provide specific, actionable steps.",
  "messages": [
    {
      "role": "user",
      "content": "Analyze this transcript and extract buying terms and actions:\n\n@{outputs('Trim_Transcript')}"
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
            "video_summary": {
              "type": "string",
              "description": "2-3 sentence summary of the video content"
            },
            "terms": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "term": { "type": "string" },
                  "definition": { "type": "string" },
                  "category": {
                    "type": "string",
                    "enum": ["buying", "sourcing", "logistics", "negotiation", "quality", "finance", "legal"]
                  },
                  "importance": {
                    "type": "string",
                    "enum": ["high", "medium", "low"]
                  }
                },
                "required": ["term", "definition", "category", "importance"]
              }
            },
            "actions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "action": { "type": "string" },
                  "priority": {
                    "type": "string",
                    "enum": ["high", "medium", "low"]
                  },
                  "related_term": { "type": "string" }
                },
                "required": ["action", "priority", "related_term"]
              }
            }
          },
          "required": ["video_summary", "terms", "actions"]
        }
      }
    }
  }
}
```

### 출력 (4.3 → 4.5 최종 파싱 결과)

```json
{
  "video_summary": "This video covers key negotiation strategies for procurement professionals, focusing on MOQ negotiation and supplier relationship management.",
  "terms": [
    {
      "term": "MOQ",
      "definition": "Minimum Order Quantity - the smallest number of units a supplier is willing to sell in a single purchase order",
      "category": "buying",
      "importance": "high"
    },
    {
      "term": "Lead Time",
      "definition": "The total time from placing an order to receiving the goods, including production and shipping",
      "category": "logistics",
      "importance": "high"
    },
    {
      "term": "RFQ",
      "definition": "Request for Quotation - a formal document sent to suppliers asking them to submit a price quote for specific goods or services",
      "category": "sourcing",
      "importance": "medium"
    }
  ],
  "actions": [
    {
      "action": "Send RFQ to at least 3 suppliers before committing to any MOQ",
      "priority": "high",
      "related_term": "RFQ"
    },
    {
      "action": "Negotiate MOQ reduction for first trial order with new suppliers",
      "priority": "high",
      "related_term": "MOQ"
    },
    {
      "action": "Document lead times from each supplier in comparison spreadsheet",
      "priority": "medium",
      "related_term": "Lead Time"
    }
  ]
}
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| HTTP 429 | Claude rate limit | Exponential 재시도 (Retry-After 준수) |
| HTTP 400 | 잘못된 요청 형식 | 로그 남기고 알림, 수동 확인 |
| `stop_reason: "max_tokens"` | 응답 잘림 → JSON 불완전 | `max_tokens` 여유 있게 설정 (4096+), 잘림 시 재시도 |
| `stop_reason: "refusal"` | Claude 거부 | Status를 "Analysis Failed"로 갱신 |
| Parse JSON 실패 | 예기치 않은 응답 형식 | Scope 에러 핸들링 → 원본 응답 로깅 |
| terms/actions 빈 배열 | 영상에 관련 용어 없음 | 정상 처리 — 빈 배열이면 Step 5/6 스킵 |

---

## Step 5: Notion Terms DB에 용어 레코드 생성

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 5.0 | **Initialize Variable** (termPageIds) | 생성된 Term page ID 수집용 배열 |
| 5.1 | **Apply to each** (terms 배열) | 각 term에 대해 반복 |
| 5.1.1 | **HTTP** (Query Existing Term) | 동일 term 이미 존재하는지 확인 (멱등성) |
| 5.1.2 | **Condition** | 존재하면 기존 ID 사용, 없으면 생성 |
| 5.1.3 | **HTTP** (Create Term Page) | Notion API로 새 Term 페이지 생성 |
| 5.1.4 | **Parse JSON** | 응답에서 page ID 추출 |
| 5.1.5 | **Append to array** | termPageIds에 ID 추가 |
| 5.2 | **Delay** | 루프 내 API 호출 간 400ms 대기 (Rate limit 준수) |

### 입력 (5.1.1 — 중복 확인)

```http
POST https://api.notion.com/v1/databases/{TERMS_DB_ID}/query
```

```json
{
  "filter": {
    "property": "Term",
    "title": { "equals": "@{items('Apply_to_each_terms')?['term']}" }
  }
}
```

### 입력 (5.1.3 — 새 Term 생성)

```http
POST https://api.notion.com/v1/pages
```

```json
{
  "parent": { "database_id": "TERMS_DB_ID" },
  "properties": {
    "Term": {
      "title": [{ "text": { "content": "@{items('Apply_to_each_terms')?['term']}" } }]
    },
    "Definition": {
      "rich_text": [{ "text": { "content": "@{items('Apply_to_each_terms')?['definition']}" } }]
    },
    "Category": {
      "select": { "name": "@{items('Apply_to_each_terms')?['category']}" }
    },
    "Importance": {
      "select": { "name": "@{items('Apply_to_each_terms')?['importance']}" }
    },
    "Source Video": {
      "relation": [{ "id": "@{items('Apply_to_each')?['id']}" }]
    }
  }
}
```

### 출력

```json
{
  "id": "term-page-uuid-1",
  "object": "page",
  "created_time": "2026-04-02T10:31:00.000Z"
}
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| HTTP 429 | Rate limit (3 req/s) | Delay 액션 + Exponential 재시도 |
| HTTP 400 | 속성 이름/타입 불일치 | DB 스키마 사전 확인, 에러 로깅 |
| 중복 생성 | 같은 term 중복 | 5.1.1 중복 확인으로 방지 |

---

## Step 6: Notion Actions DB에 액션 레코드 생성

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 6.0 | **Initialize Variable** (actionPageIds) | 생성된 Action page ID 수집용 배열 |
| 6.1 | **Apply to each** (actions 배열) | 각 action에 대해 반복 |
| 6.1.1 | **Compose** (Find Related Term ID) | related_term으로 termPageIds에서 매칭 |
| 6.1.2 | **HTTP** (Create Action Page) | Notion API로 새 Action 페이지 생성 |
| 6.1.3 | **Parse JSON** | 응답에서 page ID 추출 |
| 6.1.4 | **Append to array** | actionPageIds에 ID 추가 |
| 6.2 | **Delay** | 루프 내 400ms 대기 |

### 입력 (6.1.2 — Action 생성)

```http
POST https://api.notion.com/v1/pages
```

```json
{
  "parent": { "database_id": "ACTIONS_DB_ID" },
  "properties": {
    "Action": {
      "title": [{ "text": { "content": "@{items('Apply_to_each_actions')?['action']}" } }]
    },
    "Priority": {
      "select": { "name": "@{items('Apply_to_each_actions')?['priority']}" }
    },
    "Related Term": {
      "relation": [{ "id": "@{outputs('Find_Related_Term_ID')}" }]
    },
    "Source Video": {
      "relation": [{ "id": "@{items('Apply_to_each')?['id']}" }]
    },
    "Completed": {
      "checkbox": false
    }
  }
}
```

### 출력

```json
{
  "id": "action-page-uuid-1",
  "object": "page",
  "created_time": "2026-04-02T10:31:05.000Z"
}
```

### Related Term ID 매칭 로직

Claude 응답의 `related_term` (문자열) → Step 5에서 수집한 `termPageIds` 매핑 필요.

**방법:** Step 5에서 `{ "term": "MOQ", "pageId": "term-page-uuid-1" }` 형태로 배열에 저장, Step 6에서 Filter Array로 매칭.

```
Filter Array:
  From: variables('termMappings')
  Where: item()?['term'] equals items('Apply_to_each_actions')?['related_term']
Result: first(body('Filter_Term_Mapping'))?['pageId']
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| Related Term 매칭 실패 | Claude가 terms 배열에 없는 term을 related_term으로 지정 | Condition → 매칭 실패 시 relation 없이 생성 |
| HTTP 429 | Rate limit | Delay + 재시도 |

---

## Step 7: Videos DB 원본 레코드 업데이트

### Power Automate 액션

| # | 액션 | 설명 |
|---|---|---|
| 7.1 | **HTTP** (Update Video Page) | Videos DB의 원본 레코드 Status 및 Relations 갱신 |
| 7.2 | **Compose** (Update Checkpoint) | 처리 완료 타임스탬프를 체크포인트로 저장 |

### 입력 (7.1 — Video 레코드 업데이트)

```http
PATCH https://api.notion.com/v1/pages/{VIDEO_PAGE_ID}
Headers:
  Authorization: Bearer ntn_xxxxx
  Notion-Version: 2022-06-28
  Content-Type: application/json
```

```json
{
  "properties": {
    "Status": {
      "status": { "name": "Processed" }
    },
    "Summary": {
      "rich_text": [{ "text": { "content": "@{body('Parse_Inner_JSON')?['video_summary']}" } }]
    },
    "Terms": {
      "relation": @{variables('termPageIds')}
    },
    "Actions": {
      "relation": @{variables('actionPageIds')}
    },
    "Processed At": {
      "date": { "start": "@{utcNow()}" }
    }
  }
}
```

여기서 `termPageIds`와 `actionPageIds`는 다음 형태:
```json
[
  { "id": "term-page-uuid-1" },
  { "id": "term-page-uuid-2" },
  { "id": "term-page-uuid-3" }
]
```

### 실패 지점

| 실패 | 원인 | 대응 |
|---|---|---|
| HTTP 400 | relation 속성이 Videos DB에 없음 | DB 스키마 사전 확인 |
| HTTP 429 | Rate limit | Retry |
| 부분 실패 | Step 5/6 일부만 성공 | 성공한 것만 relation에 포함, Status를 "Partial" 로 설정 |

---

## 전체 Power Automate 액션 목록 (요약)

| Step | # | 액션 타입 | 이름 | 비고 |
|---|---|---|---|---|
| 1 | 1.1 | Recurrence | 5분 간격 트리거 | |
| 1 | 1.2 | Compose | Get Checkpoint | SharePoint/Dataverse에서 |
| 1 | 1.3 | HTTP | Query Videos DB | Notion API |
| 1 | 1.4 | Parse JSON | Parse Videos Response | |
| 1 | 1.5 | Condition | Has New Records? | Empty → 종료 |
| 1 | 1.6 | Apply to each | For Each New Video | |
| 2 | 2.1 | Compose | Extract Video ID | URL 파싱 |
| 3 | 3.1 | HTTP | Get Transcript | Azure Fn 또는 REST API |
| 3 | 3.2 | Parse JSON | Parse Transcript | |
| 3 | 3.3 | Compose/Select+Join | Join Transcript Text | |
| 4 | 4.1 | Compose | Trim Transcript | 토큰 제한 대비 |
| 4 | 4.2 | HTTP | Call Claude API | Structured Output |
| 4 | 4.3 | Parse JSON | Parse Claude Outer | |
| 4 | 4.4 | Compose | Extract Inner JSON | content[0].text |
| 4 | 4.5 | Parse JSON | Parse Claude Inner | terms/actions 추출 |
| 5 | 5.0 | Init Variable | termMappings (Array) | |
| 5 | 5.1 | Apply to each | For Each Term | |
| 5 | 5.1.1 | HTTP | Query Existing Term | 중복 확인 |
| 5 | 5.1.2 | Condition | Term Exists? | |
| 5 | 5.1.3 | HTTP | Create Term Page | Notion API |
| 5 | 5.1.4 | Parse JSON + Append | Collect Term ID | |
| 5 | 5.2 | Delay | 400ms | Rate limit |
| 6 | 6.0 | Init Variable | actionPageIds (Array) | |
| 6 | 6.1 | Apply to each | For Each Action | |
| 6 | 6.1.1 | Filter Array | Find Related Term ID | |
| 6 | 6.1.2 | HTTP | Create Action Page | Notion API |
| 6 | 6.1.3 | Parse JSON + Append | Collect Action ID | |
| 6 | 6.2 | Delay | 400ms | Rate limit |
| 7 | 7.1 | HTTP | Update Video Page | Status + Relations |
| 7 | 7.2 | Compose | Update Checkpoint | 타임스탬프 저장 |

**총 액션 수:** 약 25~30개 (루프 내부 포함)

---

## 에러 핸들링 전략 (전체)

### Scope 기반 Try-Catch

```
Scope: "Process Video"
  ├─ Step 2 ~ Step 7 전체
  └─ (Run After: Failed) → Scope: "Handle Error"
      ├─ HTTP: Update Video Status → "Error"
      ├─ HTTP: Archive created pages (롤백)
      └─ Compose: Log error details
```

### 롤백 매트릭스

| Step 실패 시점 | 롤백 대상 | 방법 |
|---|---|---|
| Step 3 (자막 실패) | 없음 | Video Status → "No Transcript" |
| Step 4 (Claude 실패) | 없음 | Video Status → "Analysis Failed" |
| Step 5 (Term 생성 중) | 이미 생성된 Terms | PATCH archived: true |
| Step 6 (Action 생성 중) | 이미 생성된 Terms + Actions | PATCH archived: true |
| Step 7 (업데이트 실패) | Terms + Actions 생성 완료 | 재시도 (데이터 손실 없음) |

### 모니터링

- **Flow 실행 이력:** Power Automate 내장 실행 기록
- **알림:** 실패 시 Teams/Email 알림 (별도 에러 핸들링 플로우)
- **대시보드:** Videos DB의 Status 속성으로 처리 상태 추적
  - `New` → `Processing` → `Processed` / `Error` / `No Transcript` / `Partial`

---

## Notion DB 스키마 (필요 속성)

### Videos DB

| 속성 | 타입 | 비고 |
|---|---|---|
| Title | Title | 영상 제목 |
| YouTube URL | URL | 영상 링크 |
| Status | Status | New / Processing / Processed / Error |
| Summary | Rich Text | Claude 생성 요약 |
| Terms | Relation → Terms DB | |
| Actions | Relation → Actions DB | |
| Processed At | Date | 처리 완료 시간 |

### Terms DB

| 속성 | 타입 | 비고 |
|---|---|---|
| Term | Title | 용어명 |
| Definition | Rich Text | 정의 |
| Category | Select | buying/sourcing/logistics/... |
| Importance | Select | high/medium/low |
| Source Video | Relation → Videos DB | |

### Actions DB

| 속성 | 타입 | 비고 |
|---|---|---|
| Action | Title | 액션 설명 |
| Priority | Select | high/medium/low |
| Related Term | Relation → Terms DB | |
| Source Video | Relation → Videos DB | |
| Completed | Checkbox | |

---

## 사전 준비 체크리스트

- [ ] Notion Internal Integration 생성 및 토큰 발급
- [ ] Videos/Terms/Actions DB를 Integration에 공유
- [ ] DB 스키마 위 명세대로 구성
- [ ] Azure Function 배포 (youtube-transcript-api + 프록시) 또는 서드파티 API 키 발급
- [ ] Claude API 키 발급
- [ ] Azure Key Vault에 토큰/키 저장
- [ ] Power Automate Premium 라이선스 확인 (HTTP 커넥터 필수)
- [ ] 체크포인트 저장소 준비 (SharePoint 리스트 또는 Dataverse)
