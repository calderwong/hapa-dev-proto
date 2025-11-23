# Pear / Bare / Hypercore / Hyperswarm – Reference for Hapa AG

This document summarizes how the Holepunch stack (Pear runtime, Bare, Hypercore, Hyperswarm) works **in the context of this Electron + React app**. It is intended as a quick reference for future work on the P2P tab and any deeper integration.

The current app is *not* a Pear/Bare app – it is a Node/Electron app using the same core libraries (`hypercore`, `hyperswarm`, `b4a`). Many concepts still carry over directly.

---

## 1. Conceptual Stack

- **Bare**
  - A small JavaScript runtime (C-based) optimized for P2P apps.
  - Comparable to Node.js but focused on embeddability and cross-device support.
  - In Pear apps, Bare provides the JS environment in which code runs.

- **Pear Runtime**
  - Tooling + runtime that uses Bare to run “Pear applications”.
  - Provides application lifecycle (`Pear.teardown`), app storage (`Pear.config.storage`), argument handling (`Pear.config.args`), etc.
  - Pear apps are usually CLI or desktop apps that talk directly to Hypercore/Hyperswarm, HyperDHT, etc.

- **Hypercore**
  - Secure, distributed, append-only log.
  - One **writer** (the holder of the private key), many **readers**.
  - Data is a sequence of blocks indexed by number (0..length-1).
  - Can be updated live; readers can tail new blocks as they arrive.

- **Hyperswarm**
  - Peer discovery + encrypted connection management.
  - Peers join a 32-byte topic (usually a Hypercore `discoveryKey`).
  - Emits `connection` events with encrypted duplex streams.
  - Used to replicate Hypercores between peers.

In this app we use **Hypercore + Hyperswarm directly** (no Bare/Pear) to back the **“P2P Hypercore Manager”** page.

---

## 2. How P2P Works in This App Today

### 2.1 Electron-side module: `electron/p2p.ts`

Key functions (simplified):

```ts
import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import * as b4a from 'b4a'

const cores = new Map<string, any>()
let swarm: any

export function initP2P() {
  swarm = new Hyperswarm()
}

export async function createCore(name: string) {
  const core = new Hypercore('./storage/' + name)
  await core.ready()

  cores.set(name, core)

  swarm.on('connection', (conn: any, info: any) => {
    const stream = core.replicate(conn)
    stream.on('error', (err: any) => console.error('Replication error:', err))
  })

  swarm.join(core.discoveryKey)
  await swarm.flush()

  return { key: b4a.toString(core.key, 'hex'), length: core.length }
}

export async function appendToCore(name: string, data: string) {
  const core = cores.get(name)
  if (!core) throw new Error(`Core ${name} not found`)
  await core.append(data)
  return { length: core.length }
}

export async function readCore(name: string) {
  const core = cores.get(name)
  if (!core) throw new Error(`Core ${name} not found`)
  const entries: string[] = []
  for (let i = 0; i < core.length; i++) {
    const block = await core.get(i)
    entries.push(b4a.toString(block))
  }
  return entries
}
```

Notes:

- Storage is **local directory storage** (`./storage/<name>`), not Pear’s `Pear.config.storage`.
- Only the process that calls `createCore` knows about that Hypercore instance; other peers would need the key & storage path logic.
- We **join the swarm using `core.discoveryKey`**, which is correct and matches the docs.
- `swarm.on('connection', ...)` is attached once *per call* to `createCore`, which is slightly different from the Pear examples (they typically set this once).

### 2.2 Renderer-side UI: `src/pages/P2P.tsx`

- Lets the user:
  - Enter a `coreName` (string) and click **Connect**.
  - Append arbitrary text.
  - Refresh and view all log entries.
- Communicates via IPC bridges:
  - `p2pCreateCore(name)` → `createCore(name)`
  - `p2pAppend({ name, data })` → `appendToCore`
  - `p2pRead(name)` → `readCore`

Currently there is **no remote peer UI** in this app; all replication is between this app instance and any other Hypercore users that know the same key/discovery key and join the same topic.

---

## 3. Hypercore Fundamentals (Condensed)

### 3.1 Creation

```ts
const core = new Hypercore(storage, [key], [options])
```

- `storage` – directory or function returning a random-access storage instance.
  - In this app we use a simple string path like `'./storage/my-core'`.
- `key` (optional) – public key of an existing core. If omitted and nothing exists on disk, a new keypair is generated.
- Important options (from docs):
  - `createIfMissing` (default `true`) – create new core if not present.
  - `overwrite` (default `false`) – overwrite any existing core in that storage.
  - `sparse` (default `true`) – allow sparse download of blocks.
  - `valueEncoding` – `'utf-8'`, `'json'`, `'binary'`, or custom.

After construction you must call:

```ts
await core.ready()
// core.key, core.discoveryKey, core.length now valid
```

### 3.2 Keys and Discovery

- `core.key` – **public key / read capability** for the log.
  - Share this with readers to let them open the log.
- `core.discoveryKey` – hash-derived from `core.key`.
  - Used **only for discovery** on Hyperswarm; *not* a read capability.

### 3.3 Appends and Reads

- Append:
  ```ts
  await core.append(Buffer | string | any)
  ```
- Read individual block:
  ```ts
  const block = await core.get(index)
  ```
- Stream:
  ```ts
  for await (const block of core.createReadStream({ start, live })) {
    // ...
  }
  ```

### 3.4 Replication

Given a duplex encrypted stream from Hyperswarm:

```ts
swarm.on('connection', (conn, info) => {
  const stream = core.replicate(conn)
  stream.on('error', (err) => { ... })
})
```

The docs recommend:

- One **writer** per core; do **not** create multiple cores with the same private key on multiple devices.
- Use Hypercore for **persistent logs**; multiple readers replicate from the writer’s core.

---

## 4. Hyperswarm Fundamentals (Condensed)

### 4.1 Construction

```ts
const swarm = new Hyperswarm(options?)
```

Key options:

- `keyPair` / `seed` – Noise keypair used for DHT identity.
- `maxPeers` – limit on simultaneous connections.
- `firewall(remotePublicKey) => boolean` – reject condition.

### 4.2 Join and Discovery

```ts
const discovery = swarm.join(topic, { server?: boolean, client?: boolean })
```

- `topic`: 32-byte `Buffer` – typically `core.discoveryKey`.
- `server: true` – announce self for incoming connections.
- `client: true` – actively look up and connect to servers.

After joining:

- `swarm.on('connection', (socket, peerInfo) => { ... })` fires for each new peer.
- `await swarm.flush()` waits until current DHT operations + pending connections settle.

### 4.3 Clients vs Servers

- **Server mode**: Accepts incoming connections for a topic; announces on DHT.
- **Client mode**: Looks up servers for a topic; connects to them.
- Both result in `connection` events; `peerInfo.topics` is only populated for client-side connections.

---

## 5. Mapping Pear Examples → This App

The Pear docs show a typical pattern:

- **Writer app**:
  - Creates `core` in `Pear.config.storage`.
  - Appends data from stdin.
  - Joins `core.discoveryKey` on Hyperswarm.
  - Replicates on `swarm.on('connection', ...)`.

- **Reader app**:
  - Accepts the writer’s `core.key` as an argument.
  - Opens that core, joins the same `discoveryKey`, and replicates.
  - Uses `core.update()` + `createReadStream({ live: true })` to tail.

Our Electron app is effectively combining both roles:

- The **P2P tab** acts like the writer (it owns the storage + key and can append).
- The app also acts as a reader of its own core via `readCore`.
- External readers/writers could be built as Pear/Bare CLI apps using the same key/discovery key.

---

## 6. Recommended Practices for This App

### 6.1 Storage and Naming

- Keep using `./storage/<name>` for now; consider:
  - Adding a small index file mapping **human names → keys**.
  - Showing both `key` and `discoveryKey` in the UI so users can plug them into Pear CLI apps.

### 6.2 Replication Lifecycle

- Call `initP2P()` once on app startup to create a single `Hyperswarm` instance.
- Prefer attaching a **single** `swarm.on('connection')` handler that knows which cores to replicate, rather than re-attaching per core.
- When a new core is created or opened, do:
  ```ts
  swarm.join(core.discoveryKey)
  // optionally await swarm.flush() if we want to block until peers connected
  ```

### 6.3 Multi-process / Multi-core Considerations

- If we start supporting **multiple cores simultaneously**, track them in `cores: Map<string, Hypercore>` keyed by **public key** rather than arbitrary name.
- Future extension: allow `p2pJoinCoreByKey(keyHex)` that opens an existing core read-only and joins its discovery key.

### 6.4 Security & Privacy

- Treat Hypercore **private keys** as secrets (they are stored in the same folder as the data files).
- Only share **public keys** and optionally discovery keys.
- Be aware that joining a topic leaks that topic to DHT nodes; don’t encode sensitive data directly into topics.

---

## 7. Future Work Ideas

These are safe extensions aligned with Pear docs:

- **Read-only joins by key**
  - IPC handler to join a Hypercore given its public key (hex), without write access.
- **Live streaming in UI**
  - Use a background loop or subscription to tail the Hypercore instead of manual “Refresh”.
- **Pear CLI companion**
  - Small Pear Terminal app (writer/reader) that can connect to cores created in this Electron app.
- **Better replication diagnostics**
  - Surface `swarm.connections`, `swarm.peers.size`, and basic stats in the P2P page.

---

## 8. Quick Cheatsheet

- **Create writer core (Electron)**
  ```ts
  const core = new Hypercore('./storage/my-core')
  await core.ready()
  swarm.join(core.discoveryKey)
  swarm.on('connection', (conn) => core.replicate(conn))
  ```

- **Append**
  ```ts
  await core.append('some string')
  ```

- **Read all**
  ```ts
  const entries = []
  for (let i = 0; i < core.length; i++) {
    const block = await core.get(i)
    entries.push(b4a.toString(block))
  }
  ```

- **Pear reader (conceptual)**
  ```js
  const core = new Hypercore(path.join(Pear.config.storage, 'reader-storage'), KEY)
  await core.ready()
  swarm.join(core.discoveryKey)
  swarm.on('connection', conn => core.replicate(conn))
  await swarm.flush()
  await core.update()
  for await (const block of core.createReadStream({ start: core.length, live: true })) {
    console.log(block.toString())
  }
  ```

This file is meant to be the on-ramp for anyone touching the P2P code in this repo.
