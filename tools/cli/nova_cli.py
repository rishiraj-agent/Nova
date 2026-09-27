import argparse
import json
import os
import urllib.error
import urllib.request


def doctor(api_url: str) -> int:
    print("NOVA Diagnostics")
    print("----------------")
    try:
        with urllib.request.urlopen(f"{api_url.rstrip('/')}/health", timeout=3) as response:
            health = json.load(response)
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        print("Network       OFFLINE - start the local API and retry")
        print("Database      UNKNOWN")
        print("AI Service    DISABLED by default")
        print("Sync          OFFLINE")
        return 1

    print("Network       OK")
    print(f"Database      {health.get('storage', 'UNKNOWN').upper()}")
    print(f"AI Service    {health.get('ai', 'UNKNOWN').upper()}")
    print(f"Sync          {health.get('sync', 'UNKNOWN').upper()}")
    return 0 if health.get("status") == "ok" else 1


def main() -> int:
    parser = argparse.ArgumentParser(prog="nova", description="NOVA local diagnostics")
    parser.add_argument("command", choices=["doctor"])
    parser.add_argument(
        "--api-url", default=os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    )
    args = parser.parse_args()
    return doctor(args.api_url)


if __name__ == "__main__":
    raise SystemExit(main())