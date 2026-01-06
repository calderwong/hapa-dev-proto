from __future__ import annotations

import argparse
import getpass
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

from .auth import env_truthy


def _default_host() -> str:
    return str(os.environ.get("HAPA_KEYS_NODE_HOST", "127.0.0.1") or "127.0.0.1").strip() or "127.0.0.1"


def _default_port() -> int:
    return int(os.environ.get("HAPA_KEYS_NODE_PORT", "8733"))


def _default_base_url() -> str:
    return f"http://{_default_host()}:{_default_port()}"


def _is_loopback_host(host: str) -> bool:
    host = str(host or "").strip().lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    if host.startswith("127."):
        return True
    return False


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


def _runtime_file() -> Path:
    return Path.home() / ".hapa_keys_node_runtime.json"


def _save_runtime(pid: int, base_url: str) -> None:
    _runtime_file().write_text(
        json.dumps({"pid": int(pid), "base_url": str(base_url), "started_at": time.time()}, indent=2),
        encoding="utf-8",
    )


def _load_runtime() -> Optional[dict[str, Any]]:
    path = _runtime_file()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _is_process_running(pid: int) -> bool:
    try:
        os.kill(int(pid), 0)
        return True
    except OSError:
        return False


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


def _cmd_start(args: argparse.Namespace) -> int:
    host = str(args.host or "").strip() or "127.0.0.1"
    port = int(args.port)

    allow_non_loopback = env_truthy(os.environ.get("HAPA_KEYS_NODE_ALLOW_NON_LOOPBACK")) or env_truthy(
        os.environ.get("HAPA_KEYS_ALLOW_NON_LOOPBACK")
    )
    if not allow_non_loopback and not _is_loopback_host(host):
        host = "127.0.0.1"

    base_url = f"http://{host}:{port}"

    runtime = _load_runtime()
    if runtime and runtime.get("pid") and _is_process_running(int(runtime["pid"])):
        print(f"Already running (pid={runtime['pid']}, base_url={runtime.get('base_url')})")
        return 0

    if args.daemon:
        env = os.environ.copy()
        env["HAPA_KEYS_NODE_HOST"] = host
        env["HAPA_KEYS_NODE_PORT"] = str(port)

        proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "hapa_keys_node.app:app",
                "--host",
                host,
                "--port",
                str(port),
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        _save_runtime(proc.pid, base_url)
        print(f"Started (pid={proc.pid}, base_url={base_url})")
        print("Token is in .node_token (or HAPA_KEYS_NODE_TOKEN env).")
        return 0

    import uvicorn

    os.environ["HAPA_KEYS_NODE_HOST"] = host
    os.environ["HAPA_KEYS_NODE_PORT"] = str(port)

    print(f"Starting (base_url={base_url})")
    print("Token is in .node_token (or HAPA_KEYS_NODE_TOKEN env).")

    uvicorn.run("hapa_keys_node.app:app", host=host, port=port, log_level="info")
    return 0


def _cmd_stop(_args: argparse.Namespace) -> int:
    runtime = _load_runtime()
    if not runtime or not runtime.get("pid"):
        print("Not running")
        return 0

    pid = int(runtime["pid"])
    if _is_process_running(pid):
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception as exc:
            print(f"Failed to stop pid={pid}: {exc}")
            return 1

    try:
        _runtime_file().unlink()
    except Exception:
        pass

    print(f"Stopped (pid={pid})")
    return 0


def _cmd_status(_args: argparse.Namespace) -> int:
    runtime = _load_runtime()
    if runtime and runtime.get("pid") and _is_process_running(int(runtime["pid"])):
        base_url = str(runtime.get("base_url") or "").strip() or _default_base_url()
        print(f"running: pid={runtime['pid']} base_url={base_url}")
        try:
            health = _http_json("GET", base_url.rstrip("/") + "/health", token=None, payload=None)
            print(json.dumps(health, indent=2))
        except Exception as exc:
            print(f"health check failed: {exc}")
        return 0

    print("not running")
    return 1


def _cmd_health(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    health = _http_json("GET", base_url + "/health", token=None, payload=None)
    print(json.dumps(health, indent=2))
    return 0


def _cmd_capabilities(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    caps = _http_json("GET", base_url + "/capabilities", token=tok, payload=None)
    print(json.dumps(caps, indent=2))
    return 0


def _cmd_list_keys(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    data = _http_json("GET", base_url + "/v1/keys", token=tok, payload=None)
    print(json.dumps(data, indent=2))
    return 0


def _cmd_get_key(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    service = str(args.service or "").strip()
    data = _http_json("GET", base_url + f"/v1/keys/{service}", token=tok, payload=None)
    print(json.dumps(data, indent=2))
    return 0


def _cmd_get_value(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    service = str(args.service or "").strip()
    data = _http_json("GET", base_url + f"/v1/keys/{service}/value", token=tok, payload=None)

    if args.raw:
        value = data.get("value")
        if not isinstance(value, str):
            raise RuntimeError("Unexpected response")
        print(value)
        return 0

    print(json.dumps(data, indent=2))
    return 0


def _cmd_set_key(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    service = str(args.service or "").strip()

    value = args.value
    if value is None:
        value = getpass.getpass("Value: ")

    payload = {"value": str(value)}
    data = _http_json("PUT", base_url + f"/v1/keys/{service}", token=tok, payload=payload)
    print(json.dumps(data, indent=2))
    return 0


def _cmd_delete_key(args: argparse.Namespace) -> int:
    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _require_token(_get_token(args.token))
    service = str(args.service or "").strip()
    data = _http_json("DELETE", base_url + f"/v1/keys/{service}", token=tok, payload=None)
    print(json.dumps(data, indent=2))
    return 0


def _cmd_self_test(args: argparse.Namespace) -> int:
    from .self_test import run_self_test

    base_url = str(args.base_url or "").strip().rstrip("/")
    tok = _get_token(args.token)
    result = run_self_test(base_url, tok)

    text = json.dumps(result, indent=2)
    print(text)

    out_path = str(args.output or "").strip() or None
    if out_path:
        Path(out_path).write_text(text, encoding="utf-8")

    return 0 if result.get("ok") is True else 1


def main(argv: Optional[list[str]] = None) -> int:
    load_dotenv(override=False)

    p = argparse.ArgumentParser(prog="hapa-keys")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_start = sub.add_parser("start")
    p_start.add_argument("--host", default=_default_host())
    p_start.add_argument("--port", default=_default_port(), type=int)
    p_start.add_argument("--daemon", action="store_true")
    p_start.set_defaults(_handler=_cmd_start)

    p_stop = sub.add_parser("stop")
    p_stop.set_defaults(_handler=_cmd_stop)

    p_status = sub.add_parser("status")
    p_status.set_defaults(_handler=_cmd_status)

    p_health = sub.add_parser("health")
    p_health.add_argument("--base-url", default=_default_base_url())
    p_health.set_defaults(_handler=_cmd_health)

    p_caps = sub.add_parser("capabilities")
    p_caps.add_argument("--base-url", default=_default_base_url())
    p_caps.add_argument("--token")
    p_caps.set_defaults(_handler=_cmd_capabilities)

    p_list = sub.add_parser("list")
    p_list.add_argument("--base-url", default=_default_base_url())
    p_list.add_argument("--token")
    p_list.set_defaults(_handler=_cmd_list_keys)

    p_get = sub.add_parser("get")
    p_get.add_argument("service")
    p_get.add_argument("--base-url", default=_default_base_url())
    p_get.add_argument("--token")
    p_get.set_defaults(_handler=_cmd_get_key)

    p_getv = sub.add_parser("get-value")
    p_getv.add_argument("service")
    p_getv.add_argument("--base-url", default=_default_base_url())
    p_getv.add_argument("--token")
    p_getv.add_argument("--raw", action="store_true")
    p_getv.set_defaults(_handler=_cmd_get_value)

    p_set = sub.add_parser("set")
    p_set.add_argument("service")
    p_set.add_argument("--value")
    p_set.add_argument("--base-url", default=_default_base_url())
    p_set.add_argument("--token")
    p_set.set_defaults(_handler=_cmd_set_key)

    p_del = sub.add_parser("delete")
    p_del.add_argument("service")
    p_del.add_argument("--base-url", default=_default_base_url())
    p_del.add_argument("--token")
    p_del.set_defaults(_handler=_cmd_delete_key)

    p_test = sub.add_parser("self-test")
    p_test.add_argument("--base-url", default=_default_base_url())
    p_test.add_argument("--token")
    p_test.add_argument("--output")
    p_test.set_defaults(_handler=_cmd_self_test)

    args = p.parse_args(argv)
    handler = getattr(args, "_handler", None)
    if not handler:
        p.print_help()
        return 2

    try:
        return int(handler(args) or 0)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
