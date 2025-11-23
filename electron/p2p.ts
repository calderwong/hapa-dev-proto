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
        await swarm.flush();
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

export async function readCore(name: string) {
    const core = cores.get(name);
    if (!core) {
        throw new Error(`Core ${name} not found`);
    }

    const entries: string[] = [];
    for (let i = 0; i < core.length; i++) {
        const block = await core.get(i);
        entries.push(b4a.toString(block));
    }

    return entries;
}
