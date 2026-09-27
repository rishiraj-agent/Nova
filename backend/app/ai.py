import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class AIUnavailable(Exception):
    pass


def _settings() -> tuple[str, str]:
    base_url = os.getenv("NOVA_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("NOVA_OLLAMA_MODEL", "llama3.2:3b").strip()
    parsed = urlsplit(base_url)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or not model
    ):
        raise AIUnavailable("Local AI configuration must use a loopback Ollama URL and a model name.")
    return base_url, model


def _get_json(url: str, timeout: float) -> dict:
    request = Request(url, headers={"Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def get_status() -> dict:
    try:
        base_url, model = _settings()
    except AIUnavailable:
        return {"provider": "ollama", "status": "configuration_error", "model": None, "available_models": []}

    try:
        result = _get_json(f"{base_url}/api/tags", timeout=2)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return {"provider": "ollama", "status": "unavailable", "model": model, "available_models": []}

    available_models = [
        item["name"]
        for item in result.get("models", [])
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ][:20]
    status = "ready" if model in available_models else "model_missing"
    return {"provider": "ollama", "status": status, "model": model, "available_models": available_models}


def complete_chat(messages: list[dict[str, str]]) -> str:
    base_url, model = _settings()
    status = get_status()
    if status["status"] == "unavailable":
        raise AIUnavailable("Ollama is not running. Start Ollama locally, then try again.")
    if status["status"] == "model_missing":
        raise AIUnavailable(f"Model {model} is not installed. Run `ollama pull {model}` first.")
    if status["status"] != "ready":
        raise AIUnavailable("Local AI configuration is invalid. Check the NOVA Ollama settings.")

    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"num_predict": 256},
    }).encode("utf-8")
    request = Request(
        f"{base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=120) as response:
            result = json.load(response)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        raise AIUnavailable("Ollama did not return a response. Check that the local model is running.") from error

    content = result.get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise AIUnavailable("Ollama returned an empty response. Try again or choose another model.")
    return content.strip()