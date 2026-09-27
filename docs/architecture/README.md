# Architecture

## Current slice

The React/TypeScript client is a responsive web surface in `apps/web`. Vite proxies `/api` and `/health` to a local FastAPI process. FastAPI validates input with Pydantic, applies REST routes, and accesses SQLite through a small storage boundary. The documented development command binds to `127.0.0.1`; SQLite files live outside the repository by default.

```text
User interface -> versioned REST API -> application routes -> SQLite
                              |-> health/doctor
                              |-> explicit-memory CRUD
                              |-> task CRUD
                              |-> confirmation-gated automation simulation
```

## Replaceable boundaries

- AI: add a provider interface behind an explicit model gateway; define data-retention and local-only policy before enabling it.
- Identity: add OIDC/passkeys and session lifecycle before any network deployment. There is no authentication in this single-user local slice.
- Sync: add an outbox, revisions, encryption, and user-visible conflict resolution; current sync is offline.
- Platform: keep OS actions behind typed capability adapters. Windows and Android clients should request platform permissions and never share privileged execution with model output.
- Storage: keep repository operations separate from API schemas when adding remote PostgreSQL or migrations.

## Local data model

SQLite currently contains `tasks`, `memories`, `automations`, `automation_runs`, and `audit_logs`. Foreign keys and indexes cover active task and automation query paths. User, device, session, conversation, plugin, and cloud-sync schemas remain future work.

## API conventions

Product routes use `/api/v1`; health is `/health`. Pydantic validates request sizes and enums. Unknown IDs return 404, invalid payloads return 422, and unconfirmed automation execution returns a structured 409. Add pagination and authentication before introducing network-facing use cases.