import Hypercore from 'hypercore';
import Hyperswarm from 'hyperswarm';
import * as b4a from 'b4a';

const cores = new Map<string, any>();
let swarm: any;

export function initP2P() {
    swarm = new Hyperswarm();
    console.log('P2P initialized');
}

export async function createCore(name: string) {
    const core = new Hypercore('./storage/' + name);
    await core.ready();

    cores.set(name, core);

    swarm.on('connection', (conn: any, info: any) => {
        const stream = core.replicate(conn);
        stream.on('error', (err: any) => console.error('Replication error:', err));
    });

    swarm.join(core.discoveryKey);
    await swarm.flush();

    return { key: b4a.toString(core.key, 'hex'), length: core.length };
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
