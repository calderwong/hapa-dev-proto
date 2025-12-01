import Hypercore from 'hypercore';
import Hyperswarm from 'hyperswarm';
import * as b4a from 'b4a';

const cores = new Map<string, any>();
let swarm: any;
let swarmInitialized = false;
const joinedTopics = new Set<string>();

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
        core = new Hypercore('./storage/' + name);
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

    await core.append(data);
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
