from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .auth import env_truthy


def _default_token_file() -> Path:
    return (Path(__file__).resolve().parent.parent / ".node_token").resolve()


def _is_loopback_host(host: str) -> bool:
    host = str(host or "").strip().lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    if host.startswith("127."):
        return True
    return False


def _read_text_file(path: Path) -> Optional[str]:
    try:
        text = path.read_text(encoding="utf-8").strip()
        return text or None
    except Exception:
        return None


@dataclass(frozen=True)
class Settings:
    api_version: str
    service_name: str
    host: str
    port: int
    token: str
    token_is_generated: bool
    token_file: Path
    allow_query_token: bool
    gemini_api_key: str


def load_settings() -> Settings:
    host = str(os.environ.get("HAPA_LUMINASTEM_NODE_HOST", "127.0.0.1") or "").strip() or "127.0.0.1"
    allow_non_loopback = env_truthy(os.environ.get("HAPA_LUMINASTEM_NODE_ALLOW_NON_LOOPBACK")) or env_truthy(
        os.environ.get("HAPA_LUMINASTEM_ALLOW_NON_LOOPBACK")
    )
    if not allow_non_loopback and not _is_loopback_host(host):
        host = "127.0.0.1"
    port = int(os.environ.get("HAPA_LUMINASTEM_NODE_PORT", "8732"))

    default_token_file = _default_token_file()
    token_file = Path(os.environ.get("HAPA_LUMINASTEM_NODE_TOKEN_FILE", str(default_token_file))).expanduser()
    if token_file.is_absolute():
        token_file = token_file.resolve()
    else:
        token_file = (Path.cwd() / token_file).resolve()

    token = os.environ.get("HAPA_LUMINASTEM_NODE_TOKEN")
    token_is_generated = False
    if not token:
        file_tok = _read_text_file(token_file)
        if file_tok:
            token = file_tok

    if not token:
        token = secrets.token_hex(16)
        token_is_generated = True

    allow_query_token = env_truthy(os.environ.get("HAPA_LUMINASTEM_NODE_ALLOW_QUERY_TOKEN")) or env_truthy(
        os.environ.get("HAPA_LUMINASTEM_ALLOW_QUERY_TOKEN")
    )

    gemini_api_key = (
        os.environ.get("HAPA_LUMINASTEM_GEMINI_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or ""
    )

    return Settings(
        api_version="v1",
        service_name="hapa-luminastem-node",
        host=host,
        port=port,
        token=token,
        token_is_generated=token_is_generated,
        token_file=token_file,
        allow_query_token=allow_query_token,
        gemini_api_key=gemini_api_key,
    )
