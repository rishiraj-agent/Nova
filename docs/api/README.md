# Local API

Base URL: `http://127.0.0.1:8000`. Interactive OpenAPI docs are at `/docs` while the service runs.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Local API, SQLite, AI, and sync status |
| GET | `/api/v1/ai/status` | Local Ollama availability and configured model |
| POST | `/api/v1/ai/chat` | Non-persistent chat through loopback Ollama |
| GET, POST | `/api/v1/tasks` | List or create a task |
| PATCH, DELETE | `/api/v1/tasks/{task_id}` | Update or delete a task |
| GET, POST | `/api/v1/memory` | List or explicitly save approved memory |
| DELETE | `/api/v1/memory/{memory_id}` | Delete a memory |
| GET, POST | `/api/v1/automations` | List or draft a workflow |
| POST | `/api/v1/automations/{automation_id}/run` | Require confirmation, then record a simulation only |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Review the launch plan","priority":"high"}'
```

Automation run body: `{"confirmed":true}`. Missing confirmation returns HTTP 409 with `code: confirmation_required`. Even confirmed runs are simulation-only and cannot execute an action.

The service has no authentication, rate limiting, cloud AI, or multi-user isolation. Loopback-only development is a hard boundary, not a production deployment recipe.

The chat request accepts 1-20 messages with `user` or `assistant` roles. Responses are not written to SQLite. The Ollama URL must resolve to loopback; the default model is `llama3.2:3b`.