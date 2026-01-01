import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AstraForgeApp from './AstraForgeApp';
import type { ShipData } from './types';

import { getLibraryItem } from '@/shared/storage/library';
import type { HapaBundle } from '@/shared/export/hapaBundle';

type ImportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; ship: ShipData };

const isRecord = (v: unknown): v is Record<string, any> => {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

const tryParseJsonFromString = (text: string): unknown | null => {
  // Attempt strict JSON first
  try {
    return JSON.parse(text);
  } catch {
    // Heuristic fallback: extract the first balanced-ish object block.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    return null;
  }
};

const tryParseJsonFromDataUrl = (dataUrl: string): unknown | null => {
  if (!dataUrl.startsWith('data:')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;

  const meta = dataUrl.slice(5, comma); // after 'data:'
  const payload = dataUrl.slice(comma + 1);
  try {
    const decoded = meta.includes(';base64') ? atob(payload) : decodeURIComponent(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const coerceShipData = (raw: unknown, bundle?: HapaBundle, stableFallbackId?: string): ShipData | null => {
  if (!isRecord(raw)) return null;

  const firstImage = bundle?.assets?.find((a) => a.type === 'image' && a.dataUrl)?.dataUrl;
  const firstVideo = bundle?.assets?.find((a) => a.type === 'video' && a.url)?.url;

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id
      : (stableFallbackId && stableFallbackId.trim() ? stableFallbackId : crypto.randomUUID());
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'IMPORTED VESSEL';
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();

  return {
    id,
    name,
    parts: Array.isArray(raw.parts) ? (raw.parts as any) : [],
    hullVisuals: (raw as any).hullVisuals ?? null,
    conceptImageUrl: (raw as any).conceptImageUrl ?? firstImage ?? null,
    videoUrl: (raw as any).videoUrl ?? firstVideo ?? null,
    analysis: (raw as any).analysis ?? null,
    createdAt,
    shipRotation: typeof (raw as any).shipRotation === 'number' ? (raw as any).shipRotation : 0,
    bridgeSnapshots: Array.isArray((raw as any).bridgeSnapshots) ? (raw as any).bridgeSnapshots : [],
  };
};

const extractShipFromBundle = async (
  bundle: HapaBundle,
  stableFallbackId?: string
): Promise<ShipData | null> => {
  // Preferred locations
  const direct = bundle.outputs?.ship ?? bundle.outputs?.shipData ?? bundle.outputs?.shipManifest;
  const directCoerced = coerceShipData(direct, bundle, stableFallbackId);
  if (directCoerced) return directCoerced;

  // Some bundles may store the ship output as a serialized JSON string.
  if (typeof direct === 'string') {
    const parsed = tryParseJsonFromString(direct);
    const parsedCoerced = coerceShipData(parsed, bundle, stableFallbackId);
    if (parsedCoerced) return parsedCoerced;
  }

  // Fallback: try to parse a JSON asset
  const isJsonishAsset = (a: any): boolean => {
    const mt = typeof a?.mimeType === 'string' ? a.mimeType.toLowerCase() : '';
    const name = typeof a?.name === 'string' ? a.name.toLowerCase() : '';
    return a?.type === 'json' || mt.includes('json') || name.endsWith('.json');
  };

  const jsonAsset = (bundle.assets || []).find(
    (a) => isJsonishAsset(a) && (typeof a.dataUrl === 'string' || typeof a.url === 'string')
  );
  if (!jsonAsset) return null;

  const src = jsonAsset.dataUrl || jsonAsset.url;
  if (!src) return null;

  try {
    // If this is a data: URL, parse locally to avoid fetch quirks.
    const parsed = src.startsWith('data:') ? tryParseJsonFromDataUrl(src) : null;
    const finalParsed = parsed ?? (await (await fetch(src)).json());

    // Parsed might be a manifest, or a bundle, or a wrapper
    if (isRecord(finalParsed) && (finalParsed as any).version === '1.0' && (finalParsed as any).outputs) {
      const b = finalParsed as HapaBundle;
      return coerceShipData(
        b.outputs?.ship ?? b.outputs?.shipData ?? b.outputs?.shipManifest,
        b,
        stableFallbackId
      );
    }

    return (
      coerceShipData((finalParsed as any)?.ship, bundle, stableFallbackId) ||
      coerceShipData((finalParsed as any)?.shipData, bundle, stableFallbackId) ||
      coerceShipData(finalParsed, bundle, stableFallbackId)
    );
  } catch {
    return null;
  }
};

export default function ShipStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const libraryItemId = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('libraryItemId');
  }, [location.search]);

  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!libraryItemId) {
        setImportState({ status: 'idle' });
        return;
      }

      setImportState({ status: 'loading' });

      const item = getLibraryItem(libraryItemId);
      if (!item) {
        if (!alive) return;
        setImportState({
          status: 'error',
          message: `No library item found for id: ${libraryItemId}`,
        });
        return;
      }

      if (item.kind !== 'ship') {
        if (!alive) return;
        setImportState({
          status: 'error',
          message: `Library item is not a ship (kind=${item.kind}).`,
        });
        return;
      }

      const ship = await extractShipFromBundle(item.bundle, `imported-${libraryItemId}`);
      if (!alive) return;

      if (!ship) {
        setImportState({
          status: 'error',
          message:
            'Could not extract ShipData from this bundle. Expected bundle.outputs.ship (or shipData), or a JSON asset containing a ship manifest.',
        });
        return;
      }

      setImportState({ status: 'ready', ship });
    };

    run();
    return () => {
      alive = false;
    };
  }, [libraryItemId]);

  return (
    <div className="h-full w-full relative">
      {importState.status === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="glass-panel rounded-xl p-6 border border-white/10 text-slate-200">
            <div className="font-orbitron text-sm">Importing ship from Library…</div>
            <div className="text-xs text-slate-400 mt-2">{libraryItemId}</div>
          </div>
        </div>
      )}

      {importState.status === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm text-slate-100">
          <div className="max-w-xl w-full mx-6 glass-panel rounded-xl p-6 border border-white/10">
            <div className="font-orbitron text-lg text-white">Ship Import Error</div>
            <div className="text-sm text-slate-300 mt-2">{importState.message}</div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/library"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
              >
                Back to Library
              </Link>
              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-xs text-hapa-blue hover:bg-hapa-blue/30"
                onClick={() => navigate('/ship')}
              >
                Continue without import
              </button>
            </div>
          </div>
        </div>
      )}

      <AstraForgeApp
        importShipData={importState.status === 'ready' ? importState.ship : undefined}
        importSourceId={libraryItemId || undefined}
      />
    </div>
  );
}
