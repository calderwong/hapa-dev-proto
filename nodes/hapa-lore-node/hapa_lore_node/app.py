import os
import logging
import yaml
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import load_settings
from .auth import TokenAuth
from .database import Database
from .models import LoreEntry, LoreCreate, LoreSearchQuery, LoreType, LoreReferences

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = load_settings()
auth = TokenAuth(token_file=settings.HAPA_LORE_NODE_TOKEN_FILE)
db = Database(db_path=settings.HAPA_LORE_NODE_DB_PATH)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.initialize()
    logger.info("Lore Node initialized")
    
    # Auto-ingest existing markdown lore files if any
    await ingest_local_lore()
    
    yield
    # Shutdown
    logger.info("Lore Node shutting down")

async def ingest_local_lore():
    """Ingest markdown files from data/lore/daily and data/lore/entries"""
    daily_dir = settings.HAPA_LORE_NODE_DATA_DIR / "daily"
    entries_dir = settings.HAPA_LORE_NODE_DATA_DIR / "entries"
    
    for directory in [daily_dir, entries_dir]:
        if not directory.exists():
            continue
            
        for file_path in directory.glob("*.md"):
            try:
                content = file_path.read_text()
                # Split YAML frontmatter
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    if len(parts) >= 3:
                        frontmatter = yaml.safe_load(parts[1])
                        # Handle case where frontmatter might be empty or not a dict
                        meta = frontmatter if isinstance(frontmatter, dict) else {}
                        
                        body = parts[2].strip()
                        title = ""
                        if body.startswith("# "):
                            lines = body.split("\n")
                            title = lines[0][2:].strip()
                            body = "\n".join(lines[1:]).strip()
                        
                        entry = LoreEntry(
                            id=meta.get("id", f"LORE-{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}-{file_path.stem}"),
                            type=LoreType(meta.get("type", LoreType.WISDOM_NUGGET)),
                            date_utc=datetime.fromisoformat(meta.get("date_utc").replace(" UTC", "")) if isinstance(meta.get("date_utc"), str) else datetime.utcnow(),
                            author=meta.get("author", "unknown"),
                            title=title or file_path.stem,
                            content=body,
                            tags=meta.get("tags", []),
                            references=LoreReferences(**meta.get("references", {})),
                            metadata={"file_source": str(file_path)}
                        )
                        db.save_entry(entry)
                        logger.info(f"Ingested lore: {entry.id}")
            except Exception as e:
                logger.error(f"Failed to ingest {file_path}: {e}")

app = FastAPI(
    title="Hapa Lore Node",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public endpoints
@app.get("/", response_class=HTMLResponse)
async def root():
    ui_path = Path(__file__).parent.parent / "web" / "index.html"
    if ui_path.exists():
        return ui_path.read_text()
    return "<h1>Hapa Lore Node</h1><p>UI not found. Check web/index.html</p>"

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "hapa-lore-node",
        "timestamp": datetime.utcnow().isoformat()
    }

# Authenticated endpoints
@app.get("/v1/capabilities", dependencies=[Depends(auth.verify_token)])
async def capabilities():
    return {
        "service": "hapa-lore-node",
        "api_version": "1.0.0",
        "capabilities": [
            "record_lore",
            "query_canon",
            "daily_progress",
            "search_wisdom"
        ],
        "storage_stats": {
            "data_dir": str(settings.HAPA_LORE_NODE_DATA_DIR),
            "db_path": str(settings.HAPA_LORE_NODE_DB_PATH)
        }
    }

@app.post("/v1/lore", response_model=LoreEntry, dependencies=[Depends(auth.verify_token)])
async def create_lore(entry_data: LoreCreate):
    entry_id = f"LORE-{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}"
    
    entry = LoreEntry(
        id=entry_id,
        type=entry_data.type,
        date_utc=entry_data.date_utc or datetime.utcnow(),
        author=entry_data.author,
        title=entry_data.title,
        content=entry_data.content,
        tags=entry_data.tags,
        references=entry_data.references or LoreReferences(),
        metadata={}
    )
    
    db.save_entry(entry)
    
    # Also save as markdown file for persistence/human readability
    sub_dir = "daily" if entry.type == LoreType.DAILY_PROGRESS else "entries"
    file_path = settings.HAPA_LORE_NODE_DATA_DIR / sub_dir / f"{entry_id}.md"
    
    frontmatter = {
        "id": entry.id,
        "type": entry.type.value,
        "date_utc": entry.date_utc.isoformat(),
        "author": entry.author,
        "tags": entry.tags,
        "references": entry.references.model_dump()
    }
    
    with open(file_path, "w") as f:
        f.write("---\n")
        yaml.dump(frontmatter, f)
        f.write("---\n\n")
        f.write(f"# {entry.title}\n\n")
        f.write(entry.content)
        
    return entry

@app.get("/v1/lore/search", response_model=List[LoreEntry], dependencies=[Depends(auth.verify_token)])
async def search_lore(
    q: Optional[str] = None,
    type: Optional[LoreType] = None,
    limit: int = 50
):
    query = LoreSearchQuery(query=q, type=type, limit=limit)
    return db.search_entries(query)

@app.get("/v1/lore/{entry_id}", response_model=LoreEntry, dependencies=[Depends(auth.verify_token)])
async def get_lore(entry_id: str):
    entry = db.get_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return entry
