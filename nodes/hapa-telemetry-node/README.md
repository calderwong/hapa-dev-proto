# Hapa Telemetry Node

Central monitoring and discovery hub for the Hapa node ecosystem.

## Features

- **Auto-Discovery**: Multiple discovery methods (mDNS, port scanning, registry)
- **Real-time Monitoring**: Collects telemetry from all nodes every 10 seconds
- **Visual Dashboard**: Web UI showing node status, metrics, and relationships
- **Graph Visualization**: Interactive node relationship graph
- **CLI Tools**: Command-line interface for all operations
- **Self-Test**: Automated testing harness for validation

## Quick Start

```bash
# Install dependencies
make install

# Start telemetry node
make start

# Open dashboard
open http://127.0.0.1:8730
```

## Authentication

The telemetry node uses bearer token authentication. On first start, a token is generated and saved to `.node_token`.

To get your token:
```bash
cat .node_token
```

## CLI Usage

```bash
# Service control
./hapa-telemetry start          # Start service
./hapa-telemetry stop           # Stop service
./hapa-telemetry status         # Check status

# Discovery
./hapa-telemetry discover       # Scan for nodes
./hapa-telemetry list           # List known nodes
./hapa-telemetry info <node_id> # Node details

# Monitoring
./hapa-telemetry graph          # Show relationships
./hapa-telemetry test           # Run self-test

# Manual registration
./hapa-telemetry register <url>
```

## API Endpoints

### Public
- `GET /` - Dashboard UI
- `GET /health` - Health check

### Authenticated
- `GET /v1/capabilities` - Service capabilities
- `GET /v1/nodes` - List discovered nodes
- `GET /v1/nodes/{node_id}` - Node details
- `GET /v1/telemetry/{node_id}` - Node telemetry
- `POST /v1/discovery/register` - Register node
- `POST /v1/discovery/scan` - Trigger scan
- `GET /v1/graph` - Relationship graph

## Environment Variables

- `HAPA_TELEMETRY_HOST` - Bind host (default: 127.0.0.1)
- `HAPA_TELEMETRY_PORT` - Port (default: 8730)
- `HAPA_TELEMETRY_TOKEN` - Auth token
- `HAPA_TELEMETRY_SCAN_INTERVAL` - Discovery interval (default: 30s)
- `HAPA_TELEMETRY_COLLECT_INTERVAL` - Collection interval (default: 10s)

## Node Integration

For nodes to be discoverable, they should implement:

```python
# Minimal (required)
@app.get("/health")
def health():
    return {"status": "healthy"}

# Recommended
@app.get("/capabilities")
def capabilities():
    return {
        "service_type": "your_service",
        "api_version": "1.0.0",
        "node_id": "unique_id"
    }
```

## Dashboard Features

1. **Node Grid**: Visual cards showing all discovered nodes
2. **Real-time Metrics**: CPU, memory, queue depth, task counts
3. **Status Indicators**: Online/offline/degraded states
4. **Relationship Graph**: Interactive SVG visualization
5. **Auto-refresh**: Updates every 10 seconds

## Self-Test

Run the automated test suite:
```bash
make test
```

Tests include:
- Health check
- Authentication
- Node registration
- Discovery scanning
- Telemetry collection
- Graph generation
- UI availability

## Files

```
hapa-telemetry-node/
├── hapa_telemetry_node/
│   ├── app.py           # FastAPI application
│   ├── discovery.py     # Node discovery
│   ├── collector.py     # Telemetry collector
│   ├── database.py      # SQLite storage
│   ├── auth.py          # Token auth
│   ├── cli.py           # CLI interface
│   └── self_test.py     # Test harness
├── web/
│   └── index.html       # Dashboard UI
├── .node_token          # Auth token
├── telemetry.db         # Database
└── Makefile            # Build commands
```

## Security

- Loopback-only by default (127.0.0.1)
- Bearer token authentication
- No sensitive data in telemetry
- Read-only mode for untrusted networks

## Protocol

See `/Users/calderwong/Desktop/.Overwatch/protocols/TELEMETRY_PROTOCOL.md`

## License

Proprietary - Hapa.ai
