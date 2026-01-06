from __future__ import annotations

import os

import uvicorn

from .config import load_settings


def main() -> int:
    settings = load_settings()
    reload_flag = bool(os.environ.get("HAPA_LUMINASTEM_NODE_RELOAD"))
    uvicorn.run(
        "hapa_luminastem_node.server:app",
        host=settings.host,
        port=settings.port,
        reload=reload_flag,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
