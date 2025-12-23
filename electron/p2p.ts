import Hypercore from 'hypercore';
import Hyperswarm from 'hyperswarm';
import * as b4a from 'b4a';
import * as path from 'path';
import * as fs from 'fs';

import { emitCardDeleted, emitCardEvent } from './persistence';

const cores = new Map<string, any>();
let swarm: any;
let swarmInitialized = false;
const joinedTopics = new Set<string>();

let storageDir = path.resolve(process.cwd(), 'storage');

export function setStorageDir(nextDir: string, options?: { force?: boolean }) {
    const resolved = path.resolve(nextDir);

    const legacy = path.resolve(process.cwd(), 'storage');
    const legacyCardLibrary = path.join(legacy, 'card-library');
    const nextCardLibrary = path.join(resolved, 'card-library');

    const safeDirSize = (p: string): number => {
        try {
            if (!fs.existsSync(p)) return -1;
            const stat = fs.statSync(p);
            if (!stat.isDirectory()) return stat.size;
            let total = 0;
            const entries = fs.readdirSync(p);
            for (const name of entries) {
                const child = path.join(p, name);
                total += safeDirSize(child);
            }
            return total;
        } catch {
            return -1;
        }
    };

    const legacyHas = fs.existsSync(legacyCardLibrary);
    const nextHas = fs.existsSync(nextCardLibrary);

    if (options?.force) {
        storageDir = resolved;
    } else {
        if (legacyHas && nextHas) {
            const legacySize = safeDirSize(legacyCardLibrary);
            const nextSize = safeDirSize(nextCardLibrary);
            storageDir = legacySize > nextSize ? legacy : resolved;
        } else if (legacyHas) {
            storageDir = legacy;
        } else {
            storageDir = resolved;
        }
    }

    try {
        fs.mkdirSync(storageDir, { recursive: true });
    } catch {
        // ignore
    }
}

export function getStorageDir() {
    return storageDir;
}

export function initP2P() {
    if (swarmInitialized) return;

    swarm = new Hyperswarm();

    swarm.on('connection', (conn: any, info: any) => {
        try {
            const peerKey = (info && info.publicKey)
                ? b4a.toString(info.publicKey, 'hex')
                : undefined;
            const topics = (info && Array.isArray(info.topics))
                ? info.topics.map((t: Buffer) => b4a.toString(t, 'hex'))
                : undefined;

            console.log('P2P connection established', {
                peerPublicKey: peerKey,
                topics,
            });
        } catch {
            // Logging only; ignore errors here
        }

        for (const core of cores.values()) {
            const stream = core.replicate(conn);
            stream.on('error', (err: any) => console.error('Replication error:', err));
        }
    });

    swarmInitialized = true;
    console.log('P2P initialized');
}

export async function createCore(name: string) {
    if (!swarm) {
        throw new Error('P2P swarm not initialized. Call initP2P() first.');
    }

    let core = cores.get(name);
    if (!core) {
        try {
            fs.mkdirSync(storageDir, { recursive: true });
        } catch {
            // ignore
        }
        core = new Hypercore(path.join(storageDir, name));
        cores.set(name, core);
    }

    await core.ready();

    const topicHex = b4a.toString(core.discoveryKey, 'hex');
    if (!joinedTopics.has(topicHex)) {
        swarm.join(core.discoveryKey);
        joinedTopics.add(topicHex);
        // Do not await flush; let discovery happen in background
        swarm.flush().catch((err: any) => console.error('Swarm flush error:', err));
    }

    return {
        key: b4a.toString(core.key, 'hex'),
        discoveryKey: topicHex,
        length: core.length,
    };
}

export async function appendToCore(name: string, data: string) {
    const core = cores.get(name);
    if (!core) {
        throw new Error(`Core ${name} not found`);
    }

    try {
        await core.append(data);
    } catch (err: any) {
        const code = err?.code || err?.errno;
        const msg = err?.message || String(err);
        throw new Error(`[appendToCore] Failed (core=${name}, storageDir=${storageDir}, code=${code}): ${msg}`);
    }

    // Project card-library index updates into local persistence.
    // This runs at the Hypercore append layer so pipeline/recovery writes are captured.
    try {
        if (name === 'card-library' && typeof data === 'string' && data.trim().length > 0) {
            let parsed: any = null;
            try {
                parsed = JSON.parse(data);
            } catch {
                parsed = null;
            }

            if (parsed && (parsed.type === 'card-index' || parsed.cardId || parsed.coreName)) {
                const id = String(parsed.cardId || parsed.id || parsed.coreName || '').trim();
                if (id) {
                    const deleted = parsed.deleted === true || parsed.isDeleted === true || parsed.status === 'deleted';
                    if (deleted) {
                        await emitCardDeleted({
                            id,
                            deletedAt: parsed.deletedAt || new Date().toISOString(),
                        } as any);
                    } else {
                        await emitCardEvent('CARD_CREATED', {
                            id,
                            type: typeof parsed.cardType === 'string' ? parsed.cardType : 'standard',
                            mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                            name: typeof parsed.name === 'string' ? parsed.name : undefined,
                            tier: typeof parsed.tier === 'number' ? parsed.tier : undefined,
                            hellweekRunId: typeof parsed.runId === 'string' ? parsed.runId : undefined,
                            parentId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                            createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
                            metadata: {
                                coreName: typeof parsed.coreName === 'string' ? parsed.coreName : id,
                                thumbnail: typeof parsed.thumbnail === 'string' ? parsed.thumbnail : undefined,
                                mediaLocalPath: typeof parsed.mediaLocalPath === 'string' ? parsed.mediaLocalPath : undefined,
                                parentCardId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                                mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                                name: typeof parsed.name === 'string' ? parsed.name : undefined,
                                createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
                                updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
                            },
                        } as any);
                    }
                }
            }
        }
    } catch {
        // ignore
    }

    return { length: core.length };
}

export async function getCoreLength(name: string) {
    let core = cores.get(name);
    if (!core) {
        const info = await createCore(name);
        core = cores.get(name);
        if (!core) {
            throw new Error(`Core ${name} not found after create (key=${info?.key})`);
        }
    }
    return core.length;
}

export async function readCore(name: string, options: { start?: number; end?: number; reverse?: boolean; limit?: number } = {}) {
    let core = cores.get(name);
    if (!core) {
        // Lazily open or create the core using the same path and swarm wiring as createCore.
        const info = await createCore(name);
        core = cores.get(name);
        if (!core) {
            throw new Error(`Core ${name} not found after create (key=${info?.key})`);
        }
    }

    const length = core.length;
    let { start, end, reverse, limit } = options;

    // If limit is provided but no end, calculate end
    if (limit !== undefined && end === undefined) {
        if (reverse) {
            // Reading backwards
            // If start is not provided, start from end (length)
            const from = start !== undefined ? start : length;
            const to = Math.max(0, from - limit);
            start = to;
            end = from;
        } else {
            // Reading forwards
            const from = start !== undefined ? start : 0;
            end = from + limit;
            start = from;
        }
    }

    const stream = core.createReadStream({
        start,
        end,
        reverse
    });

    const entries: string[] = [];
    for await (const block of stream) {
        entries.push(b4a.toString(block));
    }

    return entries;
}

export async function getP2PStats() {
    if (!swarm) return { peers: 0, publicKey: undefined };

    // Try to get key from card-library core if available
    let publicKey: string | undefined;
    const core = cores.get('card-library');
    if (core) {
        publicKey = b4a.toString(core.key, 'hex');
    }

    return {
        peers: swarm.connections.size,
        publicKey
    };
}
