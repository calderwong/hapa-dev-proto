from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class Settings:
    api_version: str
    service_name: str
    host: str
    port: int
    token: str
    token_is_generated: bool
    repo_root: Path
    avatars_root: Path
    artifacts_root: Path
    runtime_path: Path
    upstream_base_url: str
    upstream_token: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def token_file_path(root: Optional[Path] = None) -> Path:
    r = root or repo_root()
    return r / ".node_token"


def runtime_file_path(root: Optional[Path] = None) -> Path:
    r = root or repo_root()
    return r / "artifacts" / "runtime" / "hapa_avatar_node_runtime.json"


def _read_text_if_exists(path: Path) -> Optional[str]:
    try:
        if path.exists():
            return path.read_text(encoding="utf-8").strip() or None
    except Exception:
        return None
    return None


def resolve_token(root: Path, token: Optional[str] = None) -> tuple[str, bool]:
    tok = (token or "").strip()

    if not tok:
        env_tok = os.environ.get("HAPA_AVATAR_NODE_TOKEN")
        if env_tok:
            tok = env_tok.strip()

    if not tok:
        tok = _read_text_if_exists(token_file_path(root)) or ""

    generated = False
    if not tok:
        tok = secrets.token_hex(16)
        generated = True

    token_file_path(root).write_text(tok + "\n", encoding="utf-8")
    return tok, generated


def resolve_upstream_base_url() -> str:
    raw = (
        os.environ.get("HAPA_AVATAR_UPSTREAM_BASE_URL")
        or os.environ.get("HAPA_MEDIA_HUB_BASE_URL")
        or os.environ.get("HAPA_MEDIA_NODE_BASE_URL")
        or os.environ.get("HAPA_MEDIA_BASE_URL")
        or "http://127.0.0.1:8726"
    )
    return str(raw).strip().rstrip("/")


def resolve_upstream_token(token: Optional[str] = None, *, allow_missing: bool = False) -> str:
    tok = (token or "").strip()

    if not tok:
        env_tok = os.environ.get("HAPA_AVATAR_UPSTREAM_TOKEN")
        if env_tok:
            tok = env_tok.strip()

    if not tok:
        tok = str(os.environ.get("HAPA_MEDIA_HUB_TOKEN") or "").strip()

    if not tok:
        tok = str(os.environ.get("HAPA_MEDIA_NODE_TOKEN") or "").strip()

    if not tok:
        if allow_missing:
            return ""
        raise RuntimeError(
            "Missing upstream token (set HAPA_AVATAR_UPSTREAM_TOKEN or HAPA_MEDIA_HUB_TOKEN/HAPA_MEDIA_NODE_TOKEN)"
        )

    return tok


def load_settings() -> Settings:
    root = repo_root()

    host = os.environ.get("HAPA_AVATAR_NODE_HOST", "127.0.0.1")
    port = int(os.environ.get("HAPA_AVATAR_NODE_PORT", "8732"))

    token, token_is_generated = resolve_token(root)

    avatars_root = (root / "media" / "avatars").resolve()
    artifacts_root = (root / "artifacts").resolve()

    upstream_base_url = resolve_upstream_base_url()
    upstream_token = resolve_upstream_token(allow_missing=True)

    return Settings(
        api_version="v1",
        service_name="hapa-avatar-node",
        host=host,
        port=port,
        token=token,
        token_is_generated=token_is_generated,
        repo_root=root,
        avatars_root=avatars_root,
        artifacts_root=artifacts_root,
        runtime_path=runtime_file_path(root),
        upstream_base_url=upstream_base_url,
        upstream_token=upstream_token,
    )
