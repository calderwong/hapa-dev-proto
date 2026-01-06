from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Optional

from .config import load_settings
from .lineage import run_lineage
from .runtime import read_runtime
from .self_test import run_self_test


def _json_dumps(obj: Any, pretty: bool) -> str:
    return json.dumps(obj, indent=2 if pretty else None, sort_keys=True)


def _request_json(method: str, url: str, *, token: Optional[str], body: Optional[dict]) -> Any:
    headers: dict[str, str] = {}
    data: Optional[bytes] = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            obj = json.loads(raw)
            raise SystemExit(_json_dumps({"http_status": e.code, "error": obj}, pretty=True))
        except Exception:
            raise SystemExit(f"HTTP {e.code}: {raw}")
    except Exception as e:
        raise SystemExit(f"request failed: {e}")

    try:
        return json.loads(raw) if raw else {}
    except Exception:
        return raw


def _resolve_base_url(explicit: Optional[str]) -> str:
    if explicit:
        return str(explicit).rstrip("/")

    env = os.environ.get("HAPA_AVATAR_NODE_BASE_URL")
    if env:
        return str(env).rstrip("/")

    settings = load_settings()
    rt = read_runtime(settings.runtime_path)
    if rt:
        return str(rt.base_url).rstrip("/")

    return f"http://{settings.host}:{settings.port}"


def _resolve_token(explicit: Optional[str]) -> str:
    if explicit:
        return str(explicit).strip()
    settings = load_settings()
    return str(settings.token).strip()


def main() -> int:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--token", default=None)
    parser.add_argument("--pretty", action="store_true", default=False)

    sub = parser.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve")
    p_serve.add_argument("--reload", action="store_true", default=False)

    sub.add_parser("health")
    sub.add_parser("capabilities")

    p_preview = sub.add_parser("preview")
    p_preview.add_argument("avatar_name")

    p_expand = sub.add_parser("expand")
    p_expand.add_argument("avatar_name")
    p_expand.add_argument("--base-prompt", default=None)
    p_expand.add_argument("--model", default="z-image-turbo")
    p_expand.add_argument("--steps", type=int, default=None)
    p_expand.add_argument("--seed", type=int, default=None)
    p_expand.add_argument("--width", type=int, default=None)
    p_expand.add_argument("--height", type=int, default=None)
    p_expand.add_argument("--quantize", type=int, default=None)
    p_expand.add_argument("--guidance", type=float, default=None)
    p_expand.add_argument("--negative-prompt", default=None)
    p_expand.add_argument("--low-ram", action="store_true", default=False)
    p_expand.add_argument("--image-strength", type=float, default=None)
    p_expand.add_argument("--variant", action="append", default=[])
    p_expand.add_argument("--pose", action="append", default=[])
    p_expand.add_argument("--async", dest="async_mode", action="store_true", default=False)

    p_run = sub.add_parser("run-lineage")
    p_run.add_argument("avatar_name")
    p_run.add_argument("--base-prompt", required=True)
    p_run.add_argument("--model", default="z-image-turbo")
    p_run.add_argument("--steps", type=int, default=None)
    p_run.add_argument("--seed", type=int, default=None)
    p_run.add_argument("--width", type=int, default=None)
    p_run.add_argument("--height", type=int, default=None)
    p_run.add_argument("--quantize", type=int, default=None)
    p_run.add_argument("--guidance", type=float, default=None)
    p_run.add_argument("--negative-prompt", default=None)
    p_run.add_argument("--low-ram", action="store_true", default=False)
    p_run.add_argument("--image-strength", type=float, default=None)
    p_run.add_argument("--variant", action="append", default=[])
    p_run.add_argument("--pose", action="append", default=[])
    p_run.add_argument("--timeout-seconds", type=float, default=3600.0)
    p_run.add_argument("--poll-interval-seconds", type=float, default=1.0)

    p_st = sub.add_parser("self-test")
    p_st.add_argument("--full", action="store_true", default=False)
    p_st.add_argument("--avatar-name", default=None)
    p_st.add_argument("--base-prompt", default=None)
    p_st.add_argument("--model", default="z-image-turbo")
    p_st.add_argument("--steps", type=int, default=2)
    p_st.add_argument("--width", type=int, default=512)
    p_st.add_argument("--height", type=int, default=512)
    p_st.add_argument("--timeout-seconds", type=float, default=1200.0)
    p_st.add_argument("--poll-interval-seconds", type=float, default=1.0)

    args = parser.parse_args()

    if args.cmd == "serve":
        settings = load_settings()
        import uvicorn

        uvicorn.run(
            "hapa_avatar_node.app:app",
            host=settings.host,
            port=int(settings.port),
            reload=bool(args.reload),
        )
        return 0

    base_url = _resolve_base_url(args.base_url)

    if args.cmd == "health":
        out = _request_json("GET", f"{base_url}/health", token=None, body=None)
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    token = _resolve_token(args.token)

    if args.cmd == "capabilities":
        out = _request_json("GET", f"{base_url}/capabilities", token=token, body=None)
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    if args.cmd == "preview":
        out = _request_json("GET", f"{base_url}/preview/{args.avatar_name}", token=token, body=None)
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    if args.cmd == "expand":
        variants = list(args.variant) if args.variant else None
        poses = list(args.pose) if args.pose else None
        if variants == []:
            variants = None
        if poses == []:
            poses = None
        payload: dict[str, Any] = {
            "avatar_name": args.avatar_name,
            "base_prompt": args.base_prompt,
            "model": args.model,
            "steps": args.steps,
            "seed": args.seed,
            "width": args.width,
            "height": args.height,
            "quantize": args.quantize,
            "guidance": args.guidance,
            "negative_prompt": args.negative_prompt,
            "low_ram": bool(args.low_ram),
            "image_strength": args.image_strength,
            "variants": variants,
            "poses": poses,
            "async_mode": bool(args.async_mode),
        }
        payload = {k: v for (k, v) in payload.items() if v is not None}
        out = _request_json("POST", f"{base_url}/expand/avatar", token=token, body=payload)
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    if args.cmd == "run-lineage":
        settings = load_settings()
        variants = list(args.variant) if args.variant else None
        poses = list(args.pose) if args.pose else None
        if variants == []:
            variants = None
        if poses == []:
            poses = None
        out = run_lineage(
            settings,
            avatar_name=args.avatar_name,
            base_prompt=args.base_prompt,
            model=args.model,
            negative_prompt=args.negative_prompt,
            steps=args.steps,
            seed=args.seed,
            width=args.width,
            height=args.height,
            quantize=args.quantize,
            guidance=args.guidance,
            low_ram=bool(args.low_ram),
            image_strength=args.image_strength,
            variants=variants,
            poses=poses,
            timeout_seconds=float(args.timeout_seconds),
            poll_interval_seconds=float(args.poll_interval_seconds),
        )
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    if args.cmd == "self-test":
        settings = load_settings()
        out = run_self_test(
            settings,
            full=bool(args.full),
            avatar_name=args.avatar_name,
            base_prompt=args.base_prompt,
            model=args.model,
            steps=int(args.steps),
            width=int(args.width),
            height=int(args.height),
            timeout_seconds=float(args.timeout_seconds),
            poll_interval_seconds=float(args.poll_interval_seconds),
        )
        print(_json_dumps(out, pretty=args.pretty))
        return 0

    raise SystemExit(f"unknown command: {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
