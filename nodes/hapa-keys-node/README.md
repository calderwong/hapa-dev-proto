# Hapa Keys Node

Local, loopback-by-default key management service for the Hapa node ecosystem.

- Public: `GET /` (UI), `GET /health`
- Authenticated (Bearer): `/capabilities`, `/v1/*`

Default bind: `127.0.0.1:8733`

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m hapa_keys_node start
```

Token is persisted to `.node_token` at repo root.
