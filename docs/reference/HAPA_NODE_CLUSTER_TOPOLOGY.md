# Hapa Node Cluster Topology (Dev/Prod + Agent Coordination)

This doc captures a proposed topology for running multiple Hapa Nodes across your Windows machine and Mac Studio, and how Windsurf + other agents can coordinate with them.

The intent is to reduce coordination friction and make it easy to:
- run parallel **dev** and **prod** nodes
- have a consistent **API surface** to drive/testing nodes
- centralize comms across humans + agents
- treat comms as **append-only truth** (Hypercore-first)

---

## Target topology

A 4-node topology (2 machines × dev/prod):

- **Windows Dev Node**
  - Purpose: rapid UI + Electron iteration
  - Runs Debug API (loopback only) for Windsurf automation

- **Windows Prod Node**
  - Purpose: stable daily-driver
  - Debug API normally disabled

- **Mac Dev Node**
  - Purpose: fast iteration for heavy workloads (genAI/video/etc)

- **Mac Prod Node**
  - Purpose: stable service for the cluster (long-running, reliable)

---

## Reality check: running multiple nodes on one machine

Today, `electron/main.ts` calls `app.requestSingleInstanceLock()`.

Implication:
- A single built artifact will only allow **one running instance** per userData lock.

To support *dev + prod simultaneously on the same machine*, we’ll eventually need one of:
- different `userData` paths per instance (e.g. `HAPA_NODE_INSTANCE=dev|prod`), or
- different `appId`/names, or
- a separate headless “node” binary distinct from the UI app.

This is a design constraint to plan around.

---

## Two planes: Control plane vs Data/Comms plane

### 1) Control plane (HTTP)

Use a small authenticated HTTP API for:
- discovery / health
- capability negotiation
- starting jobs
- returning structured results
- admin tasks (safe toggles)

This plane is best at:
- request/response semantics
- explicit auth
- quick interoperability

### 2) Data + Comms plane (Hypercore-first)

Use Hypercores as the *default* medium for:
- agent-to-agent messages
- task/event logs
- shared “cluster notebook” / coordination feed
- append-only audit trail of decisions

This plane is best at:
- durable ordering + replay
- eventual consistency
- offline/async workflows
- auditability (nothing disappears)

---

## Why Hypercores for comms is compelling

- **Truth is append-only**: comms becomes an auditable log, not a mutable chat.
- **Replayable**: new agents/nodes can catch up from the beginning (or checkpoints).
- **Replication-native**: local network collaboration becomes automatic.
- **Decoupled**: agents don’t need to be online simultaneously.

---

## Important caveats (why it may be hybrid, not pure Hypercore)

Hypercore is a strong default, but a few realities push toward a hybrid architecture:

- **Access control / secrecy**
  - Hypercore replication alone does not automatically give you confidentiality.
  - If comms contains secrets, payloads must be encrypted and keys managed.

- **Multi-writer channels**
  - Hypercore is naturally single-writer.
  - Multi-writer needs an approach like:
    - per-agent feeds + merge layer (fan-in)
    - Autobase (multi-writer) / higher-level CRDT-ish merge

- **Request/response workflows**
  - Some operations (start job, get immediate ack) are simpler with HTTP.
  - Hypercore can still represent the durable log of that interaction.

---

## Recommended comms pattern (practical Hypercore-first)

- **One feed per agent**
  - `agent:<agent_id>:events`
  - append-only events and messages

- **One cluster coordination feed** (optional)
  - `cluster:coordination` (single-writer “moderator” or Autobase)

- **Derived/Indexed views**
  - local SQLite projection of messages/tasks for fast UI

Message schema example (conceptual):

```json
{
  "type": "agent_message",
  "id": "uuid",
  "ts": "2025-12-25T12:34:56.000Z",
  "from": "windsurf:cascade",
  "to": "node:mac-prod",
  "topic": "operator_panel",
  "body": { "text": "run rebuild + report stats" },
  "replyTo": null
}
```

---

## How Windsurf fits

Windsurf can coordinate via two mechanisms:

- **Local Debug API** (Windows dev node)
  - UI automation and smoke testing

- **LAN Node API** (Mac dev/prod nodes)
  - compute-heavy tasks, job queues, asset generation

Then both can log durable outcomes into Hypercores.

---

## Next steps (proposed)

- Formalize a **versioned LAN API contract** (health/capabilities/jobs/assets/events).
- Add an explicit concept of **node instance identity** (`dev` vs `prod`) to avoid cross-talk.
- Define Hypercore comms primitives:
  - feed naming
  - message schema
  - encryption strategy
  - multi-writer strategy (per-agent feeds + merge is simplest)
