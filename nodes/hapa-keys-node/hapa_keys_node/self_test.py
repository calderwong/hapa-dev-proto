from __future__ import annotations

import argparse
import datetime
import json
import os
import secrets
import sys
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _default_host() -> str:
    return str(os.environ.get("HAPA_KEYS_NODE_HOST", "127.0.0.1") or "127.0.0.1").strip() or "127.0.0.1"


def _default_port() -> int:
    return int(os.environ.get("HAPA_KEYS_NODE_PORT", "8733"))


def _default_base_url() -> str:
    return f"http://{_default_host()}:{_default_port()}"


def _read_text_file(path: str) -> Optional[str]:
    try:
        return Path(path).read_text(encoding="utf-8").strip() or None
    except Exception:
        return None


def _node_token_file_paths() -> list[str]:
    paths: list[str] = []

    env_path = os.environ.get("HAPA_KEYS_NODE_TOKEN_FILE")
    if env_path:
        paths.append(env_path)

    paths.append(str(Path.cwd() / ".node_token"))

    repo_root_guess = Path(__file__).resolve().parent.parent
    paths.append(str(repo_root_guess / ".node_token"))

    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _read_node_token_file() -> Optional[str]:
    for path in _node_token_file_paths():
        tok = _read_text_file(path)
        if tok:
            return tok
    return None


def _get_token(arg_token: Optional[str]) -> Optional[str]:
    if arg_token:
        return arg_token
    env_tok = os.environ.get("HAPA_KEYS_NODE_TOKEN")
    if env_tok:
        return str(env_tok).strip() or None
    return _read_node_token_file()


def _require_token(token: Optional[str]) -> str:
    token_v = str(token or "").strip()
    if not token_v:
        raise RuntimeError("Missing token (set HAPA_KEYS_NODE_TOKEN, create .node_token, or pass --token)")
    return token_v


def _http_json(method: str, url: str, *, token: Optional[str], payload: Optional[dict[str, Any]]) -> dict[str, Any]:
    import urllib.error
    import urllib.request

    data = None
    headers: dict[str, str] = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url=url, method=method, data=data, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = res.read()
            return json.loads(body.decode("utf-8")) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read() if hasattr(exc, "read") else b""
        text = body.decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {text}")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Node unavailable: {exc}")


def _http_text(url: str) -> str:
    import urllib.request

    req = urllib.request.Request(url=url, method="GET")
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.read().decode("utf-8", errors="replace")


def run_self_test(base_url: str, token: Optional[str]) -> dict[str, Any]:
    base_url = str(base_url or "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("Missing base_url")

    result: dict[str, Any] = {
        "service": "hapa-keys-node",
        "api_version": "v1",
        "time": _utc_now_iso(),
        "base_url": base_url,
        "ok": False,
        "steps": [],
    }

    def _step(name: str, *, ok: bool, data: Any = None, error: Optional[str] = None) -> None:
        rec: dict[str, Any] = {"name": name, "ok": bool(ok)}
        if data is not None:
            rec["data"] = data
        if error:
            rec["error"] = error
        result["steps"].append(rec)

    try:
        health = _http_json("GET", base_url + "/health", token=None, payload=None)
        if not isinstance(health, dict) or health.get("ok") is not True:
            raise RuntimeError(f"Unexpected /health response: {health}")
        _step("health", ok=True, data={"keys_stored": health.get("keys_stored")})
    except Exception as exc:
        _step("health", ok=False, error=str(exc))
        result["ok"] = False
        return result

    try:
        try:
            _http_json("GET", base_url + "/capabilities", token=None, payload=None)
            _step("auth_required", ok=False, error="Expected HTTP 401")
        except Exception as exc:
            msg = str(exc)
            if "HTTP 401" in msg:
                _step("auth_required", ok=True)
            else:
                _step("auth_required", ok=False, error=msg)
    except Exception as exc:
        _step("auth_required", ok=False, error=str(exc))

    tok = None
    try:
        tok = _require_token(token)
    except Exception as exc:
        _step("token", ok=False, error=str(exc))
        result["ok"] = False
        return result

    try:
        caps = _http_json("GET", base_url + "/capabilities", token=tok, payload=None)
        if not isinstance(caps, dict) or not caps.get("service"):
            raise RuntimeError(f"Unexpected /capabilities response: {caps}")
        _step("capabilities", ok=True, data={"service": caps.get("service"), "api_version": caps.get("api_version")})
    except Exception as exc:
        _step("capabilities", ok=False, error=str(exc))

    try:
        keys = _http_json("GET", base_url + "/v1/keys", token=tok, payload=None)
        items = keys.get("items") if isinstance(keys, dict) else None
        count = len(items) if isinstance(items, list) else None
        _step("list_keys", ok=isinstance(count, int), data={"count": count})
    except Exception as exc:
        _step("list_keys", ok=False, error=str(exc))

    service = f"selftest-{secrets.token_hex(4)}"
    value = f"selftest-value-{secrets.token_hex(8)}"

    try:
        put = _http_json("PUT", base_url + f"/v1/keys/{service}", token=tok, payload={"value": value})
        if not isinstance(put, dict) or put.get("configured") is not True:
            raise RuntimeError(f"Unexpected PUT response: {put}")
        _step("put_key", ok=True, data={"service": service})
    except Exception as exc:
        _step("put_key", ok=False, error=str(exc))

    try:
        getv = _http_json("GET", base_url + f"/v1/keys/{service}/value", token=tok, payload=None)
        ok = isinstance(getv, dict) and getv.get("value") == value and getv.get("source") == "stored"
        _step("get_key_value", ok=ok, data={"service": service, "source": getv.get("source")})
    except Exception as exc:
        _step("get_key_value", ok=False, error=str(exc))

    try:
        delete = _http_json("DELETE", base_url + f"/v1/keys/{service}", token=tok, payload=None)
        ok = isinstance(delete, dict) and delete.get("deleted") is True
        _step("delete_key", ok=ok, data={"service": service})
    except Exception as exc:
        _step("delete_key", ok=False, error=str(exc))

    try:
        html = _http_text(base_url + "/")
        _step("ui", ok="Hapa Keys Node" in html)
    except Exception as exc:
        _step("ui", ok=False, error=str(exc))

    result["ok"] = all(bool(s.get("ok")) for s in result["steps"])
    return result


def main(argv: Optional[list[str]] = None) -> int:
    load_dotenv(override=False)

    p = argparse.ArgumentParser(prog="python -m hapa_keys_node.self_test")
    p.add_argument("--base-url", default=_default_base_url())
    p.add_argument("--token")
    p.add_argument("--output")
    args = p.parse_args(argv)

    tok = _get_token(args.token)
    result = run_self_test(args.base_url, tok)
    text = json.dumps(result, indent=2)
    print(text)

    out_path = str(args.output or "").strip() or None
    if out_path:
        Path(out_path).write_text(text, encoding="utf-8")

    return 0 if result.get("ok") is True else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
