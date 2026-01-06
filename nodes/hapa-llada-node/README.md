# Hapa LLaDA Node

**Sovereign MLX Inference Node for LLaDA 2.0**

This node runs the LLaDA 2.0 (Large Language Diffusion Assistant) model on Apple Silicon using the MLX framework. It includes a modern web interface.

## Quick Start

1.  **Install:**
    ```bash
    ./install.sh
    ```

2.  **Run:**
    ```bash
    ./start.sh
    ```

    Or run via the CLI:
    ```bash
    ./hapa-llada-node serve --host 127.0.0.1 --port 8085
    ```

3.  **Access:**
    Open [http://localhost:8085](http://localhost:8085) in your browser.

## Features
-   **Diffusion LLM:** Runs LLaDA 2.0 (Non-autoregressive).
-   **Sovereign UI:** Beautiful, dark-mode web interface included.
-   **API:** `POST /generate` for the UI, plus an authenticated programmatic API.
-   **Auto-Healing:** Automatically downloads model snapshots and fixes pathing for custom MLX architectures.

## Security
-   **Binding:** Defaults to `127.0.0.1`. Only bind to `0.0.0.0` if you intentionally want to serve LAN traffic and trust your network.
-   **Tokens:** Treated as passwords. If `HAPA_LLADA_NODE_TOKEN` is not set, a random one is generated and saved to `.node_token`.


## Configuration
Set environment variables in `.env`:
-   `MODEL_PATH`: Default `mlx-community/LLaDA2.0-mini-4bit`
-   `PORT`: Default `8085`
-   `HAPA_LLADA_NODE_TOKEN`: Bearer token for authenticated endpoints (recommended to set; if not set, one is generated and written to `.node_token`)

## Programmatic API

Unauthenticated:
- `GET /health`
- `POST /generate`

Authenticated (set `HAPA_LLADA_NODE_TOKEN` and send `Authorization: Bearer <token>`):
- `GET /capabilities`
- `POST /v1/completions`

## CLI

This repo includes a CLI script named:
- `./hapa-llada-node`

Examples:

```bash
export HAPA_LLADA_NODE_TOKEN="devtoken"

./hapa-llada-node serve --host 127.0.0.1 --port 8085
./hapa-llada-node health --base-url http://127.0.0.1:8085
./hapa-llada-node capabilities --base-url http://127.0.0.1:8085 --token "$HAPA_LLADA_NODE_TOKEN"
./hapa-llada-node complete --base-url http://127.0.0.1:8085 --token "$HAPA_LLADA_NODE_TOKEN" --prompt "Hello"
./hapa-llada-node smoke-test --base-url http://127.0.0.1:8085 --token "$HAPA_LLADA_NODE_TOKEN"
```

## Docs
See `docs/` for research and architecture details.
