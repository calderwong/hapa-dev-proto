import uvicorn
import os
from hapa_lore_node.config import load_settings

def main():
    settings = load_settings()
    host = os.environ.get("HAPA_LORE_NODE_HOST", settings.HAPA_LORE_NODE_HOST)
    port = int(os.environ.get("HAPA_LORE_NODE_PORT", settings.HAPA_LORE_NODE_PORT))
    
    # Enforce loopback unless overridden
    if not settings.HAPA_LORE_NODE_ALLOW_NON_LOOPBACK and host != "127.0.0.1":
        host = "127.0.0.1"
        
    uvicorn.run("hapa_lore_node.app:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    main()
