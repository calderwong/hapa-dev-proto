import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface DragItem {
  id: string;
  type: string;
  data: any;
  render: (data: any) => React.ReactNode;
  initialRect: DOMRect;
  startX: number;
  startY: number;
  tx?: number;
  ty?: number;
  homeTx?: number;
  homeTy?: number;
  pointerId?: number; // For transferring drag
  onClick?: (e: React.MouseEvent | React.PointerEvent | PointerEvent) => void; // For handling clicks
  portalColorMode?: PortalColorMode;
}

export interface SnapZone {
  id: string;
  rect: { left: number; top: number; width: number; height: number }; // standard object, not DOMRect instance
  threshold: number; // distance in px to trigger snap
  onSnap: (item: DragItem) => void;
}

export type OverlayFormationMode = 'free' | 'fan' | 'line' | 'stack' | 'arc' | 'ring' | 'square' | 'rect';

export type PortalTargetMode = 'hand-dock' | 'bottom-center' | 'custom';

export type PortalColorMode = 'blue' | 'red';

export interface OverlayLayoutState {
  mode: OverlayFormationMode;
  hover: boolean;
  portalTargetMode: PortalTargetMode;
  portalColorMode: PortalColorMode;
  portalTargetPoint: { x: number; y: number };
}

export type HudDockSide = 'left' | 'right';

export type HudDockState = {
  left: string[];
  right: string[];
};

export type CardPose = {
  tiltX: number;
  tiltY: number;
  rotZ: number;
  zoom: number;
  cameraMode: boolean;
};

export const DEFAULT_CARD_POSE: CardPose = {
  tiltX: 0,
  tiltY: 0,
  rotZ: 0,
  zoom: 1,
  cameraMode: false,
};

export const OVERLAY_CARD_Z_MIN = -600;
export const OVERLAY_CARD_Z_MAX = 800;
export const OVERLAY_CARD_Z_STEP = 240;

export function getOverlayZBaseline(mode: OverlayFormationMode, hover: boolean) {
  const baseZ = mode === 'stack' ? 140 : 100;
  const hoverLift = hover ? (mode === 'stack' ? 80 : 60) : 0;
  return { baseZ, hoverLift, baselineZ: baseZ + hoverLift };
}

function clampZOffsets(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    out[key] = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, raw));
  }
  return out;
}

interface DragCanvasContextType {
  items: DragItem[];
  spawnItem: (item: DragItem) => void;
  removeItem: (id: string) => void;
  updateItemPosition: (id: string, tx: number, ty: number) => void;
  registerSnapZone: (zone: SnapZone) => void;
  unregisterSnapZone: (id: string) => void;
  snapZones: SnapZone[];
  overlayLayout: OverlayLayoutState;
  setOverlayLayout: React.Dispatch<React.SetStateAction<OverlayLayoutState>>;
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  zOffsets: Record<string, number>;
  setZOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  poses: Record<string, CardPose>;
  setPoses: React.Dispatch<React.SetStateAction<Record<string, CardPose>>>;
  hudDock: HudDockState;
  setHudDock: React.Dispatch<React.SetStateAction<HudDockState>>;
  anchored: string[];
  setAnchored: React.Dispatch<React.SetStateAction<string[]>>;
}

const OVERLAY_PERSIST_KEY = 'hapa.overlayCards.v1';

type PersistedOverlayItem = {
  id: string;
  type: string;
  data: any;
  rect: { left: number; top: number; width: number; height: number };
  tx: number;
  ty: number;
  portalColorMode?: PortalColorMode;
};

type PersistedOverlayState = {
  items: PersistedOverlayItem[];
  overlayLayout: OverlayLayoutState;
  zOffsets: Record<string, number>;
  poses?: Record<string, CardPose>;
  hudDock?: HudDockState;
  anchored?: string[];
};

function renderPersistedCard(data: any) {
  const thumbnail = data?.thumbnail;
  const title = data?.name || data?.cardId || 'Card';
  return (
    <div className="relative w-full h-full rounded-md overflow-hidden border border-cyan-500/30 bg-gray-900/80 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
      {thumbnail ? (
        <img src={thumbnail} alt={title} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
          <div className="w-6 h-6 rounded border border-gray-600 bg-gray-800/50" />
        </div>
      )}
    </div>
  );
}

function rendererForType(type: string): (data: any) => React.ReactNode {
  if (type === 'HAND_CARD') return renderPersistedCard;
  if (type === 'LIBRARY_CARD') return renderPersistedCard;
  return renderPersistedCard;
}

function minimizeData(type: string, data: any) {
  if (!data) return data;
  if (type === 'HAND_CARD' || type === 'LIBRARY_CARD') {
    return {
      cardId: data.cardId,
      name: data.name,
      thumbnail: data.thumbnail,
      mediaKind: data.mediaKind,
      createdAt: data.createdAt,
      tier: data.tier,
    };
  }
  return data;
}

const DragCanvasContext = createContext<DragCanvasContextType | undefined>(undefined);

export const DragCanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<DragItem[]>([]);
  const [snapZones, setSnapZones] = useState<SnapZone[]>([]);
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayoutState>({ mode: 'free', hover: false, portalTargetMode: 'bottom-center', portalColorMode: 'blue', portalTargetPoint: { x: window.innerWidth / 2, y: window.innerHeight - 26 } });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zOffsets, setZOffsets] = useState<Record<string, number>>({});
  const [poses, setPoses] = useState<Record<string, CardPose>>({});
  const [hudDock, setHudDock] = useState<HudDockState>({ left: [], right: [] });
  const [anchored, setAnchored] = useState<string[]>([]);

  const didHydrateRef = useRef(false);

  const spawnItem = useCallback((item: DragItem) => {
    setItems(prev => {
      const existing = prev.some(p => p.id === item.id);
      if (existing) return prev;

      // Normalize coordinate system so overlay positions are absolute in viewport space.
      // We do this by folding any base left/top into tx/ty and pinning initialRect.left/top to 0.
      const baseLeft = item.initialRect?.left ?? 0;
      const baseTop = item.initialRect?.top ?? 0;
      const w = item.initialRect?.width ?? 0;
      const h = item.initialRect?.height ?? 0;
      const normalizedRect = new DOMRect(0, 0, w, h);
      const txAbs = (item.tx ?? 0) + baseLeft;
      const tyAbs = (item.ty ?? 0) + baseTop;

      const homeTx = item.homeTx ?? txAbs;
      const homeTy = item.homeTy ?? tyAbs;

      return [...prev, { ...item, initialRect: normalizedRect, tx: txAbs, ty: tyAbs, homeTx, homeTy }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedItemId(prev => (prev === id ? null : prev));
    setZOffsets(prev => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setHudDock((prev) => {
      if (!prev.left.includes(id) && !prev.right.includes(id)) return prev;
      return {
        left: prev.left.filter((x) => x !== id),
        right: prev.right.filter((x) => x !== id),
      };
    });
    setAnchored((prev) => prev.filter((x) => x !== id));
  }, []);

  const updateItemPosition = useCallback((id: string, tx: number, ty: number) => {
    setItems(prev => prev.map(i => (i.id === id ? ({ ...i, tx, ty }) : i)));
  }, []);

  const registerSnapZone = useCallback((zone: SnapZone) => {
    setSnapZones(prev => {
      // update if exists, else add
      const idx = prev.findIndex(z => z.id === zone.id);
      if (idx >= 0) {
        const newZones = [...prev];
        newZones[idx] = zone;
        return newZones;
      }
      return [...prev, zone];
    });
  }, []);

  const unregisterSnapZone = useCallback((id: string) => {
    setSnapZones(prev => prev.filter(z => z.id !== id));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OVERLAY_PERSIST_KEY);
      if (!raw) {
        didHydrateRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as PersistedOverlayState;
      const restoredItems: DragItem[] = Array.isArray(parsed?.items)
        ? parsed.items.map((p) => {
            // Migrate persisted items to absolute viewport positioning.
            // Older persisted state used (rect.left/top + tx/ty) as a two-part position.
            // New state uses tx/ty as absolute viewport space; rect.left/top is always 0.
            const rect = new DOMRect(0, 0, p.rect.width, p.rect.height);
            const txAbs = (p.tx ?? 0) + (p.rect?.left ?? 0);
            const tyAbs = (p.ty ?? 0) + (p.rect?.top ?? 0);
            return {
              id: p.id,
              type: p.type,
              data: p.data,
              render: rendererForType(p.type),
              initialRect: rect,
              startX: 0,
              startY: 0,
              tx: txAbs,
              ty: tyAbs,
              homeTx: txAbs,
              homeTy: tyAbs,
              portalColorMode: p.portalColorMode === 'red' ? 'red' : (p.portalColorMode === 'blue' ? 'blue' : undefined),
            };
          })
        : [];

      if (parsed?.overlayLayout) {
        const o: any = parsed.overlayLayout;
        const portalTargetMode: PortalTargetMode = 'bottom-center';
        const portalColorMode: PortalColorMode = o.portalColorMode === 'red' ? 'red' : 'blue';
        const portalTargetPoint = { x: window.innerWidth / 2, y: window.innerHeight - 26 };
        setOverlayLayout({ mode: o.mode ?? 'free', hover: !!o.hover, portalTargetMode, portalColorMode, portalTargetPoint });
      }
      if (parsed?.zOffsets) setZOffsets(clampZOffsets(parsed.zOffsets));
      if (parsed?.poses) setPoses(parsed.poses);
      if (parsed?.hudDock) {
        const d: any = parsed.hudDock;
        const left = Array.isArray(d.left) ? d.left.map((x: any) => String(x)) : [];
        const right = Array.isArray(d.right) ? d.right.map((x: any) => String(x)) : [];
        setHudDock({ left, right });
      }
      if (parsed?.anchored) {
        const a: any = parsed.anchored;
        const ids = Array.isArray(a) ? a.map((x: any) => String(x)) : [];
        setAnchored(ids);
      }
      if (restoredItems.length > 0) setItems(restoredItems);
    } catch {
      // ignore
    } finally {
      didHydrateRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current) return;

    try {
      const persisted: PersistedOverlayState = {
        items: items.map((i) => ({
          id: i.id,
          type: i.type,
          data: minimizeData(i.type, i.data),
          rect: {
            left: 0,
            top: 0,
            width: i.initialRect.width,
            height: i.initialRect.height,
          },
          tx: i.tx ?? 0,
          ty: i.ty ?? 0,
          portalColorMode: i.portalColorMode,
        })),
        overlayLayout,
        zOffsets: clampZOffsets(zOffsets),
        poses,
        hudDock,
        anchored,
      };
      window.localStorage.setItem(OVERLAY_PERSIST_KEY, JSON.stringify(persisted));
    } catch {
      // ignore
    }
  }, [items, overlayLayout, zOffsets, poses, hudDock, anchored]);

  return (
    <DragCanvasContext.Provider 
      value={{ 
        items,
        spawnItem,
        removeItem,
        updateItemPosition,
        registerSnapZone,
        unregisterSnapZone,
        snapZones,
        overlayLayout,
        setOverlayLayout,
        selectedItemId,
        setSelectedItemId,
        zOffsets,
        setZOffsets,
        poses,
        setPoses,
        hudDock,
        setHudDock,
        anchored,
        setAnchored
      }}
    >
      {children}
    </DragCanvasContext.Provider>
  );
};

export const useDragCanvas = () => {
  const context = useContext(DragCanvasContext);
  if (!context) {
    throw new Error('useDragCanvas must be used within a DragCanvasProvider');
  }
  return context;
};
