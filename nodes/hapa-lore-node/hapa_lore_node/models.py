from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class LoreType(str, Enum):
    DAILY_PROGRESS = "DAILY_PROGRESS"
    WISDOM_NUGGET = "WISDOM_NUGGET"
    CANON_ENTRY = "CANON_ENTRY"
    VOICE_OF_THE_PILOT = "VOICE_OF_THE_PILOT"
    AGENT_REFLECTION = "AGENT_REFLECTION"

class LoreReferences(BaseModel):
    check_ins: List[str] = Field(default_factory=list)
    repos: List[str] = Field(default_factory=list)
    hpq_ids: List[str] = Field(default_factory=list)
    files: List[str] = Field(default_factory=list)

class LoreEntry(BaseModel):
    id: str
    type: LoreType
    date_utc: datetime
    author: str
    title: str
    content: str
    tags: List[str] = Field(default_factory=list)
    references: LoreReferences = Field(default_factory=LoreReferences)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LoreCreate(BaseModel):
    type: LoreType
    title: str
    content: str
    author: str
    tags: List[str] = Field(default_factory=list)
    references: Optional[LoreReferences] = None
    date_utc: Optional[datetime] = None

class LoreSearchQuery(BaseModel):
    query: Optional[str] = None
    type: Optional[LoreType] = None
    tags: List[str] = Field(default_factory=list)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = 50
