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

export type OverlayFormationMode = 'free' | 'fan' | 'line' | 'stack' | 'arc' | 'ring';

export type PortalTargetMode = 'hand-dock' | 'bottom-center' | 'custom';

export type PortalColorMode = 'blue' | 'red';

export interface OverlayLayoutState {
  mode: OverlayFormationMode;
  hover: boolean;
  portalTargetMode: PortalTargetMode;
  portalColorMode: PortalColorMode;
  portalTargetPoint: { x: number; y: number };
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
  const [overlayLayout, setOverlayLayout] = useState<OverlayLayoutState>({ mode: 'free', hover: false, portalTargetMode: 'hand-dock', portalColorMode: 'blue', portalTargetPoint: { x: window.innerWidth / 2, y: window.innerHeight - 26 } });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zOffsets, setZOffsets] = useState<Record<string, number>>({});

  const didHydrateRef = useRef(false);

  const spawnItem = useCallback((item: DragItem) => {
    setItems(prev => {
      const existing = prev.some(p => p.id === item.id);
      if (existing) return prev;
      return [...prev, { ...item, tx: item.tx ?? 0, ty: item.ty ?? 0 }];
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
            const rect = new DOMRect(p.rect.left, p.rect.top, p.rect.width, p.rect.height);
            return {
              id: p.id,
              type: p.type,
              data: p.data,
              render: rendererForType(p.type),
              initialRect: rect,
              startX: 0,
              startY: 0,
              tx: p.tx,
              ty: p.ty,
              portalColorMode: p.portalColorMode === 'red' ? 'red' : (p.portalColorMode === 'blue' ? 'blue' : undefined),
            };
          })
        : [];

      if (parsed?.overlayLayout) {
        const o: any = parsed.overlayLayout;
        const portalTargetMode: PortalTargetMode = o.portalTargetMode === 'bottom-center' ? 'bottom-center' : (o.portalTargetMode === 'custom' ? 'custom' : 'hand-dock');
        const portalColorMode: PortalColorMode = o.portalColorMode === 'red' ? 'red' : 'blue';
        const portalTargetPoint =
          o.portalTargetPoint && typeof o.portalTargetPoint.x === 'number' && typeof o.portalTargetPoint.y === 'number'
            ? { x: o.portalTargetPoint.x, y: o.portalTargetPoint.y }
            : { x: window.innerWidth / 2, y: window.innerHeight - 26 };
        setOverlayLayout({ mode: o.mode ?? 'free', hover: !!o.hover, portalTargetMode, portalColorMode, portalTargetPoint });
      }
      if (parsed?.zOffsets) setZOffsets(parsed.zOffsets);
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
            left: i.initialRect.left,
            top: i.initialRect.top,
            width: i.initialRect.width,
            height: i.initialRect.height,
          },
          tx: i.tx ?? 0,
          ty: i.ty ?? 0,
          portalColorMode: i.portalColorMode,
        })),
        overlayLayout,
        zOffsets,
      };
      window.localStorage.setItem(OVERLAY_PERSIST_KEY, JSON.stringify(persisted));
    } catch {
      // ignore
    }
  }, [items, overlayLayout, zOffsets]);

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
        setZOffsets
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
