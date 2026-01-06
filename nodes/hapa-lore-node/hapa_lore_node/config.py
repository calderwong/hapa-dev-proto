import os
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # API Settings
    HAPA_LORE_NODE_HOST: str = "127.0.0.1"
    HAPA_LORE_NODE_PORT: int = 8734
    HAPA_LORE_NODE_ALLOW_NON_LOOPBACK: bool = False
    
    # Auth Settings
    HAPA_LORE_NODE_TOKEN: str = os.environ.get("HAPA_LORE_NODE_TOKEN", "")
    HAPA_LORE_NODE_TOKEN_FILE: Path = Path(".node_token")
    
    # Storage Settings
    HAPA_LORE_NODE_DATA_DIR: Path = Path("./data/lore")
    HAPA_LORE_NODE_DB_PATH: Path = Path("./data/lore/lore.db")
    
    # Overwatch Settings
    HAPA_OVERWATCH_ROOT: Path = Path(os.environ.get("HAPA_OVERWATCH_ROOT", "/Users/calderwong/Desktop/.Overwatch"))

    class Config:
        env_prefix = "HAPA_LORE_"

def load_settings():
    return Settings()
