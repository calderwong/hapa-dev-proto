import { getCoreLength, getP2PStats, getStorageDir } from './p2p';
import { getPersistence, getPersistenceMetaValue } from './persistence';

const CARD_LIBRARY_CORE_NAME = 'card-library';
const WIKI_CORE_NAME = 'wormhole-wiki-entries';
const CARD_LIBRARY_CHECKPOINT_KEY = 'card_library_index_last_seq';

export type DiagnosticsSnapshot = {
  time: string;
  storageDir: string;
  cwd: string;
  p2p: {
    peers: number;
    publicKey?: string;
  };
  cardLibrary: {
    coreName: string;
    hypercoreLength: number;
    sqlite: {
      ready: boolean;
      checkpointKey: string;
      checkpoint: number | null;
      caughtUp: boolean;
      stats: any | null;
    };
    paging: {
      mode: 'sqlite' | 'hypercore';
      reason: string;
    };
  };
  wiki: {
    coreName: string;
    hypercoreLength: number;
  };
};

const parseFiniteInt = (value: string | null): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const time = new Date().toISOString();
  const storageDir = getStorageDir();
  const cwd = process.cwd();
  const p2p = await getP2PStats();

  let cardLibraryLength = 0;
  let wikiLength = 0;

  try {
    const len = await getCoreLength(CARD_LIBRARY_CORE_NAME);
    if (typeof len === 'number' && Number.isFinite(len)) {
      cardLibraryLength = len;
    }
  } catch {
    // ignore
  }

  try {
    const len = await getCoreLength(WIKI_CORE_NAME);
    if (typeof len === 'number' && Number.isFinite(len)) {
      wikiLength = len;
    }
  } catch {
    // ignore
  }

  const adapter: any = getPersistence();
  const ready = !!(adapter && typeof adapter.isReady === 'function' && adapter.isReady());

  let stats: any | null = null;
  if (ready && typeof adapter.getStats === 'function') {
    try {
      stats = await adapter.getStats();
    } catch {
      stats = null;
    }
  }

  const checkpoint = parseFiniteInt(getPersistenceMetaValue(CARD_LIBRARY_CHECKPOINT_KEY));
  const caughtUp = !!(cardLibraryLength > 0 && typeof checkpoint === 'number' && checkpoint >= cardLibraryLength);

  let mode: 'sqlite' | 'hypercore' = 'hypercore';
  let reason = 'persistence_not_ready';

  if (ready) {
    if (caughtUp) {
      mode = 'sqlite';
      reason = 'persistence_index_caught_up';
    } else {
      mode = 'hypercore';
      reason = 'persistence_index_incomplete';
    }
  }

  return {
    time,
    storageDir,
    cwd,
    p2p,
    cardLibrary: {
      coreName: CARD_LIBRARY_CORE_NAME,
      hypercoreLength: cardLibraryLength,
      sqlite: {
        ready,
        checkpointKey: CARD_LIBRARY_CHECKPOINT_KEY,
        checkpoint,
        caughtUp,
        stats,
      },
      paging: {
        mode,
        reason,
      },
    },
    wiki: {
      coreName: WIKI_CORE_NAME,
      hypercoreLength: wikiLength,
    },
  };
}
