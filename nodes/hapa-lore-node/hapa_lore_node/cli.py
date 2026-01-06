import os
import sys
import json
import argparse
import httpx
from pathlib import Path
from typing import Optional

def get_token():
    # Priority: ENV > .node_token
    token = os.environ.get("HAPA_LORE_NODE_TOKEN")
    if token:
        return token
    
    token_file = Path(".node_token")
    if token_file.exists():
        return token_file.read_text().strip()
    return None

def get_base_url():
    return os.environ.get("HAPA_LORE_NODE_URL", "http://127.0.0.1:8734")

def main():
    parser = argparse.ArgumentParser(description="Hapa Lore Node CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Record command
    record_parser = subparsers.add_parser("record", help="Record a new lore entry")
    record_parser.add_argument("--type", required=True, choices=["DAILY_PROGRESS", "WISDOM_NUGGET", "CANON_ENTRY", "VOICE_OF_THE_PILOT", "AGENT_REFLECTION"])
    record_parser.add_argument("--title", required=True)
    record_parser.add_argument("--content", required=True)
    record_parser.add_argument("--author", default=os.environ.get("AGENT_NAME", "human"))
    record_parser.add_argument("--tags", help="Comma-separated tags")

    # Query command
    query_parser = subparsers.add_parser("query", help="Query lore entries")
    query_parser.add_argument("query", nargs="?", help="Search query")
    query_parser.add_argument("--type", choices=["DAILY_PROGRESS", "WISDOM_NUGGET", "CANON_ENTRY", "VOICE_OF_THE_PILOT", "AGENT_REFLECTION"])
    query_parser.add_argument("--limit", type=int, default=10)

    # Health command
    subparsers.add_parser("health", help="Check node health")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    base_url = get_base_url()
    token = get_token()

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    with httpx.Client(base_url=base_url, headers=headers) as client:
        try:
            if args.command == "health":
                r = client.get("/health")
                print(json.dumps(r.json(), indent=2))
            
            elif args.command == "record":
                payload = {
                    "type": args.type,
                    "title": args.title,
                    "content": args.content,
                    "author": args.author,
                    "tags": args.tags.split(",") if args.tags else []
                }
                r = client.post("/v1/lore", json=payload)
                if r.status_code == 200:
                    print(f"Successfully recorded lore: {r.json()['id']}")
                else:
                    print(f"Error: {r.status_code} - {r.text}")

            elif args.command == "query":
                params = {"limit": args.limit}
                if args.query:
                    params["q"] = args.query
                if args.type:
                    params["type"] = args.type
                
                r = client.get("/v1/lore/search", params=params)
                if r.status_code == 200:
                    entries = r.json()
                    for e in entries:
                        print(f"[{e['type']}] {e['id']} - {e['title']} ({e['date_utc']})")
                        print("-" * 40)
                        # Truncate content for preview
                        content = e['content'][:200] + "..." if len(e['content']) > 200 else e['content']
                        print(content)
                        print("\n")
                else:
                    print(f"Error: {r.status_code} - {r.text}")

        except Exception as e:
            print(f"Connection error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
