# Hapa Avatar Node

Avatar lineage expansion service for the Hapa ecosystem, generating multi-variant avatar collections using Z-Image diffusion models.

## Overview

The Avatar Node provides:
- **Lineage Expansion**: Generate complete avatar sets with variants and poses
- **Z-Image Integration**: Upstream connection to Hapa Media Node for generation
- **Index Card Generation**: YAML metadata for each avatar collection
- **Web Preview**: Gallery interface for viewing avatar collections
- **Bearer Token Auth**: Secure API access

## Features

- **Avatar Generation Pipeline**: Base → Variants → Poses workflow
- **Automatic Lineage**: Generate 8 variants + 5 poses per variant
- **Metadata Tracking**: Complete lineage.json and index cards
- **Preview UI**: Web-based avatar gallery
- **Export System**: Package avatars for distribution

## Requirements

- Python 3.10+
- Access to upstream Hapa Media Node (default: http://127.0.0.1:8726)

## Installation

```bash
# Clone repository
git clone https://github.com/calderwong/hapa-avatar-node.git
cd hapa-avatar-node

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

### Environment Variables

```bash
# Node configuration
HAPA_AVATAR_NODE_HOST=127.0.0.1  # Default loopback
HAPA_AVATAR_NODE_PORT=8734       # Default port
HAPA_AVATAR_NODE_TOKEN=<token>   # Bearer token (auto-generated if not set)

# Upstream Media Node
HAPA_AVATAR_UPSTREAM_BASE_URL=http://127.0.0.1:8726
HAPA_AVATAR_UPSTREAM_TOKEN=<token>  # Media node token

# Generation settings
HAPA_AVATAR_VARIANT_COUNT=8      # Number of variants
HAPA_AVATAR_POSE_COUNT=5         # Poses per variant
```

## Usage

### Start Server

```bash
python -m hapa_avatar_node serve
```

### CLI Usage

```bash
# Check health
python -m hapa_avatar_node health

# Generate avatar lineage
python -m hapa_avatar_node expand --name "cosmic_warrior" --spec "cyberpunk soldier"

# Preview avatars
python -m hapa_avatar_node preview --name "cosmic_warrior"

# Export avatar package
python -m hapa_avatar_node export --name "cosmic_warrior"

# Run self-test
python -m hapa_avatar_node self-test
```

### API Endpoints

#### Public Endpoints
- `GET /` - Web UI
- `GET /health` - Health check

#### Authenticated Endpoints (Bearer token required)
- `GET /capabilities` - Node capabilities
- `POST /v1/expand/avatar` - Start avatar expansion
- `GET /v1/status/{job_id}` - Check expansion status
- `GET /v1/preview/{avatar_name}` - Preview avatar collection
- `GET /v1/export/{avatar_name}` - Export avatar package

## Avatar Structure

```
media/avatars/<avatar_name>/
├── base.png                 # Original base image
├── variant_1.png            # Variant images
├── variant_1_pose_1.png     # Pose variations
├── lineage.json             # Complete generation metadata
└── index.card.yaml          # Avatar index card
```

## Integration

The Avatar Node integrates with:
- **Hapa Media Node** - Upstream image generation
- **Hapa Agent Registry** - Avatar catalog management
- **Hapa Telemetry Node** - Performance monitoring

## Security

- Loopback-only by default (127.0.0.1)
- Bearer token authentication for `/v1/*` endpoints
- Token persisted to `.node_token` file
- Upstream token required for media generation

## Testing

```bash
# Run self-test
python -m hapa_avatar_node self-test

# Test results saved to
# artifacts/self_test/avatar_self_test_<run_id>.json
```

## License

Proprietary - Hapa.AI

## Support

For issues and questions, see the [Overwatch documentation](../../.Overwatch/nodes/MAC_HAPA_AVATAR_NODE.md).
