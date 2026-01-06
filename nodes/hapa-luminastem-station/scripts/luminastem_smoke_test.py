from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional


def _default_base_url() -> str:
    return str(os.environ.get("HAPA_LUMINASTEM_NODE_URL") or "http://127.0.0.1:8732").strip().rstrip("/")


def _default_token_file() -> Path:
    return (Path(__file__).resolve().parent.parent / ".node_token").resolve()


def _normalize_token(token: Optional[str]) -> Optional[str]:
    value = str(token or "").strip()
    if not value:
        return None
    if value.lower().startswith("bearer "):
        value = value.split(" ", 1)[1].strip()
    return value or None


def _read_text_file(path: Path) -> Optional[str]:
    try:
        text = path.read_text(encoding="utf-8").strip()
        return text or None
    except Exception:
        return None


def _resolve_token(*, token: Optional[str], token_file: Optional[Path]) -> Optional[str]:
    tok = _normalize_token(token)
    if tok:
        return tok

    tok = _normalize_token(os.environ.get("HAPA_LUMINASTEM_NODE_TOKEN"))
    if tok:
        return tok

    path = token_file or _default_token_file()
    return _normalize_token(_read_text_file(path))


def _http_json(
    method: str,
    url: str,
    *,
    token: Optional[str],
    payload: Optional[dict],
    timeout_seconds: float,
) -> dict:
    data = None
    headers: dict[str, str] = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url=url, method=method, data=data, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=float(timeout_seconds)) as res:
            body = res.read()
            return json.loads(body.decode("utf-8")) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read() if hasattr(exc, "read") else b""
        text = body.decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {text}")


def _wait_for_health(base_url: str, *, timeout_seconds: float) -> dict:
    base_url = str(base_url or "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("Missing base_url")

    deadline = time.time() + float(timeout_seconds)
    last_err: Optional[str] = None
    while time.time() < deadline:
        try:
            data = _http_json(
                "GET",
                base_url + "/health",
                token=None,
                payload=None,
                timeout_seconds=2.0,
            )
            if isinstance(data, dict) and data.get("ok") is True:
                return data
            last_err = f"Unexpected response: {data}"
        except Exception as exc:
            last_err = str(exc)
        time.sleep(0.25)

    raise RuntimeError(f"Timed out waiting for /health at {base_url}: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--token", default=None)
    parser.add_argument("--token-file", default=None)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--skip-gemini", action="store_true")
    parser.add_argument("--model", default="gemini-1.5-flash")
    parser.add_argument("--prompt", default="Reply with the single word: ok")
    args = parser.parse_args()

    base_url = str(args.base_url or _default_base_url()).strip().rstrip("/")

    token_file = Path(args.token_file).expanduser().resolve() if args.token_file else None
    token = _resolve_token(token=args.token, token_file=token_file)

    health = _wait_for_health(base_url, timeout_seconds=float(args.timeout))
    print(json.dumps({"health": health}, indent=2, sort_keys=True))

    if not token:
        raise RuntimeError(
            "Missing node token. Set HAPA_LUMINASTEM_NODE_TOKEN or create/read .node_token at repo root."
        )

    caps = _http_json(
        "GET",
        base_url + "/capabilities",
        token=token,
        payload=None,
        timeout_seconds=10.0,
    )
    print(json.dumps({"capabilities": caps}, indent=2, sort_keys=True))

    if args.skip_gemini:
        return 0

    if not bool(health.get("gemini_configured")):
        print("Gemini not configured on backend (set GEMINI_API_KEY); skipping gemini proxy test.")
        return 0

    gemini = _http_json(
        "POST",
        base_url + "/v1/gemini/generateContent",
        token=token,
        payload={"model": str(args.model), "contents": args.prompt},
        timeout_seconds=60.0,
    )
    text = gemini.get("text") if isinstance(gemini, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError(f"Gemini proxy returned empty text: {gemini}")

    print(json.dumps({"gemini": {"text": text}}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise
