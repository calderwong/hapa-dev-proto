import os
import secrets
from pathlib import Path
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

class TokenAuth:
    def __init__(self, token_file: Path = Path(".node_token")):
        self.token_file = token_file
        self.security = HTTPBearer()
        self._token = self._load_or_generate_token()

    def _load_or_generate_token(self) -> str:
        # Priority: Env > File > Generate
        token = os.environ.get("HAPA_LORE_NODE_TOKEN")
        if token:
            return token

        if self.token_file.exists():
            return self.token_file.read_text().strip()

        # Generate new token
        token = secrets.token_hex(32)
        self.token_file.write_text(token)
        # Set permissions to 600 (owner read/write)
        os.chmod(self.token_file, 0o600)
        return token

    async def verify_token(self, auth: HTTPAuthorizationCredentials = Security(HTTPBearer())):
        if auth.credentials != self._token:
            raise HTTPException(
                status_code=401,
                detail="Invalid or missing token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return auth.credentials

    @property
    def token(self) -> str:
        return self._token
