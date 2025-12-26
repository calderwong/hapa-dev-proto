# Docs Index (Living)

This folder contains long-form plans, designs, troubleshooting notes, and reference docs.

This repo has been worked on by multiple humans and multiple AI agents. The goal of this index is to make it easy to:
- find the authoritative doc for a topic
- add new docs without creating a future junk drawer
- keep older docs discoverable without breaking links

If you’re new here, start with:
- `docs/PRIORITY.md`
- `docs/VALIDATION_PROTOCOL.md`
- `docs/🧹housecleaning_protocol_ALWAYS_READ.md`
- `docs/HAPA_AG_SYSTEM_REFERENCE.md`
- `docs/Hypercore_Storage_and_DB_Reference.md`
- `docs/.mind/Comms/PROTOCOL.md` (multi-agent edit etiquette)

---

## Where things live

### Root-level (project meta)

- `README.md` (repo intro + setup)
- `Product_Requirements_Document.md` (what/why + scope)
- `dev_journal.md` (prompt log + execution summary)
- `To_Be_Better_Next_Time.md` (retrospective notes)
- `APPLES/` (reward logs; do not edit unless explicitly asked)

### `docs/` (this folder)

- Long-form design docs, troubleshooting notes, and references.

### `docs/features/`

- Feature specs and UX/architecture plans for larger workstreams.

### `docs/reference/`

- API references and other “current truth” reference docs intended for automation and integrations.

### `docs/.mind/` (agent memory + comms + reference corpus)

- `docs/.mind/Comms/` is the authoritative multi-agent coordination surface.
- `docs/.mind/.blue/` is a large reference corpus (often with binary artifacts). Treat it as read-mostly.

---

## Topic map (quick links)

### Protocols / operating principles

- `docs/PRIORITY.md`
- `docs/VALIDATION_PROTOCOL.md`
- `docs/🧹housecleaning_protocol_ALWAYS_READ.md`
- `docs/CULTIVATION_PROCESS_v3.md`
- `docs/.mind/Comms/PROTOCOL.md`

### System reference (storage / persistence / truth)

- `docs/HAPA_AG_SYSTEM_REFERENCE.md`
- `docs/Hypercore_Storage_and_DB_Reference.md`
- `docs/Local_Node_Persistence_Governor_Refactor.md`
- `docs/PERSISTENCE_LAYER_IMPLEMENTATION_PLAN.md`

### Card Library & Wormhole

- `docs/CARD_LIBRARY_ASYNC_ARCHITECTURE.md`
- `docs/LIBRARY_OVERHAUL_DESIGN.md`
- `docs/PIPELINE_VISUALIZATION_PLAN.md`

### Integrations (centralized providers)

- `docs/openai-integration.md`
- `docs/vertex_ai_integration_plan.md`
- `docs/imagen-integration-plan.md`
- `docs/PHAMILIAR_SYSTEM_PLAN.md`

### Troubleshooting

- `docs/ASTRO_ICONS_DEBUGGING.md`
- `docs/TROUBLESHOOT_RUX_ICONS.md`
- `docs/TROUBLESHOOT_STENCIL_REACT.md`

### Operations / Diagnostics

- `docs/features/OPERATOR_REALITY_PANEL.md`
- `docs/features/README.md`

### Developer Automation / APIs

- `docs/reference/HAPA_NODE_API_REFERENCE.md`
- `docs/reference/HAPA_NODE_CLUSTER_TOPOLOGY.md`

---

## Naming + growth rules (for long-term scale)

- Prefer **additive** docs over rewriting history. If you need to supersede a doc, create a new versioned file (e.g. `_v2.md`) and link to it.
- Put large features into `docs/features/`.
- Use date suffixes for snapshot/handoff artifacts when appropriate: `*_YYYY-MM-DD.md`.

See also: `docs/DOCS_ORGANIZATION.md`.
