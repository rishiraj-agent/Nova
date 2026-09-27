import io
import json

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_tasks_are_persisted_and_can_be_completed(tmp_path):
    client = TestClient(create_app(tmp_path / "test.sqlite3"))

    created = client.post("/api/v1/tasks", json={"title": "  Review build  ", "priority": "high"})
    assert created.status_code == 201
    assert created.json()["title"] == "Review build"

    completed = client.patch(
        f"/api/v1/tasks/{created.json()['id']}", json={"status": "done"}
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "done"
    assert client.get("/api/v1/tasks").json()[0]["id"] == created.json()["id"]


def test_blank_task_title_is_rejected(tmp_path):
    client = TestClient(create_app(tmp_path / "test.sqlite3"))
    assert client.post("/api/v1/tasks", json={"title": "   "}).status_code == 422


def test_memory_is_explicit_and_deletable(tmp_path):
    client = TestClient(create_app(tmp_path / "test.sqlite3"))
    created = client.post(
        "/api/v1/memory",
        json={"content": "Prefers concise summaries", "category": "preferences"},
    )
    assert created.status_code == 201
    assert client.get("/api/v1/memory").json()[0]["content"] == "Prefers concise summaries"
    assert client.delete(f"/api/v1/memory/{created.json()['id']}").status_code == 204
    assert client.get("/api/v1/memory").json() == []


def test_automation_needs_confirmation_and_never_executes_actions(tmp_path):
    client = TestClient(create_app(tmp_path / "test.sqlite3"))
    created = client.post(
        "/api/v1/automations",
        json={"name": "Morning", "trigger": "On request", "actions": ["launch app"]},
    )
    automation_id = created.json()["id"]

    rejected = client.post(f"/api/v1/automations/{automation_id}/run", json={"confirmed": False})
    assert rejected.status_code == 409

    simulated = client.post(f"/api/v1/automations/{automation_id}/run", json={"confirmed": True})
    assert simulated.status_code == 200
    assert simulated.json()["status"] == "simulation_only"
    assert "no system actions" in simulated.json()["message"]


def test_health_does_not_claim_ai_or_sync_are_connected(tmp_path):
    response = TestClient(create_app(tmp_path / "test.sqlite3")).get("/health")
    assert response.json() == {"status": "ok", "storage": "ok", "ai": "local_provider", "sync": "offline"}


def test_ai_status_reports_missing_local_service(tmp_path, monkeypatch):
    from backend.app import ai

    def unavailable(*args, **kwargs):
        raise OSError("Ollama is not running")

    monkeypatch.setattr(ai, "urlopen", unavailable)
    response = TestClient(create_app(tmp_path / "test.sqlite3")).get("/api/v1/ai/status")
    assert response.json() == {
        "provider": "ollama",
        "status": "unavailable",
        "model": "llama3.2:3b",
        "available_models": [],
    }


def test_ai_chat_uses_local_model_and_does_not_persist_prompt(tmp_path, monkeypatch):
    from backend.app import ai

    def local_ollama(request, timeout):
        if request.full_url.endswith("/api/tags"):
            return io.BytesIO(json.dumps({"models": [{"name": "llama3.2:3b"}]}).encode())
        payload = json.loads(request.data)
        assert request.full_url == "http://127.0.0.1:11434/api/chat"
        assert payload["messages"] == [{"role": "user", "content": "Explain this locally"}]
        assert payload["options"] == {"num_predict": 256}
        return io.BytesIO(json.dumps({"message": {"content": "A local answer."}}).encode())

    monkeypatch.setattr(ai, "urlopen", local_ollama)
    client = TestClient(create_app(tmp_path / "test.sqlite3"))
    response = client.post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "Explain this locally"}]},
    )

    assert response.status_code == 200
    assert response.json() == {"reply": "A local answer.", "provider": "ollama", "stored": False}
    with __import__("sqlite3").connect(tmp_path / "test.sqlite3") as connection:
        assert connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").fetchone() is None


def test_ai_chat_does_not_forward_prompt_when_local_model_is_unavailable(tmp_path, monkeypatch):
    from backend.app import ai

    def unavailable(*args, **kwargs):
        raise OSError("Ollama is not running")

    monkeypatch.setattr(ai, "urlopen", unavailable)
    response = TestClient(create_app(tmp_path / "test.sqlite3")).post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "Private question"}]},
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "local_model_unavailable"