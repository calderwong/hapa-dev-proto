import asyncio
import httpx
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_self_test():
    base_url = "http://127.0.0.1:8734"
    token_file = Path(".node_token")
    
    if not token_file.exists():
        logger.error("No .node_token found. Start the server first.")
        return False
        
    token = token_file.read_text().strip()
    headers = {"Authorization": f"Bearer {token}"}
    
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "node": "hapa-lore-node",
        "tests": []
    }
    
    async with httpx.AsyncClient(base_url=base_url, headers=headers) as client:
        # Test 1: Health
        try:
            r = await client.get("/health")
            report["tests"].append({
                "name": "Health Check",
                "ok": r.status_code == 200,
                "status_code": r.status_code
            })
        except Exception as e:
            report["tests"].append({"name": "Health Check", "ok": False, "error": str(e)})

        # Test 2: Capabilities (Authed)
        try:
            r = await client.get("/v1/capabilities")
            report["tests"].append({
                "name": "Capabilities Check",
                "ok": r.status_code == 200,
                "status_code": r.status_code,
                "caps": r.json().get("capabilities", [])
            })
        except Exception as e:
            report["tests"].append({"name": "Capabilities Check", "ok": False, "error": str(e)})

        # Test 3: Record Lore
        try:
            payload = {
                "type": "WISDOM_NUGGET",
                "title": "Self-Test Lore",
                "content": "This is a test lore entry created by the self-test harness.",
                "author": "self-test",
                "tags": ["test", "automated"]
            }
            r = await client.post("/v1/lore", json=payload)
            entry_id = r.json().get("id") if r.status_code == 200 else None
            report["tests"].append({
                "name": "Record Lore",
                "ok": r.status_code == 200,
                "id": entry_id
            })
            
            # Test 4: Retrieve and Search
            if entry_id:
                # Search
                r_search = await client.get("/v1/lore/search", params={"q": "self-test"})
                found = any(e["id"] == entry_id for e in r_search.json())
                report["tests"].append({
                    "name": "Search Lore",
                    "ok": r_search.status_code == 200 and found
                })
                
                # Get Specific
                r_get = await client.get(f"/v1/lore/{entry_id}")
                report["tests"].append({
                    "name": "Get Lore Detail",
                    "ok": r_get.status_code == 200 and r_get.json()["id"] == entry_id
                })
        except Exception as e:
            report["tests"].append({"name": "Lore Lifecycle", "ok": False, "error": str(e)})

    # Summary
    success = all(t["ok"] for t in report["tests"])
    report["ok"] = success
    
    print(json.dumps(report, indent=2))
    return success

if __name__ == "__main__":
    if asyncio.run(run_self_test()):
        sys.exit(0)
    else:
        sys.exit(1)
