import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from .models import LoreEntry, LoreType, LoreReferences, LoreSearchQuery

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._ensure_dir()

    def _ensure_dir(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def initialize(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS lore_entries (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    date_utc TEXT NOT NULL,
                    author TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT,
                    references_json TEXT,
                    metadata_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_lore_type ON lore_entries(type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_lore_date ON lore_entries(date_utc)")
            # FTS5 table for search if supported, otherwise simple LIKE
            try:
                conn.execute("""
                    CREATE VIRTUAL TABLE IF NOT EXISTS lore_search USING fts5(
                        id UNINDEXED,
                        title,
                        content,
                        tags,
                        tokenize='porter unicode61'
                    )
                """)
            except sqlite3.OperationalError:
                logger.warning("FTS5 not supported, full-text search will be slower")

    def save_entry(self, entry: LoreEntry):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO lore_entries 
                (id, type, date_utc, author, title, content, tags, references_json, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                entry.id,
                entry.type.value,
                entry.date_utc.isoformat(),
                entry.author,
                entry.title,
                entry.content,
                ",".join(entry.tags),
                entry.references.model_dump_json(),
                json.dumps(entry.metadata)
            ))
            
            # Update FTS index if it exists
            try:
                conn.execute("DELETE FROM lore_search WHERE id = ?", (entry.id,))
                conn.execute("""
                    INSERT INTO lore_search (id, title, content, tags)
                    VALUES (?, ?, ?, ?)
                """, (entry.id, entry.title, entry.content, ",".join(entry.tags)))
            except sqlite3.OperationalError:
                pass

    def get_entry(self, entry_id: str) -> Optional[LoreEntry]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM lore_entries WHERE id = ?", (entry_id,)).fetchone()
            if row:
                return self._row_to_entry(row)
        return None

    def search_entries(self, query: LoreSearchQuery) -> List[LoreEntry]:
        sql = "SELECT * FROM lore_entries WHERE 1=1"
        params = []

        if query.type:
            sql += " AND type = ?"
            params.append(query.type.value)

        if query.start_date:
            sql += " AND date_utc >= ?"
            params.append(query.start_date.isoformat())

        if query.end_date:
            sql += " AND date_utc <= ?"
            params.append(query.end_date.isoformat())

        if query.query:
            # Try FTS first
            try:
                # Wrap search term in quotes for FTS5 to handle special characters
                safe_query = '"' + query.query.replace('"', '""') + '"'
                sql = """
                    SELECT e.* FROM lore_entries e
                    JOIN lore_search s ON e.id = s.id
                    WHERE lore_search MATCH ?
                """
                params = [safe_query]
                # Re-add filters if they were set
                if query.type:
                    sql += " AND e.type = ?"
                    params.append(query.type.value)
            except sqlite3.OperationalError as e:
                logger.warning(f"FTS5 search failed, falling back to LIKE: {e}")
                sql = "SELECT * FROM lore_entries WHERE (title LIKE ? OR content LIKE ?)"
                params = [f"%{query.query}%", f"%{query.query}%"]
                if query.type:
                    sql += " AND type = ?"
                    params.append(query.type.value)
        else:
            # No query string, but might have other filters
            pass

        # Apply date filters if not using FTS fallback logic
        if not query.query:
            if query.start_date:
                sql += " AND date_utc >= ?"
                params.append(query.start_date.isoformat())
            if query.end_date:
                sql += " AND date_utc <= ?"
                params.append(query.end_date.isoformat())

        sql += " ORDER BY date_utc DESC LIMIT ?"
        params.append(query.limit)

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql, params).fetchall()
            return [self._row_to_entry(row) for row in rows]

    def _row_to_entry(self, row: sqlite3.Row) -> LoreEntry:
        return LoreEntry(
            id=row["id"],
            type=LoreType(row["type"]),
            date_utc=datetime.fromisoformat(row["date_utc"]),
            author=row["author"],
            title=row["title"],
            content=row["content"],
            tags=row["tags"].split(",") if row["tags"] else [],
            references=LoreReferences.model_validate_json(row["references_json"]),
            metadata=json.loads(row["metadata_json"])
        )
