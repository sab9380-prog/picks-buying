# Power Automate + Notion + Claude API 통합 리서치

> 작성일: 2026-04-02

---

## 1. Power Automate에서 Notion DB 새 레코드 감지 — 트리거 방식과 제약

### 1.1 네이티브 커넥터 현황

Power Automate에는 **공식(Microsoft/Notion 제작) 커넥터가 없다.** 존재하는 것은 **Notion (Independent Publisher)** 커넥터로, 커뮤니티 기여자(Chandra Sekhar & Harshini Varma)가 만든 것이다.

**제공 기능 (Action만, Trigger 없음):**
- Query a Database, Create a Page, Retrieve a Page/Block, Append Block Children, Search 등

**핵심 제약:**
- **빌트인 트리거 제로** — "When a new item is added" 같은 트리거가 없음
- 연결을 사용자 간 공유 불가 (각 사용자가 별도 연결 생성)
- Update Page, Create Database 등은 아직 미구현(Planned)

### 1.2 트리거 접근 방식

#### 방식 A: 폴링 (Recurrence + Query) — 가장 일반적

```
Recurrence 트리거 (매 5분)
  → Notion "Query a Database" (created_time 필터)
  → 신규 레코드 처리
  → 체크포인트 타임스탬프 갱신
```

**필터 예시:**
```json
{
  "filter": {
    "timestamp": "created_time",
    "created_time": { "after": "2026-04-01T00:00:00Z" }
  },
  "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
}
```

- **장점:** 단순, 안정, 추가 인프라 불필요
- **단점:** 실시간 아님 (최소 1분~5분 간격), 변경 없어도 API 호출 소모

#### 방식 B: Notion Integration Webhook (개발자 API)

Notion이 지원하는 통합 웹훅으로, 특정 이벤트 발생 시 HTTP POST를 보냄.

**지원 이벤트:**
- `page.created` — DB에 새 페이지 생성 시 발화
- `page.property_values.updated` — 속성 변경
- `page.content_updated` — 내용 변경

**Power Automate 연동 방법:**
1. "When an HTTP request is received" 인스턴트 트리거로 Flow 생성
2. 생성된 HTTPS URL을 Notion 통합 설정의 Webhooks 탭에 등록
3. Notion이 `verification_token`으로 검증 POST → Flow에서 처리
4. 이후 실시간 이벤트 POST 수신

**주의:** 웹훅 페이로드는 **sparse** — 이벤트 타입 + 리소스 ID만 포함, 전체 페이지 데이터는 별도 API 호출로 가져와야 함.

#### 방식 C: Notion 내장 Database Automation → Webhook Action

Notion 유료 플랜에서 DB 자동화 설정 시 "Send webhook" 액션으로 임의 URL에 POST 가능.

- 유료 플랜만 사용 가능
- POST만 지원, 페이지 속성만 전송 (내용 미포함)
- DB별로 Notion UI에서 개별 설정 필요

### 1.3 추천: 하이브리드 접근

**웹훅(실시간) + 폴링(안전망)** 병행이 베스트 프랙티스. 웹훅은 네트워크 장애 등으로 누락될 수 있으므로 30~60분 간격 폴링으로 보완.

### 1.4 제약 사항 요약

| 항목 | 상세 |
|---|---|
| 폴링 최소 간격 | Premium: 1분, Standard: 5분+ |
| Notion API Rate Limit | 평균 **3 req/sec** (초과 시 HTTP 429 + Retry-After) |
| 페이지네이션 | 응답당 최대 **100건**, `start_cursor`로 페이징 필수 |
| 페이로드 크기 | 요청당 1,000 블록, 500KB 제한 |
| 웹훅 sparse 페이로드 | 이벤트 타입 + 리소스 ID만, 데이터는 별도 GET |
| 웹훅 접근 범위 | 통합에 명시적으로 공유된 DB/페이지만 |

### 1.5 베스트 프랙티스

1. **체크포인트 영속 저장** — SharePoint 리스트 항목, Dataverse, Azure Table Storage에 마지막 폴링 타임스탬프 저장
2. **페이지네이션 항상 구현** — 100건 초과 시 `start_cursor` 처리
3. **Rate limit 백오프** — 루프 내 API 호출 시 딜레이 추가
4. **Custom Connector 사용** — HTTP 커넥터보다 토큰 관리가 안전
5. **멱등성 보장** — 처리 완료된 page ID 추적으로 중복 방지
6. **서버 측 필터** — PA에서 전체 fetch 후 필터링 대신 Notion API 쿼리 바디에 필터 전달

---

## 2. youtube-transcript-api HTTP 호출 방법

### 2.1 라이브러리 개요

[youtube-transcript-api](https://pypi.org/project/youtube-transcript-api/) (최신 v1.2.4, 2026-01)는 YouTube 영상의 자막/트랜스크립트를 가져오는 Python 라이브러리.

- **API 키 불필요** — YouTube 내부 Innertube API 사용
- 수동 자막 + 자동 생성 자막 모두 지원
- 다국어 + 번역 지원

**v1.x API (현재):**
```python
from youtube_transcript_api import YouTubeTranscriptApi

ytt_api = YouTubeTranscriptApi()
transcript = ytt_api.fetch("VIDEO_ID", languages=['en'])
raw = transcript.to_raw_data()  # [{'text': '...', 'start': 0.0, 'duration': 1.54}, ...]
```

### 2.2 Power Automate에서 직접 호출 가능?

**불가능.** Power Automate (클라우드 플로우)는 Python 라이브러리를 직접 실행할 수 없다.
→ **래퍼 서비스**(HTTP 엔드포인트)가 필요.

### 2.3 방법 A: Azure Function 경유 (Microsoft 생태계 추천)

```
Power Automate → HTTP Action → Azure Function (Python) → youtube-transcript-api → JSON 응답
```

**Azure Function 코드 예시:**
```python
import azure.functions as func
import json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

app = func.FunctionApp()

@app.function_name(name="GetTranscript")
@app.route(route="transcript", auth_level=func.AuthLevel.FUNCTION)
def get_transcript(req: func.HttpRequest) -> func.HttpResponse:
    video_id = req.params.get('video_id')
    if not video_id:
        try:
            video_id = req.get_json().get('video_id')
        except ValueError:
            pass

    if not video_id:
        return func.HttpResponse(
            json.dumps({"error": "video_id is required"}),
            status_code=400, mimetype="application/json"
        )

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id, languages=['en', 'ko'])
        raw_data = transcript.to_raw_data()
        return func.HttpResponse(
            json.dumps({"video_id": video_id, "transcript": raw_data}),
            status_code=200, mimetype="application/json"
        )
    except TranscriptsDisabled:
        return func.HttpResponse(
            json.dumps({"error": "Transcripts disabled"}),
            status_code=404, mimetype="application/json"
        )
    except NoTranscriptFound:
        return func.HttpResponse(
            json.dumps({"error": "No transcript found"}),
            status_code=404, mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500, mimetype="application/json"
        )
```

**requirements.txt:**
```
azure-functions
youtube-transcript-api>=1.2.0
```

**Power Automate HTTP Action:**
- Method: `GET`
- URI: `https://your-function.azurewebsites.net/api/transcript?video_id=VIDEO_ID&code=FUNCTION_KEY`

### 2.4 핵심 이슈: 클라우드 IP 차단

YouTube가 AWS/Azure/GCP 등 **주요 클라우드 IP를 적극 차단**함. 로컬에서 동작해도 클라우드에서 `RequestBlocked` 에러 발생 가능.

**대응책 (효과 순):**
1. **회전 레지덴셜 프록시** — 라이브러리 내장 Webshare 통합 사용
2. **요청 간 2~5초 딜레이**
3. **User-Agent 로테이션**

**프록시 설정:**
```python
from youtube_transcript_api.proxies import WebshareProxyConfig
import os

ytt_api = YouTubeTranscriptApi(
    proxy_config=WebshareProxyConfig(
        proxy_username=os.environ["WEBSHARE_USER"],
        proxy_password=os.environ["WEBSHARE_PASS"],
    )
)
```

### 2.5 방법 B: 서드파티 REST API (Azure Function 없이)

Power Automate에서 HTTP Action으로 직접 호출 가능한 대안:

| 서비스 | 엔드포인트 | 무료 티어 | 비고 |
|---|---|---|---|
| **Supadata** | `GET https://api.supadata.ai/v1/transcript?url=VIDEO_URL` | 100크레딧/월 | AI 폴백, 멀티플랫폼 |
| **TranscriptAPI** | `GET https://transcriptapi.com/api/v2/youtube/transcript?video_url=URL` | 100크레딧 | 월 1500만+ 트랜스크립트 처리 |
| **RapidAPI 옵션** | 다수 | 플랜별 | per-request 과금 |

**Power Automate 전용이라면 서드파티 REST API가 가장 간단** — Azure Function 셋업 없이 HTTP Action + API 키만으로 완결.

### 2.6 YouTube Data API v3 비교

| | YouTube Data API v3 | youtube-transcript-api |
|---|---|---|
| 인증 | OAuth 2.0 필수 | 없음 |
| 자막 다운로드 | 본인 소유 영상만 | 공개 영상 모두 |
| 자동 생성 자막 | 다운로드 불가 | 지원 |
| 일일 할당량 | 10,000 유닛 | 없음 (IP 기반 제한) |

→ 일반 공개 영상 자막 추출에는 YouTube Data API v3 부적합.

---

## 3. Notion API 멀티 DB 동시 레코드 생성

### 3.1 핵심 엔드포인트

```
POST https://api.notion.com/v1/pages
Headers:
  Authorization: Bearer <integration_token>
  Notion-Version: 2022-06-28
  Content-Type: application/json
```

Notion의 모든 DB 레코드는 "페이지"이며, **배치 엔드포인트는 없다** — DB마다 별도 POST 호출 필요.

### 3.2 속성 타입별 JSON 형식

| 속성 타입 | JSON 키 | 값 형식 |
|---|---|---|
| **title** | `"title"` | `[{ "text": { "content": "..." } }]` |
| **rich_text** | `"rich_text"` | `[{ "text": { "content": "..." } }]` |
| **number** | `"number"` | `1.49` |
| **select** | `"select"` | `{ "name": "Option" }` |
| **multi_select** | `"multi_select"` | `[{ "name": "Tag1" }, { "name": "Tag2" }]` |
| **date** | `"date"` | `{ "start": "2026-04-02", "end": null }` |
| **relation** | `"relation"` | `[{ "id": "page_id" }]` |
| **checkbox** | `"checkbox"` | `true` / `false` |
| **url** | `"url"` | `"https://..."` |
| **status** | `"status"` | `{ "name": "In Progress" }` |
| **files** | `"files"` | `[{ "name": "f.pdf", "external": { "url": "..." } }]` |

**읽기 전용 (API로 설정 불가):** rollup, created_by, created_time, last_edited_by, last_edited_time, formula, unique_id

### 3.3 Relation — DB 간 레코드 연결

```json
"Related Terms": {
  "relation": [
    { "id": "RELATED_PAGE_ID_1" },
    { "id": "RELATED_PAGE_ID_2" }
  ]
}
```

**순서 문제 (닭과 달걀):** Video → Term 관계를 설정하려면 Term의 page ID가 먼저 필요 → **의존성이 있는 레코드는 순차 생성** 필수.

### 3.4 멀티 DB 생성 전략

#### 의존성 있는 경우 (Relations) — 순차 생성

```javascript
// 1. Term 먼저 생성
const term = await notion.pages.create({
  parent: { database_id: TERMS_DB_ID },
  properties: {
    "Name": { title: [{ text: { content: "MOQ" } }] },
    "Category": { select: { name: "Buying" } }
  }
});

// 2. Video 생성 (Term 연결)
const video = await notion.pages.create({
  parent: { database_id: VIDEOS_DB_ID },
  properties: {
    "Title": { title: [{ text: { content: "Lesson 1" } }] },
    "Related Terms": { relation: [{ id: term.id }] }
  }
});

// 3. Action 생성 (Video + Term 연결)
const action = await notion.pages.create({
  parent: { database_id: ACTIONS_DB_ID },
  properties: {
    "Action": { title: [{ text: { content: "Review MOQ policy" } }] },
    "Video": { relation: [{ id: video.id }] },
    "Term": { relation: [{ id: term.id }] }
  }
});
```

#### 의존성 없는 경우 — 병렬 생성 (배치 3개씩)

```javascript
const BATCH_SIZE = 3; // Rate limit 준수
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(r => notion.pages.create(r)));
  await delay(1100); // 배치 간 1초 대기
}
```

### 3.5 Power Automate에서의 구현

1. **HTTP Action 1** — Term 생성 → Parse JSON으로 `id` 추출
2. **HTTP Action 2** — Video 생성 (Term ID 참조) → Parse JSON으로 `id` 추출
3. **HTTP Action 3** — Action 생성 (Video ID + Term ID 참조)
4. **Scope로 래핑** + "Run After = Failed" 분기에서 생성된 페이지 archive (롤백)

**Rate limit 처리:** 각 HTTP Action 후 `statusCode == 429` 체크 → Delay → Do Until 재시도

### 3.6 에러 핸들링 / 롤백

Notion에는 **트랜잭션/롤백이 없다.** 3번째 DB 쓰기 실패 시 이전 2건은 이미 커밋됨.

**보상 트랜잭션 패턴:**
```javascript
const createdIds = [];
try {
  const term = await notion.pages.create(termPayload);
  createdIds.push(term.id);
  // ... 나머지 생성
} catch (error) {
  // 롤백: 성공한 페이지 아카이브
  for (const id of createdIds) {
    await notion.pages.update({ page_id: id, archived: true });
  }
  throw error;
}
```

### 3.7 Rate Limit 상세

- 평균 **3 requests/sec/integration**
- 초과 시 HTTP 429 + `Retry-After` 헤더
- 버스트는 일시적으로 허용되나 지속 처리량은 3/s 이하 유지
- 페이로드당 1,000 블록 제한

---

## 4. Claude API JSON 응답 파싱 → Notion 필드 매핑

### 4.1 Claude API 응답 구조

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-5-20241022",
  "stop_reason": "end_turn",
  "content": [
    { "type": "text", "text": "..." }
  ],
  "usage": { "input_tokens": 100, "output_tokens": 50 }
}
```

`content`는 배열로, `text` 블록 또는 `tool_use` 블록을 포함.

### 4.2 구조화된 JSON 출력 요청 방법 (3가지)

#### 방법 A: Structured Outputs (제약 디코딩) — **추천**

2025년 11월부터 베타. `output_config.format`에 JSON 스키마를 지정하면 Claude가 스키마에 맞는 JSON만 생성.

```json
{
  "model": "claude-sonnet-4-5-20241022",
  "max_tokens": 1024,
  "system": "Extract structured glossary data from the user input.",
  "messages": [{ "role": "user", "content": "MOQ - the minimum order quantity..." }],
  "output_config": {
    "format": {
      "type": "json_schema",
      "json_schema": {
        "name": "glossary_entry",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "term": { "type": "string" },
            "definition": { "type": "string" },
            "category": { "type": "string", "enum": ["buying","sourcing","logistics","negotiation"] },
            "actions": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["term", "definition", "category", "actions"]
        }
      }
    }
  }
}
```

응답: `response.content[0].text`에 유효한 JSON 문자열. 첫 호출 시 스키마 컴파일 100~300ms, 이후 24시간 캐시.

#### 방법 B: Strict Tool Use

```json
{
  "tools": [{
    "name": "save_glossary_entry",
    "description": "Saves a parsed glossary entry",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "term": { "type": "string" },
        "definition": { "type": "string" },
        "category": { "type": "string" },
        "actions": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["term", "definition", "category", "actions"]
    }
  }],
  "tool_choice": { "type": "tool", "name": "save_glossary_entry" }
}
```

응답: `response.content[0].input`에 구조화된 객체.

#### 방법 C: System Prompt + 예시 (레거시)

신뢰도 낮음. Structured Outputs 또는 Tool Use 사용을 강력 권장.

### 4.3 Power Automate에서 파싱 플로우

```
1. HTTP Action → Claude API 호출
2. Parse JSON (외부) → content[0].text 추출
3. Compose → body('Parse_Claude')?['content']?[0]?['text']
4. Parse JSON (내부) → {term, definition, category, actions[]} 추출
5. Select Action → actions 배열을 multi_select 형식으로 변환
6. HTTP Action → Notion API 호출
```

### 4.4 Claude → Notion 필드 매핑 예시

**Claude 응답 (Structured Output):**
```json
{
  "term": "MOQ",
  "definition": "Minimum Order Quantity - the smallest number of units...",
  "category": "buying",
  "actions": ["Negotiate lower MOQ", "Compare suppliers", "Calculate storage costs"]
}
```

**Notion API 요청 바디:**
```json
{
  "parent": { "database_id": "TERMS_DB_ID" },
  "properties": {
    "Term": {
      "title": [{ "text": { "content": "MOQ" } }]
    },
    "Definition": {
      "rich_text": [{ "text": { "content": "Minimum Order Quantity - ..." } }]
    },
    "Category": {
      "select": { "name": "buying" }
    },
    "Actions": {
      "multi_select": [
        { "name": "Negotiate lower MOQ" },
        { "name": "Compare suppliers" },
        { "name": "Calculate storage costs" }
      ]
    }
  }
}
```

### 4.5 Actions를 별도 DB로 분리하는 경우

```
Apply to each (actions 배열):
  → HTTP POST → Actions DB에 페이지 생성, 반환된 page ID 수집
  → 변수에 {"id": "page_id"} append

→ Terms 레코드의 Relation 속성에 수집된 ID 배열 설정:
  "Related Actions": { "relation": [{"id":"id1"}, {"id":"id2"}] }
```

### 4.6 Power Automate 유용 표현식

| 표현식 | 용도 |
|---|---|
| `body('Parse')?['content']?[0]?['text']` | 중첩 속성 안전 접근 |
| `first(body('Parse')?['content'])` | 배열 첫 요소 |
| `length(body('Parse')?['actions'])` | 배열 길이 |
| `join(body('Select'), ', ')` | 배열 → 문자열 |
| `if(empty(body('X')?['f']), 'default', body('X')?['f'])` | null 대체 |
| `coalesce(body('X')?['a'], 'fallback')` | 첫 번째 non-null |
| `formatDateTime(body('X')?['date'], 'yyyy-MM-dd')` | Notion 날짜 포맷 |

### 4.7 에러 핸들링

**Claude API 레벨:**
- 400: 잘못된 요청 → 재시도 금지, 요청 수정
- 429: Rate limit → `Retry-After` 헤더 준수 지수 백오프
- 5xx: 서버 오류 → 백오프 + 지터 재시도

**응답 레벨:**
- `stop_reason: "max_tokens"` → JSON 불완전 가능 → `max_tokens` 늘려 재시도
- `stop_reason: "refusal"` → 비즈니스 로직 예외 처리

**Power Automate:**
- HTTP Action Settings에서 Exponential 재시도 정책 설정 (count=5, 429/5xx)
- Scope + "Run After = Failed" 분기로 try-catch
- Parse JSON 전 필수 필드 null 체크: `empty(body('Parse')?['term'])`

### 4.8 프롬프트 엔지니어링 베스트 프랙티스

1. **Structured Outputs 또는 Strict Tool Use 반드시 사용** — 프롬프트만으로는 형식 보장 불가
2. **3~5개 예시** 포함 (`<example>` 태그)
3. **스키마에 enum 제약** — `"enum": ["buying","sourcing","logistics"]`로 Claude가 새 값 생성 방지
4. **필드 정의 명시** — "actions 필드는 구체적 실행 가능 단계만, 설명 아님"
5. **`tool_choice` 강제** — 텍스트 대신 tool call 보장
6. **`max_tokens` 적절히 설정** — 너무 낮으면 잘림
7. **eval 구축** — 10~20개 테스트 케이스로 프롬프트 변경 시 회귀 테스트

---

## 5. 전체 아키텍처 요약

```
┌──────────────┐     Webhook/Poll      ┌──────────────────┐
│ Notion DB    │ ───────────────────→  │ Power Automate   │
│ (Videos)     │  새 레코드 감지        │                  │
└──────────────┘                       │  1. YouTube URL 추출
                                       │  2. Azure Function 호출
                                       │     → youtube-transcript-api
                                       │  3. Claude API 호출
                                       │     → 구조화 JSON 응답
                                       │  4. Notion API 호출
                                       │     → Videos/Terms/Actions DB
                                       │        레코드 생성
                                       └──────────────────┘
```

### 핵심 제약 체크리스트

| 구간 | 주요 제약 | 대응 |
|---|---|---|
| PA → Notion 감지 | 네이티브 트리거 없음 | 웹훅 + 폴링 하이브리드 |
| PA → YouTube 자막 | Python 라이브러리 직접 호출 불가 | Azure Function 래퍼 or REST API 서비스 |
| YouTube → 클라우드 | 클라우드 IP 차단 | 레지덴셜 프록시 or 서드파티 API |
| Notion API | 배치 엔드포인트 없음, 3 req/s | 순차 생성 + 딜레이 + 롤백 패턴 |
| Claude API | JSON 형식 보장 필요 | Structured Outputs / Strict Tool Use |
| 전체 | 트랜잭션 없음 | 보상 트랜잭션 (archive 롤백) |
