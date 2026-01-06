# Hapa Open Tasks Node

A distributed task management system for the Hapa ecosystem, built on Node.js with Hypercore for distributed state and SQLite for local projection.

## Overview

The Open Tasks Node provides:
- **Distributed Task Management**: Hypercore-backed append-only log for task state
- **Kanban UI**: Visual task board with drag-and-drop
- **Status Management**: Customizable status definitions
- **Bearer Token Auth**: Secure API access
- **Self-Test Harness**: Automated validation

## Features

- **Task Operations**: Create, update, move tasks between statuses
- **Custom Statuses**: Define and manage workflow states
- **References**: Attach links and metadata to tasks
- **Web UI**: Interactive Kanban board interface
- **CLI Tools**: Command-line interface for all operations
- **API Access**: RESTful API for programmatic access

## Requirements

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone repository
git clone https://github.com/calderwong/hapa-open-tasks-node.git
cd hapa-open-tasks-node

# Install dependencies
npm install

# Start the node
npm start
```

## Configuration

### Environment Variables

```bash
# Host and port
HAPA_OPEN_TASKS_HOST=127.0.0.1  # Default loopback
HAPA_OPEN_TASKS_PORT=8733       # Default port

# Authentication
HAPA_OPEN_TASKS_TOKEN=<token>   # Bearer token (auto-generated if not set)
HAPA_OPEN_TASKS_ALLOW_QUERY_TOKEN=1  # Allow ?token= auth (disabled by default)

# Storage
HAPA_OPEN_TASKS_STORAGE_DIR=./storage  # Storage location
```

## Usage

### Web UI

Navigate to `http://127.0.0.1:8733` to access the Kanban board interface.

### CLI Usage

```bash
# Start/stop service
npm start
npm stop

# Check status
npm run status

# Run self-test
npm test
```

### API Endpoints

#### Public Endpoints
- `GET /` - Web UI
- `GET /health` - Health check

#### Authenticated Endpoints (Bearer token required)
- `GET /capabilities` - Node capabilities
- `GET /v1/tasks` - List tasks
- `POST /v1/tasks` - Create task
- `PUT /v1/tasks/{id}` - Update task
- `DELETE /v1/tasks/{id}` - Delete task
- `GET /v1/statuses` - List status definitions
- `POST /v1/statuses` - Create status
- `PUT /v1/statuses/{id}` - Update status

## Architecture

```
hapa-open-tasks-node/
├── server.js       # Fastify server
├── storage.js      # Hypercore + SQLite storage
├── auth.js         # Authentication middleware
├── web/
│   └── index.html  # Kanban UI
├── test/
│   └── self_test.test.js  # Automated tests
└── artifacts/      # Runtime and test artifacts
```

## Integration

The Open Tasks Node integrates with:
- **Hapa Telemetry Node** - Service discovery and monitoring
- **Hapa Agent Registry** - Agent task assignments
- **Overwatch** - Task synchronization from TASK_INBOX.md

## Security

- Loopback-only by default (127.0.0.1)
- Bearer token authentication for `/v1/*` endpoints
- Token persisted to `.node_token` file
- Query token auth disabled by default

## Testing

```bash
# Run self-test
npm test

# Test results saved to
# artifacts/self_test/open_tasks_self_test_latest.json
```

## License

Proprietary - Hapa.AI

## Support

For issues and questions, see the [Overwatch documentation](../../.Overwatch/nodes/MAC_HAPA_OPEN_TASKS_NODE.md).
