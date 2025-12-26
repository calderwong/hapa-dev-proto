# Docs Organization (Living)

This document defines how we organize documentation in this repository as it scales.

It is written for:
- future contributors (human + AI)
- future-you returning after a break
- multi-agent collaboration (avoid collisions + drift)

**Principle:** Prefer additive clarity over disruptive reorganizations. We want a structure that survives hundreds of new docs without turning into a junk drawer.

---

## Goals

- Make it easy to find the authoritative doc for a topic.
- Preserve history without burying current reality.
- Reduce duplication and “truth fragmentation.”
- Make multi-agent work safer by making intent and scope discoverable.

---

## Core rules

- **Root stays sacred**
  - Keep root for project-level meta only: repo `README.md`, `Product_Requirements_Document.md`, `dev_journal.md`, `To_Be_Better_Next_Time.md`, `LICENSE`, `APPLES/`.
  - If you’re about to add another root-level plan/spec, put it under `docs/` unless there’s a strong reason not to.

- **Prefer additive docs**
  - Don’t delete older reference docs.
  - If a doc must be superseded, create a new versioned doc (e.g. `_v2.md`) and link to it from the older one.

- **One source of truth per topic**
  - If multiple docs cover the same topic, decide which is authoritative and link the others to it.

- **Multi-agent etiquette is authoritative**
  - Follow `docs/.mind/Comms/PROTOCOL.md` for claims + hot files.

---

## Where things live

### `docs/README.md`

- The living **Docs Index**.
- Add links here when new docs are created.

### `docs/features/`

- Big feature design docs + long-running workstreams.
- If a feature has ongoing work, keep a single living doc and optionally version snapshots.

### `docs/reference/`

- “Current truth” references intended for integrations and automation.
- API contracts and automation entrypoints should land here.

### `docs/.mind/`

- **Read-mostly reference corpus** and multi-agent comms.
- `docs/.mind/Comms/` is the coordination surface.

### Recommended future subfolders (incremental adoption)

We can adopt these gradually; do not migrate everything in one giant move.

- `docs/protocols/` – operating principles and collaboration protocols
- `docs/reference/` – “current truth” references (storage, schemas, contracts)
- `docs/integrations/` – provider and external system integration specs
- `docs/troubleshooting/` – debug notes and incident writeups
- `docs/design/` – UX/architecture designs that aren’t a single feature workstream
- `docs/archives/` – dated snapshots / handoffs

---

## Naming conventions (for long-term scale)

Use one of these patterns when creating *new* docs:

- **Feature workstreams**
  - `docs/features/<FEATURE_NAME>.md`
  - Optional snapshots: `docs/features/<FEATURE_NAME>_YYYY-MM-DD.md`

- **Protocols**
  - `docs/protocols/<NAME>.md`

- **References (current truth)**
  - `docs/reference/<NAME>.md`

- **Troubleshooting / incidents**
  - `docs/troubleshooting/<INCIDENT_NAME>_YYYY-MM-DD.md`

- **Versioning**
  - Prefer `_v2`, `_v3` when the content is a genuine evolution that should not overwrite the previous record.

---

## How to add a new doc (quick checklist)

- Put it in the right folder (`docs/features/` for big workstreams).
- Add it to `docs/README.md` under the right topic.
- If it affects system reality (storage, paging, persistence), leave a short trail in `docs/.mind/Comms/`.

---

## Why we do it this way

- It matches the repo’s priority ordering:
  - Integrity (truth) > Flow > Form > Decoration
- It matches the cultivation mindset:
  - signal → artifact → validation → reward → capability → better signal
- It reduces multi-agent collisions by making intent legible.
