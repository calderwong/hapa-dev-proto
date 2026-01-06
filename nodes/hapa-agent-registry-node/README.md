# Hapa Agent Registry Node

Distributed agent registration and discovery service for the Hapa ecosystem, built on Node.js with Hypercore for event sourcing and SQLite for projections.

## Overview

The Agent Registry provides:
- **Agent Registration**: Register and track agent capabilities
- **Service Discovery**: Find agents by capability or type
- **Port Management**: Cooperative port allocation system
- **Avatar Integration**: Optional avatar generation for agents
- **Bearer Token Auth**: Secure API access

## Features

- **Agent Management**: Register, update, and query agents
- **Capability Matching**: Find agents by required capabilities
- **Port Leasing**: Prevent port conflicts across services
- **Avatar Pipeline**: Generate agent avatars via Avatar Node
- **Event Sourcing**: Hypercore-backed append-only log
- **Web UI**: Visual agent browser and manager

## Requirements

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone repository
git clone https://github.com/calderwong/hapa-agent-registry-node.git
cd hapa-agent-registry-node

# Install dependencies
npm install

# Start the node
npm start
```

## Configuration

### Environment Variables

```bash
# Node configuration
HAPA_AGENT_REGISTRY_HOST=127.0.0.1  # Default loopback
HAPA_AGENT_REGISTRY_PORT=8735       # Default port
HAPA_AGENT_REGISTRY_TOKEN=<token>   # Bearer token (auto-generated if not set)

# Avatar integration
HAPA_AVATAR_NODE_BASE_URL=http://127.0.0.1:8734
HAPA_AVATAR_INTEGRATION=enabled     # enabled/disabled/stub

# Storage
HAPA_RUNTIME_DIR=~/.hapa/runtime    # Runtime state directory
```

## Usage

### Start Service

```bash
npm start
# Or with CLI
./hapa-agent-registry start
```

### CLI Usage

```bash
# Service control
./hapa-agent-registry start    # Start service
./hapa-agent-registry stop     # Stop service
./hapa-agent-registry status   # Check status

# Agent operations
./hapa-agent-registry register --name "analyzer" --type "code"
./hapa-agent-registry list
./hapa-agent-registry find --capability "python"

# Self-test
./hapa-agent-registry self-test
```

### API Endpoints

#### Public Endpoints
- `GET /` - Web UI
- `GET /health` - Health check

#### Authenticated Endpoints (Bearer token required)
- `GET /capabilities` - Node capabilities
- `GET /v1/agents` - List agents
- `POST /v1/agents` - Register agent
- `GET /v1/agents/{id}` - Get agent details
- `PUT /v1/agents/{id}` - Update agent
- `DELETE /v1/agents/{id}` - Remove agent
- `POST /v1/agents/search` - Search agents by capability

## Architecture

```
hapa-agent-registry-node/
├── server.js           # Fastify server
├── storage.js          # Hypercore + SQLite storage
├── portManager.js      # Port lease management
├── avatarClient.js     # Avatar node integration
├── web/
│   └── index.html      # Agent browser UI
├── test/
│   └── self_test.test.js  # Automated tests
└── artifacts/          # Runtime artifacts
```

## Port Management

The registry uses a cooperative port leasing system compatible with other Hapa nodes:

```javascript
// Lease files at ~/.hapa/runtime/leases/port-<port>.json
{
  "port": 8735,
  "service": "agent-registry",
  "pid": 12345,
  "timestamp": "2026-01-05T12:00:00Z"
}
```

## Integration

The Agent Registry integrates with:
- **Hapa Avatar Node** - Agent avatar generation
- **Hapa Telemetry Node** - Service monitoring
- **Hapa Media Node** - Port coordination
- **Overwatch** - Agent profile management

## Security

- Loopback-only by default (127.0.0.1)
- Bearer token authentication for `/v1/*` endpoints
- Token persisted to `.node_token` file

## Testing

```bash
# Run self-test
npm test

# Test results saved to
# artifacts/self_test/agent_registry_self_test_latest.json
```

## License

Proprietary - Hapa.AI

## Support

For issues and questions, see the [Overwatch documentation](../../.Overwatch/nodes/MAC_HAPA_AGENT_REGISTRY_NODE.md).
