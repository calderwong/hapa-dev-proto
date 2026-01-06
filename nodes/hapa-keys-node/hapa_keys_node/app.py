from __future__ import annotations

import datetime
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .auth import verify_request_token
from .config import Settings, load_settings
from .store import KeyStore


KNOWN_SERVICES = [
    "gemini",
    "openai",
    "aimlapi",
    "firebase",
    "revid",
]

ENV_FALLBACKS: dict[str, list[str]] = {
    "gemini": [
        "HAPA_KEYS_NODE_GEMINI_API_KEY",
        "HAPA_KEYS_GEMINI_API_KEY",
        "HAPA_LUMINASTEM_GEMINI_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "API_KEY",
    ],
    "openai": [
        "HAPA_KEYS_NODE_OPENAI_API_KEY",
        "OPENAI_API_KEY",
    ],
    "aimlapi": [
        "HAPA_KEYS_NODE_AIMLAPI_API_KEY",
        "AIMLAPI_API_KEY",
        "AIMLAPI_KEY",
    ],
    "firebase": [
        "HAPA_KEYS_NODE_FIREBASE_API_KEY",
        "FIREBASE_API_KEY",
        "FIREBASE_WEB_API_KEY",
    ],
    "revid": [
        "HAPA_KEYS_NODE_REVID_API_KEY",
        "REVID_API_KEY",
    ],
}


class PutKeyRequest(BaseModel):
    value: str


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _resolve_from_env(service: str) -> tuple[Optional[str], Optional[str]]:
    service = str(service or "").strip().lower()
    for name in ENV_FALLBACKS.get(service, []):
        value = str(os.environ.get(name) or "").strip()
        if value:
            return value, name
    return None, None


def _key_info(service: str, *, store: KeyStore) -> dict[str, Any]:
    service = str(service or "").strip().lower()
    stored = store.get(service)
    if stored:
        return {
            "service": service,
            "configured": True,
            "source": "stored",
            "created_at": stored.get("created_at"),
            "updated_at": stored.get("updated_at"),
        }

    env_val, env_name = _resolve_from_env(service)
    if env_val:
        return {
            "service": service,
            "configured": True,
            "source": f"env:{env_name}",
            "created_at": None,
            "updated_at": None,
        }

    return {
        "service": service,
        "configured": False,
        "source": "missing",
        "created_at": None,
        "updated_at": None,
    }


def _key_value(service: str, *, store: KeyStore) -> tuple[Optional[str], Optional[str]]:
    service = str(service or "").strip().lower()
    stored = store.get(service)
    if stored:
        return str(stored.get("value") or ""), "stored"

    env_val, env_name = _resolve_from_env(service)
    if env_val:
        return env_val, f"env:{env_name}"

    return None, None


def create_app() -> FastAPI:
    load_dotenv(override=False)

    @asynccontextmanager
    async def _lifespan(app: FastAPI):
        settings = load_settings()
        app.state.settings = settings
        store = KeyStore(settings.db_path)
        app.state.store = store

        if settings.token_is_generated:
            try:
                settings.token_file.parent.mkdir(parents=True, exist_ok=True)
                settings.token_file.write_text(settings.token, encoding="utf-8")
            except Exception:
                pass

        yield

    app = FastAPI(lifespan=_lifespan)

    def _require_auth(request: Request) -> None:
        settings: Settings = request.app.state.settings
        verify_request_token(request, settings.token, allow_query_token=settings.allow_query_token)

    @app.get("/", response_class=HTMLResponse)
    def get_index() -> HTMLResponse:
        ui_path = Path(__file__).parent.parent / "web" / "index.html"
        if ui_path.exists():
            return HTMLResponse(ui_path.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>Hapa Keys Node</h1>")

    @app.get("/health")
    def get_health(request: Request) -> dict[str, Any]:
        settings: Settings = request.app.state.settings
        store: KeyStore = request.app.state.store
        env_configured = 0
        for svc in KNOWN_SERVICES:
            v, _name = _resolve_from_env(svc)
            if v:
                env_configured += 1
        return {
            "ok": True,
            "service": settings.service_name,
            "api_version": settings.api_version,
            "time": _utc_now_iso(),
            "keys_stored": store.count(),
            "keys_env_configured": env_configured,
        }

    @app.get("/capabilities", dependencies=[Depends(_require_auth)])
    def get_capabilities(request: Request) -> dict[str, Any]:
        settings: Settings = request.app.state.settings
        return {
            "service": settings.service_name,
            "api_version": settings.api_version,
            "time": _utc_now_iso(),
            "features": {
                "known_services": KNOWN_SERVICES,
                "env_fallbacks": True,
            },
        }

    @app.get("/v1/keys", dependencies=[Depends(_require_auth)])
    def list_keys(request: Request) -> dict[str, Any]:
        store: KeyStore = request.app.state.store
        stored = store.list()
        stored_services = {str(r.get("service") or "").strip().lower() for r in stored}

        items: list[dict[str, Any]] = []
        for r in stored:
            svc = str(r.get("service") or "").strip().lower()
            if not svc:
                continue
            items.append(
                {
                    "service": svc,
                    "configured": True,
                    "source": "stored",
                    "created_at": r.get("created_at"),
                    "updated_at": r.get("updated_at"),
                }
            )

        for svc in KNOWN_SERVICES:
            if svc in stored_services:
                continue
            items.append(_key_info(svc, store=store))

        items.sort(key=lambda x: str(x.get("service") or ""))
        return {"items": items}

    @app.get("/v1/keys/{service}", dependencies=[Depends(_require_auth)])
    def get_key(service: str, request: Request) -> dict[str, Any]:
        store: KeyStore = request.app.state.store
        service = str(service or "").strip().lower()
        if not service:
            raise HTTPException(status_code=400, detail="Missing service")

        if service not in KNOWN_SERVICES and service not in {r.get("service") for r in store.list()}:
            env_val, _env_name = _resolve_from_env(service)
            if not env_val:
                raise HTTPException(status_code=404, detail="Not found")

        return _key_info(service, store=store)

    @app.get("/v1/keys/{service}/value", dependencies=[Depends(_require_auth)])
    def get_key_value(service: str, request: Request) -> dict[str, Any]:
        store: KeyStore = request.app.state.store
        value, source = _key_value(service, store=store)
        if not value or not source:
            raise HTTPException(status_code=404, detail="Not found")
        return {"service": str(service or "").strip().lower(), "value": value, "source": source}

    @app.put("/v1/keys/{service}", dependencies=[Depends(_require_auth)])
    def put_key(service: str, payload: PutKeyRequest, request: Request) -> dict[str, Any]:
        store: KeyStore = request.app.state.store
        service = str(service or "").strip().lower()
        if not service:
            raise HTTPException(status_code=400, detail="Missing service")

        value = str(payload.value or "").strip()
        if not value:
            raise HTTPException(status_code=400, detail="Missing value")

        try:
            store.upsert(service, value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        return _key_info(service, store=store)

    @app.delete("/v1/keys/{service}", dependencies=[Depends(_require_auth)])
    def delete_key(service: str, request: Request) -> dict[str, Any]:
        store: KeyStore = request.app.state.store
        service = str(service or "").strip().lower()
        if not service:
            raise HTTPException(status_code=400, detail="Missing service")

        deleted = store.delete(service)
        return {"service": service, "deleted": bool(deleted)}

    return app


app = create_app()
