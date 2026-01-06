# Hapa Lore Node

Canonical lore and knowledge management system for the Hapa ecosystem, tracking agent memories, system evolution, and architectural decisions.

## Overview

The Lore Node provides:
- **Lore Entry Management**: Timestamped entries with attribution and tags
- **Canon Tracking**: Official system canon and architectural decisions
- **Agent Reflections**: Capture agent insights and learnings
- **Version Control**: Git-backed history of all lore entries
- **Search & Discovery**: Find relevant lore by tags, date, or content

## Features

- **Entry Types**: CANON_ENTRY, AGENT_REFLECTION, WISDOM_NUGGET, DAILY_PROGRESS
- **Attribution System**: Track which agent/human created each entry
- **Tag-based Organization**: Categorize and filter lore entries
- **Markdown Format**: Human-readable lore files
- **Integration with Overwatch**: Sync with CHECK_IN protocol

## Directory Structure

```
data/lore/
├── entries/
│   ├── LORE-20260104T070100Z.md  # Canon entries
│   ├── LORE-20260104T070200Z.md  # Agent reflections
│   └── ...
├── index.json                     # Entry index
└── tags.json                      # Tag registry
```

## Entry Format

```markdown
---
id: LORE-20260104T070100Z
type: CANON_ENTRY
attribution: CASCADE
tags: [architecture, decision, authentication]
created: 2026-01-04T07:01:00Z
---

# Entry Title

Entry content in markdown format...
```

## Usage

### CLI Usage

```bash
# Add new lore entry
./hapa-lore add --type CANON_ENTRY --title "New Architecture Decision" --tags "architecture,security"

# Search lore
./hapa-lore search --query "authentication" --type CANON_ENTRY

# List recent entries
./hapa-lore list --limit 10 --attribution CASCADE

# Export lore collection
./hapa-lore export --format json --output lore-export.json
```

### Integration

The Lore Node integrates with:
- **Overwatch**: CHECK_IN protocol references
- **Hapa Telemetry Node**: Activity tracking
- **Agent Registry**: Agent attribution tracking

## Lore Types

- **CANON_ENTRY**: Official system decisions and architecture
- **AGENT_REFLECTION**: Agent insights and learnings
- **WISDOM_NUGGET**: Key insights and best practices
- **DAILY_PROGRESS**: Development progress logs
- **HUMAN_PILOT_QUOTE**: Important guidance from operators

## Security

- Read-only by default for most operations
- Write operations require appropriate attribution
- Git-backed for audit trail

## License

Proprietary - Hapa.AI

## Support

For issues and questions, see the [Overwatch documentation](../../.Overwatch/nodes/MAC_HAPA_LORE_NODE.md).
