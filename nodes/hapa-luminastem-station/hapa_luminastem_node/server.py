from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from .auth import verify_request_token
from .config import Settings, load_settings

load_dotenv()

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_auth(request: Request) -> None:
    settings: Settings = request.app.state.settings
    verify_request_token(request, settings.token, allow_query_token=settings.allow_query_token)


class GeminiGenerateContentRequest(BaseModel):
    model: str
    contents: Any
    config: Optional[dict[str, Any]] = None

    model_config = ConfigDict(extra="allow")


def _normalize_contents(contents: Any) -> list[dict[str, Any]]:
    if isinstance(contents, str):
        return [{"parts": [{"text": contents}]}]

    if isinstance(contents, dict):
        return [contents]

    if isinstance(contents, list):
        return contents

    raise HTTPException(status_code=400, detail="Invalid contents type")


def _system_instruction_to_content(system_instruction: Any) -> dict[str, Any]:
    if isinstance(system_instruction, str):
        return {"parts": [{"text": system_instruction}]}

    if isinstance(system_instruction, dict):
        return system_instruction

    raise HTTPException(status_code=400, detail="Invalid systemInstruction type")


def _extract_text(data: Any) -> str:
    if not isinstance(data, dict):
        return ""

    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""

    cand0 = candidates[0]
    if not isinstance(cand0, dict):
        return ""

    content = cand0.get("content")
    if not isinstance(content, dict):
        return ""

    parts = content.get("parts")
    if not isinstance(parts, list):
        return ""

    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            texts.append(part["text"])

    return "".join(texts)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    settings = load_settings()
    app.state.settings = settings
    app.state.http = httpx.AsyncClient(timeout=60.0)

    if settings.token_is_generated:
        try:
            settings.token_file.parent.mkdir(parents=True, exist_ok=True)
            settings.token_file.write_text(settings.token, encoding="utf-8")
        except Exception as exc:
            print(f"[hapa-luminastem-node] Failed to write token file: {exc}")

    base_url = f"http://{settings.host}:{settings.port}"
    print(f"[hapa-luminastem-node] baseUrl={base_url}")
    print(f"[hapa-luminastem-node] token_file={settings.token_file}")
    print(f"[hapa-luminastem-node] token={settings.token}")

    yield

    client = getattr(app.state, "http", None)
    if client:
        await client.aclose()


app = FastAPI(title="Hapa LuminaStem Node", lifespan=_lifespan)


@app.get("/health")
async def get_health(request: Request):
    settings: Settings = request.app.state.settings
    return {
        "ok": True,
        "service": settings.service_name,
        "api_version": settings.api_version,
        "time": utc_now_iso(),
        "gemini_configured": bool(settings.gemini_api_key),
    }


@app.get("/capabilities", dependencies=[Depends(_require_auth)])
async def get_capabilities(request: Request):
    settings: Settings = request.app.state.settings
    return {
        "api_version": settings.api_version,
        "time": utc_now_iso(),
        "service": settings.service_name,
        "modalities": {
            "text": {
                "engines": ["gemini"],
                "features": ["generateContent"],
            }
        },
        "auth": {"query_token": bool(settings.allow_query_token)},
    }


@app.post("/v1/gemini/generateContent", dependencies=[Depends(_require_auth)])
async def gemini_generate_content(body: GeminiGenerateContentRequest, request: Request):
    settings: Settings = request.app.state.settings

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing GEMINI_API_KEY (set GEMINI_API_KEY or HAPA_LUMINASTEM_GEMINI_API_KEY)",
        )

    contents = _normalize_contents(body.contents)
    cfg = dict(body.config or {})

    system_instruction = cfg.pop("systemInstruction", None)

    req_body: dict[str, Any] = {"contents": contents}
    if system_instruction is not None:
        req_body["systemInstruction"] = _system_instruction_to_content(system_instruction)

    if cfg:
        req_body["generationConfig"] = cfg

    upstream_url = f"{GEMINI_BASE_URL}/models/{body.model}:generateContent"

    client: httpx.AsyncClient = request.app.state.http
    try:
        res = await client.post(
            upstream_url,
            params={"key": settings.gemini_api_key},
            json=req_body,
            headers={"Content-Type": "application/json"},
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc.__class__.__name__}")

    if res.status_code >= 400:
        text = res.text
        if len(text) > 2000:
            text = text[:2000]
        raise HTTPException(status_code=502, detail={"upstream_status": res.status_code, "body": text})

    data = res.json()
    return {"text": _extract_text(data), "raw": data}
