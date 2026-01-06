# Hapa Media Node (MLX Station)

A FastAPI-based media generation service for the Hapa ecosystem, running on Apple Silicon using MLX and mflux for high-performance diffusion model inference.

## Overview

The Hapa Media Node provides:
- **Image Generation**: Text-to-image, image-to-image, inpainting, depth-controlled, ControlNet, and Redux modes
- **Multi-Node Support**: Hub/router mode for managing multiple generation nodes
- **Web UI**: Interactive interface for testing and generation
- **Bearer Token Auth**: Secure API access with persistent token management
- **Asset Management**: SQLite-backed storage with downloadable artifacts

## Requirements

- Apple Silicon Mac (M1/M2/M3)
- Python 3.10+
- macOS 13.0+
- 16GB+ RAM recommended
- Hugging Face account with model access

## Installation

```bash
# Clone repository
git clone https://github.com/calderwong/hapa-mlx-station.git
cd hapa-mlx-station

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Login to Hugging Face (for gated models)
hf auth login
```

## Configuration

### Environment Variables

```bash
# Node configuration
HAPA_MEDIA_NODE_HOST=127.0.0.1  # Default loopback
HAPA_MEDIA_NODE_PORT=8723       # Default port
HAPA_MEDIA_NODE_STORAGE_DIR=./data  # Storage location
HAPA_MEDIA_NODE_TOKEN=<token>   # Bearer token (auto-generated if not set)

# Hub configuration (for multi-node)
HAPA_MEDIA_HUB_HOST=127.0.0.1
HAPA_MEDIA_HUB_PORT=8726
HAPA_MEDIA_HUB_NODES=http://127.0.0.1:8723,http://127.0.0.1:8724

# Optional features
HAPA_MEDIA_NODE_DUMMY_GENERATION=1  # CI mode (skip actual generation)
HAPA_MEDIA_ALLOW_QUERY_TOKEN=1      # Allow ?token= auth
```

## Usage

### Start Single Node

```bash
python -m hapa_media_node
# Or with custom port
python -m hapa_media_node --port 8724
```

### Start Multi-Node Stack

```bash
# Start 2 nodes + hub
python -m hapa_media_node stack --nodes 2 --hub-port 8726
```

### Web UI

Navigate to `http://127.0.0.1:8723` (or hub port) to access the Media Node Forge UI.

### CLI Usage

```bash
# Generate image
python -m hapa_media_node generate \
    --prompt "cosmic starship in nebula" \
    --model schnell \
    --steps 4

# Check health
python -m hapa_media_node health

# Run self-test
python -m hapa_media_node self-test
```

## API Endpoints

### Public Endpoints
- `GET /` - Web UI
- `GET /health` - Health check

### Authenticated Endpoints (Bearer token required)
- `GET /capabilities` - Node capabilities
- `POST /v1/images/generations` - Create generation task
- `GET /v1/tasks/{task_id}` - Get task status
- `GET /v1/assets/{asset_id}/download` - Download generated asset
- `GET /v1/queue` - View task queue
- `GET /v1/presets` - List presets
- `POST /v1/presets` - Create preset

## Models Supported

- **FLUX.1-schnell** - Fast 4-step generation
- **FLUX.1-dev** - Higher quality 50-step generation  
- **Z-Image Turbo** - Optimized variant
- **Fibo** - Alternative model
- **LoRA Support** - Various style adaptations

## Architecture

```
hapa_media_node/
├── app.py          # FastAPI application
├── hub_app.py      # Hub/router for multi-node
├── worker.py       # Background generation worker
├── mflux_engine.py # MLX/mflux integration
├── models.py       # Pydantic data models
├── config.py       # Configuration management
├── port_manager.py # Cooperative port allocation
└── web/
    └── index.html  # Web UI (Forge interface)
```

## Testing

```bash
# Run unit tests
python -m unittest discover -s tests

# Run self-test
python -m hapa_media_node self-test

# Smoke test multi-node setup
python scripts/multi_node_hub_smoke_test.py
```

## Integration

The Media Node integrates with:
- **Hapa Keys Node** - Secure API key management
- **Hapa Telemetry Node** - Performance monitoring
- **Hapa Avatar Node** - Avatar generation pipeline
- **Hapa Agent Registry** - Service discovery

## Security

- Loopback-only by default (127.0.0.1)
- Bearer token authentication for `/v1/*` endpoints
- Token persisted to `.node_token` file
- Optional query token auth (disabled by default)

## License

Proprietary - Hapa.AI

## Support

For issues and questions, see the [Overwatch documentation](../.Overwatch/nodes/MAC_HAPA_MLX_STATION.md).
