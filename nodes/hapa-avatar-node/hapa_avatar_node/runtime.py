from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class NodeRuntime:
    base_url: str
    host: str
    port: int
    token_path: str
    started_at: str
    pid: int


def read_runtime(runtime_path: Path) -> Optional[NodeRuntime]:
    try:
        if not runtime_path.exists():
            return None
        doc = json.loads(runtime_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    if not isinstance(doc, dict):
        return None

    base_url = doc.get("base_url")
    host = doc.get("host")
    port = doc.get("port")
    token_path = doc.get("token_path")
    started_at = doc.get("started_at")
    pid = doc.get("pid")

    if not isinstance(base_url, str):
        return None
    if not isinstance(host, str):
        return None
    if not isinstance(port, int):
        return None
    if not isinstance(token_path, str):
        return None
    if not isinstance(started_at, str):
        return None
    if not isinstance(pid, int):
        return None

    return NodeRuntime(
        base_url=base_url,
        host=host,
        port=port,
        token_path=token_path,
        started_at=started_at,
        pid=pid,
    )


def write_runtime(*, repo_root: Path, runtime_path: Path, host: str, port: int, token_path: Path) -> NodeRuntime:
    base_url = f"http://{host}:{port}"

    try:
        token_path_str = str(token_path.relative_to(repo_root))
    except Exception:
        token_path_str = str(token_path)

    rt = NodeRuntime(
        base_url=base_url,
        host=host,
        port=port,
        token_path=token_path_str,
        started_at=_now(),
        pid=os.getpid(),
    )

    out = {
        "base_url": rt.base_url,
        "host": rt.host,
        "port": rt.port,
        "token_path": rt.token_path,
        "started_at": rt.started_at,
        "pid": rt.pid,
    }

    runtime_path.parent.mkdir(parents=True, exist_ok=True)
    runtime_path.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return rt
