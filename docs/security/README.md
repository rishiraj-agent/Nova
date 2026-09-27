# Security and privacy

## Current behavior

- The documented server command binds to loopback, not all interfaces.
- CORS defaults to the Vite development origin; allowed origins are explicit.
- Chat prompts go only to a loopback Ollama endpoint. NOVA does not persist prompts or transcripts; if Ollama is unavailable, the request is rejected before forwarding message content.
- SQLite stores tasks, approved memories, automation drafts, and audit records for simulated runs in the user's local data directory.
- Automation runs require explicit confirmation and still do not execute system actions.
- Diagnostics report service state only and do not include content or credentials.

## Not implemented

Authentication, encrypted SQLite, OS keychain integration, cloud transport, key rotation, plugin sandboxing/signature verification, telemetry controls, session management, and native permission prompts remain future work. Local inference does not itself encrypt local data. Do not expose this API beyond the local machine or use it for sensitive production data.

## Before network deployment

Add OIDC/passkeys and appropriate CSRF/session protections, authorization on every resource, TLS termination, request and rate limits, structured redacted logs, database migrations/backups, secret-manager integration, encryption/key management, threat modeling, dependency scanning, and security review. Treat model output as untrusted input and route it only to scoped, user-approved tools. Destructive or privileged actions need clear previews, explicit confirmation, and auditable outcomes.