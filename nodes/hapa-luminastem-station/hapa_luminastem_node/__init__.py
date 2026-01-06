from __future__ import annotations

from typing import Any

__all__ = ["app"]

def __getattr__(name: str) -> Any:
    if name == "app":
        from .server import app as _app

        return _app
    raise AttributeError(name)
