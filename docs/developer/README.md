# Developer setup and roadmap

## Local development

Use Python 3.11+ and Node 20+. Follow the [root README](../../README.md) run and test commands. The API creates its SQLite file under `~/.local/share/nova`; set `NOVA_DATA_DIR` to move it. `NOVA_ALLOWED_ORIGINS` is a comma-separated allowlist.

## Modes

The current UI labels Simple Mode. Advanced Mode and Developer Mode are product directions, not implemented permission tiers. A visual mode switch must never be used as an authorization boundary.

## Roadmap

1. Add migrations, service/repository tests, and local encrypted storage integration.
2. Add authentication and provider abstractions with explicit Local Only policy.
3. Build safe search, notes, conversation persistence, and conflict-aware sync.
4. Implement separately permissioned Windows and Android clients. Android should use the Storage Access Framework; Windows actions should use narrow documented APIs.
5. Add a reviewed automation capability registry, signed/sandboxed extensions, accessibility verification, packaging, and release signing.

The current release workflow packages the web preview only. Windows installers and Android APK/AAB workflows require native client projects, platform SDKs, signing configuration, and platform CI runners. This repository does not claim those artifacts yet.