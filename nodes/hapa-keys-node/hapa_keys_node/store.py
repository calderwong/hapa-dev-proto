from __future__ import annotations

import datetime
import os
import sqlite3
from pathlib import Path
from typing import Optional


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class KeyStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS keys (service TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
            )
            conn.commit()
        try:
            os.chmod(self.db_path, 0o600)
        except Exception:
            pass

    def count(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM keys").fetchone()
        return int(row["n"]) if row else 0

    def list(self) -> list[dict[str, str]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT service, created_at, updated_at FROM keys ORDER BY service").fetchall()
        return [dict(r) for r in rows]

    def get(self, service: str) -> Optional[dict[str, str]]:
        service = str(service or "").strip().lower()
        if not service:
            return None
        with self._connect() as conn:
            row = conn.execute(
                "SELECT service, value, created_at, updated_at FROM keys WHERE service = ?",
                (service,),
            ).fetchone()
        return dict(row) if row else None

    def get_value(self, service: str) -> Optional[str]:
        rec = self.get(service)
        if not rec:
            return None
        value = rec.get("value")
        return str(value) if value is not None else None

    def upsert(self, service: str, value: str) -> dict[str, str]:
        service = str(service or "").strip().lower()
        value = str(value or "").strip()
        if not service:
            raise ValueError("Missing service")
        if not value:
            raise ValueError("Missing value")

        now = _utc_now_iso()
        with self._connect() as conn:
            existing = conn.execute("SELECT service FROM keys WHERE service = ?", (service,)).fetchone()
            if existing:
                conn.execute("UPDATE keys SET value = ?, updated_at = ? WHERE service = ?", (value, now, service))
            else:
                conn.execute(
                    "INSERT INTO keys (service, value, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (service, value, now, now),
                )
            conn.commit()

        rec = self.get(service)
        if not rec:
            raise RuntimeError("Failed to save key")

        return {"service": rec["service"], "created_at": rec["created_at"], "updated_at": rec["updated_at"]}

    def delete(self, service: str) -> bool:
        service = str(service or "").strip().lower()
        if not service:
            return False
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM keys WHERE service = ?", (service,))
            conn.commit()
            return bool(cur.rowcount)
