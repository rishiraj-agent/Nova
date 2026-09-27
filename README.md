NOVA is an original, privacy-aware workspace for bringing assistance, personal organization, and device tools together. This repository starts with a runnable local-first foundation: a responsive web client, a loopback-only FastAPI service, and SQLite storage. It is a foundation, not a claim that future Windows and Android integrations are already implemented.

## What works today

- Responsive NOVA Home with Home, Intelligence, Tasks, Files, Flows, Devices, and Security views.
- Local task creation and completion, persisted in SQLite.
- Explicitly approved personal memories, persisted locally through the API.
- Optional local AI chat through Ollama. Prompts and session transcripts are not persisted or sent to cloud services.
- Automation drafts and a confirmation gate. Confirmed runs are recorded as simulations; they never execute system commands.
- Health endpoint, `nova doctor`, API/UI tests, and GitHub Actions validation.

Privileged actions and external AI remain disabled until platform permission adapters and reviewable execution policies are added.

## Architecture

```text
apps/web (React + TypeScript)
	| REST /api/v1
backend/api (FastAPI; loopback in development)
	| storage boundary
backend/storage (SQLite; local-first)

Future adapters: Windows client | Android client | Web deployment
Future services: OIDC auth | model gateway | encrypted sync | extension host
```

See [architecture](docs/architecture/README.md), [API reference](docs/api/README.md), and [security notes](docs/security/README.md).

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer and npm
- Ollama and the configured model for local AI chat (optional)

## Run locally

Terminal 1, from the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (normally http://localhost:5173). API docs are at http://127.0.0.1:8000/docs. Data is stored under `~/.local/share/nova` by default; set `NOVA_DATA_DIR` to choose another local directory.

To enable local AI, install Ollama, start its local service, then run `ollama pull llama3.2:3b`. NOVA checks `http://127.0.0.1:11434` by default. Set `NOVA_OLLAMA_URL` and `NOVA_OLLAMA_MODEL` before starting the API to use another loopback endpoint or installed model. The API rejects non-loopback Ollama URLs to keep prompts local.

## Build and test

```bash
npm run typecheck
npm test
npm run build
python -m pip install -r backend/requirements-dev.txt
python -m pytest
```

Run the diagnostic CLI while the API is running:

```bash
PYTHONPATH=tools/cli python -m nova_cli doctor
```

## Platform direction

The current client is a web foundation and can be used as a future web surface. Windows tray, global shortcuts, PowerShell, Android Storage Access Framework, native voice, secure platform credential storage, and signed installers require platform-specific clients and permission review; they are not simulated as completed integrations. See [developer setup and roadmap](docs/developer/README.md).

## Configuration

`.env.example` is a reference for planned deployment configuration. The current API reads `NOVA_DATA_DIR` and `NOVA_ALLOWED_ORIGINS`; it does not load `.env` automatically or consume AI credentials. Never commit secrets.

## Security and privacy

Development mode binds to loopback and stores data locally. It has no account/authentication or cloud sync. Do not expose it to a network or use it as a multi-user service. Ollama runs locally when installed; prompts are held in memory only. Automation runs are simulation-only. Review [security notes](docs/security/README.md) before extending the service.

## Contributing

Keep local-first behavior, explicit permission boundaries, safe diagnostics, and provider/platform adapters testable. Add a focused test for behavior changes and document any external data flow.

## License

No license has been selected yet. All rights are reserved unless a license is added by the maintainers.