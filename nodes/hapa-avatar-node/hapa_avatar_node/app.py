from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Any, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from . import __version__
from .auth import env_truthy, verify_request_token
from .config import Settings, load_settings, repo_root, token_file_path
from .lineage import run_lineage
from .runtime import write_runtime
from .zimage_client import ZImageClient

_SETTINGS: Optional[Settings] = None


def get_settings() -> Settings:
    global _SETTINGS
    if _SETTINGS is None:
        _SETTINGS = load_settings()
    return _SETTINGS


def _allow_query_token() -> bool:
    return env_truthy(
        os.environ.get("HAPA_AVATAR_ALLOW_QUERY_TOKEN")
        or os.environ.get("HAPA_AVATAR_NODE_ALLOW_QUERY_TOKEN")
    )


def require_auth(request: Request, settings: Settings = Depends(get_settings)) -> None:
    verify_request_token(request, settings.token, allow_query_token=_allow_query_token())


class ExpandAvatarRequest(BaseModel):
    avatar_name: str = Field(min_length=1)

    base_prompt: Optional[str] = None
    base_image_asset_id: Optional[str] = None
    base_image_base64: Optional[str] = None

    model: str = "z-image-turbo"
    negative_prompt: Optional[str] = None
    steps: Optional[int] = None
    seed: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    quantize: Optional[int] = None
    guidance: Optional[float] = None
    low_ram: bool = False
    image_strength: Optional[float] = 0.55

    variants: Optional[list[str]] = None
    poses: Optional[list[str]] = None

    timeout_seconds: float = 3600.0
    poll_interval_seconds: float = 1.0

    async_mode: bool = False


class ExpandAvatarResponse(BaseModel):
    ok: bool
    job_id: Optional[str] = None
    status: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None


_JOBS_LOCK = Lock()
_JOBS: dict[str, dict[str, Any]] = {}


def _set_job(job_id: str, data: dict[str, Any]) -> None:
    with _JOBS_LOCK:
        _JOBS[job_id] = dict(data)


def _get_job(job_id: str) -> Optional[dict[str, Any]]:
    with _JOBS_LOCK:
        v = _JOBS.get(job_id)
        return dict(v) if isinstance(v, dict) else None


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    root = repo_root()
    write_runtime(
        repo_root=root,
        runtime_path=settings.runtime_path,
        host=settings.host,
        port=settings.port,
        token_path=token_file_path(root),
    )
    yield


app = FastAPI(title="hapa-avatar-node", version=__version__, lifespan=lifespan)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs", status_code=307)


@app.get("/health")
def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "ok": True,
        "service": settings.service_name,
        "version": __version__,
        "host": settings.host,
        "port": settings.port,
        "upstream_base_url": settings.upstream_base_url,
    }


@app.get("/capabilities", dependencies=[Depends(require_auth)])
def capabilities() -> dict[str, Any]:
    settings = get_settings()
    out: dict[str, Any] = {
        "ok": True,
        "service": settings.service_name,
        "version": __version__,
        "endpoints": {
            "expand": "POST /v1/expand/avatar",
            "status": "GET /v1/status/{job_id}",
            "preview": "GET /v1/preview/{avatar_name}",
            "export": "POST /v1/export/{avatar_name}",
        },
        "upstream": {
            "base_url": settings.upstream_base_url,
            "capabilities": None,
            "error": None,
        },
    }

    try:
        client = ZImageClient(base_url=settings.upstream_base_url, token=settings.upstream_token)
        out["upstream"]["capabilities"] = client.capabilities()
    except Exception as exc:
        out["upstream"]["error"] = str(exc)

    return out


@app.post("/expand/avatar", dependencies=[Depends(require_auth)], response_model=ExpandAvatarResponse)
@app.post("/v1/expand/avatar", dependencies=[Depends(require_auth)], response_model=ExpandAvatarResponse)
def expand_avatar(body: ExpandAvatarRequest, bg: BackgroundTasks) -> ExpandAvatarResponse:
    settings = get_settings()

    def _run() -> dict[str, Any]:
        return run_lineage(
            settings,
            avatar_name=body.avatar_name,
            base_prompt=body.base_prompt,
            base_image_asset_id=body.base_image_asset_id,
            base_image_base64=body.base_image_base64,
            model=body.model,
            negative_prompt=body.negative_prompt,
            steps=body.steps,
            seed=body.seed,
            width=body.width,
            height=body.height,
            quantize=body.quantize,
            guidance=body.guidance,
            low_ram=body.low_ram,
            image_strength=body.image_strength,
            variants=body.variants,
            poses=body.poses,
            timeout_seconds=body.timeout_seconds,
            poll_interval_seconds=body.poll_interval_seconds,
        )

    if not body.async_mode:
        try:
            result = _run()
            return ExpandAvatarResponse(ok=True, status="succeeded", result=result)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    job_id = uuid.uuid4().hex
    _set_job(job_id, {"ok": True, "job_id": job_id, "status": "running"})

    def _bg_run() -> None:
        try:
            result = _run()
            _set_job(job_id, {"ok": True, "job_id": job_id, "status": "succeeded", "result": result})
        except Exception as exc:
            _set_job(job_id, {"ok": False, "job_id": job_id, "status": "failed", "error": str(exc)})

    bg.add_task(_bg_run)

    return ExpandAvatarResponse(ok=True, job_id=job_id, status="running")


@app.get("/status/{job_id}", dependencies=[Depends(require_auth)])
@app.get("/v1/status/{job_id}", dependencies=[Depends(require_auth)])
def status(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job_id")
    return job


@app.get("/preview/{avatar_name}", dependencies=[Depends(require_auth)])
@app.get("/v1/preview/{avatar_name}", dependencies=[Depends(require_auth)])
def preview(avatar_name: str) -> dict[str, Any]:
    settings = get_settings()
    out_dir = (settings.avatars_root / str(avatar_name).strip()).resolve()
    lineage_path = (out_dir / "lineage.json").resolve()
    card_yaml_path = (out_dir / "index.card.yaml").resolve()

    if not lineage_path.exists():
        raise HTTPException(status_code=404, detail="Missing lineage.json")

    lineage = load_doc(lineage_path)
    cards = load_doc(card_yaml_path) if card_yaml_path.exists() else None

    return {
        "ok": True,
        "avatar_name": str(avatar_name).strip(),
        "output_dir": str(out_dir.relative_to(settings.repo_root))
        if str(out_dir).startswith(str(settings.repo_root))
        else str(out_dir),
        "lineage": lineage,
        "card_bundle": cards,
    }


@app.post("/export/{avatar_name}", dependencies=[Depends(require_auth)])
@app.post("/v1/export/{avatar_name}", dependencies=[Depends(require_auth)])
def export(avatar_name: str) -> dict[str, Any]:
    return preview(avatar_name)


def load_doc(path: Any) -> Any:
    p = Path(str(path))
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        raise HTTPException(status_code=500, detail=f"Failed to read {p.name}")

    try:
        return json.loads(text)
    except Exception:
        pass

    try:
        import yaml
    except Exception:
        raise HTTPException(status_code=500, detail=f"Failed to parse {p.name}")

    try:
        return yaml.safe_load(text)
    except Exception:
        raise HTTPException(status_code=500, detail=f"Failed to parse {p.name}")
