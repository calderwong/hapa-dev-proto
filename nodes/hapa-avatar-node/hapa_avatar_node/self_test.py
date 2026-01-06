from __future__ import annotations

import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import Settings
from .lineage import run_lineage


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_self_test(
    settings: Settings,
    *,
    full: bool = False,
    avatar_name: Optional[str] = None,
    base_prompt: Optional[str] = None,
    model: str = "z-image-turbo",
    steps: int = 2,
    width: int = 512,
    height: int = 512,
    timeout_seconds: float = 1200.0,
    poll_interval_seconds: float = 1.0,
) -> dict[str, Any]:
    run_id = secrets.token_hex(4)
    started_at = _utc_now_iso()

    name = str(avatar_name or "").strip() or f"selftest_{run_id}"
    prompt = str(base_prompt or "").strip() or (
        "avatar portrait, full body, clean background, ultra-detailed, cinematic lighting"
    )

    variants: Optional[list[str]]
    poses: Optional[list[str]]

    if full:
        variants = None
        poses = None
    else:
        variants = [
            "fire-element warrior, ember aura, molten sigils",
            "techwear rogue, neon seams, tactical straps",
        ]
        poses = [
            "standing proud, full body",
            "casting a spell, hands glowing",
        ]

    ok = False
    error: Optional[str] = None
    result: Optional[dict[str, Any]] = None

    t0 = time.perf_counter()
    try:
        result = run_lineage(
            settings,
            avatar_name=name,
            base_prompt=prompt,
            model=model,
            steps=int(steps),
            width=int(width),
            height=int(height),
            variants=variants,
            poses=poses,
            timeout_seconds=float(timeout_seconds),
            poll_interval_seconds=float(poll_interval_seconds),
        )
        ok = True
    except Exception as exc:
        ok = False
        error = str(exc)

    duration_seconds = time.perf_counter() - t0

    report: dict[str, Any] = {
        "api_version": "v1",
        "time": started_at,
        "ok": bool(ok),
        "run_id": run_id,
        "avatar_name": name,
        "upstream_base_url": settings.upstream_base_url,
        "model": str(model),
        "full": bool(full),
        "duration_seconds": float(duration_seconds),
        "result": result,
        "error": error,
    }

    report_dir = (settings.artifacts_root / "self_test").resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = (report_dir / f"avatar_self_test_{run_id}.json").resolve()
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    report["report_path"] = str(report_path.relative_to(settings.repo_root))

    return report
