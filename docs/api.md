# API Reference

All endpoints live in `api/` (one handler per file) and are served:

- **Production:** Vercel serverless functions → `https://<host>/api/<name>`
- **Local:** Express wrapper in `scripts/dev-server.ts` → `http://127.0.0.1:3000/api/<name>`, proxied by Vite from `/api/*`

Handlers receive Vercel-shaped `req`/`res` objects, so the same code runs in both environments. Shared database access and error formatting come from `api/db.ts` (`db.execute`, `errorMessage`).

Unless stated otherwise, errors return `500` with `{ error, message }`, and wrong methods return `405`.

## Endpoints

### `GET /api/ping`

Health check. Runs `SELECT 1` against Turso.

```json
{
  "status": "ok",
  "time": "2026-10-04T20:15:00.000Z",
  "database": { "connection": "connected" | "failed", "error": null },
  "debug": { "hasUrl": true, "hasKey": true, "protocol": "libsql", "isLibsql": true, "willBeHttps": true }
}
```

### `GET /api/materials`

| Query | Description |
| --- | --- |
| `username` | Materials owned by this user (with `completion_percentage`) |
| `community=true` | Latest 50 shared flashcards/mixed/quiz materials with author |

```json
{ "materials": [ { "id", "title", "type", "completion_percentage" } ] }
```

### `GET /api/material`

| Query | Description |
| --- | --- |
| `id` | Material id (required) |
| `username` | Owner, used to record/derive progress |

```json
{ "material": { "id", "title", "type", "content_json", "author", ... } }
```

### `POST /api/upload`

Body:

```json
{
  "username": "string",
  "title": "string",
  "type": "notes" | "flashcards" | "quiz" | "mixed",
  "content_json": "stringified JSON content",
  "category_id": "string | null"
}
```

Response: `{ "success": true, "materialId": "..." }`.

### `DELETE /api/delete-material`

Body: `{ "id": "materialId", "username": "string" }`.
Owner check runs before the delete. Response: `{ "success": true }`.

### `POST /api/update-progress`

Body: `{ "username", "materialId", "progress" }` — `progress` is `0..100`.
Upserts the `progress` row. Response: `{ "success": true }`.

### `GET /api/categories`

Response: `{ "categories": [ { "id", "name" } ] }` (seeded by `npm run db:init`).

### `POST /api/create-category`

Body: `{ "name": "string" }` → `{ "success": true, "id", "name" }`.
`400 { "error": "Category already exists" }` on a duplicate name.

### `GET /api/daily-challenge`

| Query | Description |
| --- | --- |
| `username` | Excludes questions already attempted by the user; falls back to unattempted/all questions |
| `categories` | Comma-separated category IDs to include (optional) |

Response: `{ "questions": [ { "id", "question_text", "options_json", "correct_answer", "rationale", ... } ] }`.

### `POST /api/record-attempt`

Body: `{ "username", "questionId", "isCorrect" }` → `{ "success": true }`.
Upserts into `question_attempts` (one row per user/question pair).

### `GET|POST /api/user-stats`

Account-synced score/streak (survives localStorage clears and devices).

- `GET ?username=` → `{ "score", "streak", "lastPlayed" }`
- `POST` body `{ "username", "score"?, "streak"?, "lastPlayed"? }` → `{ "success": true, ...stats }` (partial upsert)

### `GET|POST /api/challenge-session`

Today's in-progress daily challenge so a reload resumes where the user stopped.

- `GET ?username=&day=` (day = `YYYY-MM-DD`) → `{ "session": { "questionIds", "answers", "currentIndex", "finished" } | null }`
- `POST` body `{ "username", "day", "questionIds", "answers", "currentIndex", "finished" }` → `{ "success": true }`

### `GET|POST /api/quiz-results`

Per-material quiz card results, synced to the account.

- `GET ?username=&materialId=` → `{ "results": { "<cardId>": true|false } }`
- `POST` body `{ "username", "materialId", "results" }` → `{ "success": true }`

### `GET /api/questions`

Question bank with filters and pagination.

| Query | Description |
| --- | --- |
| `username` | Enables the `status` filter and returns `attempt_correct` per question |
| `category` | Category ID to include |
| `status` | `all` (default), `unattempted`, `wrong`, `correct` |
| `search` | Case-insensitive substring match on `question_text` |
| `ids` | Comma-separated question IDs (max 50) |
| `limit` / `offset` | Page size (1–50, default 20) and offset |

Response: `{ "questions": [ { "id", "question_text", "options_json", "correct_answer", "rationale", "category_id", "category_name", "attempt_correct" } ], "total", "limit", "offset" }`.

### `POST /api/ai-generate`

Requires AI configuration (see below). Body `mode` selects the operation:

| Mode | Body | Response |
| --- | --- | --- |
| `questions` | `notes` (required), `title?`, `count?` (1–15) | `{ "cards": [ { "question", "options", "answer", "rationale" } ] }` |
| `repair` | `rawText` (required), `kind`: `markdown` \| `json` | `{ "fixedText" }` |
| `fill` | `username` (required), `categoryId?` / `categoryName?`, `count?` | `{ "inserted", "cards" }` — generates and stores questions in the bank |

### `POST /api/ai-explain`

Body: `{ "question", "options"?, "selected"?, "correct"?, "rationale"?, "category"? }` → `{ "explanation" }`.

### `POST /api/ai-chat`

Body: `{ "message", "history"?: [ { "role": "user"|"assistant", "content" } ], "context"?: { "title"?, "content"? } }` → `{ "reply" }`.

#### AI configuration

AI endpoints return `502` until these are set in `.env`:

| Variable | Purpose |
| --- | --- |
| `OLLAMA_BASE_URL` | Ollama (`http://127.0.0.1:11434`) or any OpenAI-compatible base URL |
| `OLLAMA_MODEL` | Model name (default `llama3.2`) |
| `OLLAMA_API_KEY` | Optional — presence switches to OpenAI-compatible `/v1/chat/completions` mode |

`GET /api/ping` reports `{ "ai": { "configured": boolean } }`.

## Database schema

Created by `npm run db:init` (see `scripts/init-db.ts`):

| Table | Columns |
| --- | --- |
| `users` | `id` PK, `username` UNIQUE, `theme_preference` default `cozy` |
| `materials` | `id` PK, `user_id` FK, `title`, `type`, `content_json` |
| `progress` | `user_id` + `material_id` PK, `completion_percentage` |
| `categories` | `id` PK, `name` UNIQUE |
| `questions` | `id` PK, `category_id` FK, `user_id` FK, `question_text`, `options_json`, `correct_answer`, `rationale` |
| `question_attempts` | `user_id` + `question_id` PK, `is_correct`, `attempted_at` |
| `user_stats` | `user_id` PK, `score`, `streak`, `last_played` |
| `challenge_sessions` | `user_id` + `day` PK, `question_ids`, `answers`, `current_index`, `finished` |
| `quiz_results` | `user_id` + `material_id` PK, `results_json` |

## Upload formats

Downloadable templates are served statically from `public/`:

- `public/template.md` / `public/template.json` — notes + flashcards (headings become sections, `Q:`/`A:` pairs or `cards[]` become flashcards)
- `public/template-quiz.json` — MCQ quiz (`cards[]` with `question`, `options[]`, `answer`)

Parsing lives in `src/lib/parser.ts`; the browser-side HTTP client for these endpoints is `src/lib/api.ts`.
