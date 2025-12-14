import React, { useEffect, useMemo, useState } from 'react';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import { FloatingCard } from './cards/FloatingCard';

export const DragCanvas: React.FC = () => {
  const { items, overlayLayout, setOverlayLayout, selectedItemId, setSelectedItemId, zOffsets, setZOffsets, snapZones } = useDragCanvas();
  const [isPickingPortalTarget, setIsPickingPortalTarget] = useState(false);
  const [pickCursor, setPickCursor] = useState<{ x: number; y: number } | null>(null);

  const hasItems = items.length > 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;

      if (e.key === 'Escape') {
        if (isPickingPortalTarget) {
          setIsPickingPortalTarget(false);
          return;
        }
        setSelectedItemId(null);
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setOverlayLayout(v => ({ ...v, hover: !v.hover }));
        return;
      }

      if (e.key === '0') {
        setOverlayLayout(v => ({ ...v, mode: 'free' }));
        return;
      }

      if (e.key === '1') {
        setOverlayLayout(v => ({ ...v, mode: 'fan' }));
        return;
      }
      if (e.key === '2') {
        setOverlayLayout(v => ({ ...v, mode: 'line' }));
        return;
      }
      if (e.key === '3') {
        setOverlayLayout(v => ({ ...v, mode: 'stack' }));
        return;
      }
      if (e.key === '4') {
        setOverlayLayout(v => ({ ...v, mode: 'arc' }));
        return;
      }
      if (e.key === '5') {
        setOverlayLayout(v => ({ ...v, mode: 'ring' }));
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPickingPortalTarget, setIsPickingPortalTarget, setOverlayLayout, setSelectedItemId]);

  const targets = useMemo(() => {
    if (!hasItems) return new Map<string, any>();
    if (overlayLayout.mode === 'free') return new Map<string, any>();

    const N = items.length;
    const vw = window.innerWidth;
    const dock = snapZones.find(z => z.id === 'hand-dock');
    const dockCx = dock ? dock.rect.left + dock.rect.width / 2 : undefined;
    const dockTop = dock ? dock.rect.top : undefined;

    const refW = items.reduce((sum, it) => sum + (it.initialRect?.width ?? 0), 0) / Math.max(N, 1);

    const anchorX = dockCx ?? vw * 0.5;
    const anchorY = Math.max(70, (dockTop ?? 110) - 160);
    const gap = 28;

    const map = new Map<string, { tx: number; ty: number; tz: number; rotZ: number }>();

    for (let i = 0; i < N; i++) {
      const item = items[i];
      const w = item.initialRect.width;
      const h = item.initialRect.height;
      const t = N <= 1 ? 0 : (i - (N - 1) / 2) / ((N - 1) / 2);

      let targetCenterX = anchorX;
      let targetCenterY = anchorY;
      let rotZ = 0;

      if (overlayLayout.mode === 'fan') {
        targetCenterX = anchorX + t * (refW + gap) * 1.2;
        targetCenterY = anchorY + Math.abs(t) * 18;
        rotZ = t * -18;
      } else if (overlayLayout.mode === 'line') {
        targetCenterX = anchorX + t * (refW + gap) * 1.15;
        targetCenterY = anchorY;
        rotZ = 0;
      } else if (overlayLayout.mode === 'stack') {
        targetCenterX = anchorX;
        targetCenterY = anchorY;
        rotZ = (i - (N - 1) / 2) * 3;
      } else if (overlayLayout.mode === 'arc') {
        const radius = Math.min(420, vw * 0.35);
        const a = t * 0.8;
        targetCenterX = anchorX + Math.sin(a) * radius;
        targetCenterY = anchorY + (1 - Math.cos(a)) * 140;
        rotZ = -a * 22;
      } else if (overlayLayout.mode === 'ring') {
        const radius = Math.min(220, vw * 0.18);
        const a = (i / Math.max(N, 1)) * Math.PI * 2;
        targetCenterX = anchorX + Math.cos(a) * radius;
        targetCenterY = anchorY + Math.sin(a) * radius;
        rotZ = 0;
      }

      const targetLeft = targetCenterX - w / 2;
      const targetTop = targetCenterY - h / 2;

      const tx = targetLeft - item.initialRect.left;
      const ty = targetTop - item.initialRect.top;

      const baseZ = overlayLayout.hover ? 140 : 0;
      const tz = overlayLayout.mode === 'stack' ? baseZ + i * 18 : baseZ + i * 4;

      map.set(item.id, { tx, ty, tz, rotZ });
    }

    return map;
  }, [hasItems, items, overlayLayout.hover, overlayLayout.mode, snapZones]);

  if (!hasItems) return null;

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none" style={{ perspective: '1200px' }}>
      {isPickingPortalTarget && (
        <div
          className="fixed inset-0 z-[100010] pointer-events-auto"
          onMouseMove={(e) => setPickCursor({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setPickCursor(null)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOverlayLayout(v => ({ ...v, portalTargetMode: 'custom', portalTargetPoint: { x: e.clientX, y: e.clientY } }));
            setIsPickingPortalTarget(false);
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl bg-gray-950/90 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Pick Portal Target</div>
            <div className="text-[10px] font-mono text-gray-400">Click anywhere to set “That Place”.</div>
            <div className="text-[10px] font-mono text-gray-500">Esc to cancel</div>
          </div>
          {pickCursor && (
            <div
              className="absolute pointer-events-none"
              style={{ left: pickCursor.x, top: pickCursor.y, transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-10 h-10 rounded-full border border-cyan-300/60 shadow-[0_0_20px_rgba(34,211,238,0.25)]" />
              <div className="absolute left-1/2 top-0 w-px h-full -translate-x-1/2 bg-cyan-300/25" />
              <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-cyan-300/25" />
            </div>
          )}
        </div>
      )}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100000] pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-950/80 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-sm">
          <button
            onClick={() => setOverlayLayout(v => ({ ...v, hover: !v.hover }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.hover ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Hover
          </button>

          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'free' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'free' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Free
          </button>

          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'fan' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'fan' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Fan
          </button>
          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'line' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'line' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Line
          </button>
          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'stack' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'stack' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Stack
          </button>
          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'arc' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'arc' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Arc
          </button>
          <button
            onClick={() => setOverlayLayout(v => ({ ...v, mode: 'ring' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.mode === 'ring' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Ring
          </button>

          <button
            onClick={() => setOverlayLayout(v => ({ ...v, portalTargetMode: v.portalTargetMode === 'hand-dock' ? 'bottom-center' : 'hand-dock' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.portalTargetMode === 'hand-dock' ? 'bg-purple-600 text-white border-purple-400' : 'bg-purple-600/10 text-purple-200 border-purple-500/40'}`}
          >
            Portal: {overlayLayout.portalTargetMode === 'hand-dock' ? 'Hand' : 'Bottom'}
          </button>

          <button
            onClick={() => {
              setOverlayLayout(v => ({ ...v, portalTargetMode: 'custom' }));
              setIsPickingPortalTarget(true);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.portalTargetMode === 'custom' ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          >
            Target
          </button>

          <button
            onClick={() => setOverlayLayout(v => ({ ...v, portalColorMode: v.portalColorMode === 'blue' ? 'red' : 'blue' }))}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${overlayLayout.portalColorMode === 'red' ? 'bg-red-600 text-white border-red-400' : 'bg-cyan-600 text-white border-cyan-400'}`}
          >
            Color: {overlayLayout.portalColorMode === 'red' ? 'Red' : 'Blue'}
          </button>

          <div className="w-px h-6 bg-gray-700/60 mx-1" />

          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
              {selectedItemId ? (
                <>SEL: <span className="text-cyan-300">{selectedItemId.slice(0, 8)}</span> Z: <span className="text-cyan-300">{Math.round(zOffsets[selectedItemId] ?? 0)}</span></>
              ) : (
                <>SEL: <span className="text-gray-500">none</span> (Shift+Click)</>
              )}
            </div>

            <button
              onClick={() => {
                if (!selectedItemId) return;
                setZOffsets(prev => {
                  const { [selectedItemId]: _removed, ...rest } = prev;
                  return rest;
                });
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${selectedItemId ? 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800' : 'bg-gray-900/30 text-gray-600 border-gray-800 cursor-not-allowed'}`}
              disabled={!selectedItemId}
            >
              Z Reset
            </button>

            <button
              onClick={() => setSelectedItemId(null)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${selectedItemId ? 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-800' : 'bg-gray-900/30 text-gray-600 border-gray-800 cursor-not-allowed'}`}
              disabled={!selectedItemId}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {items.map(item => (
        <FloatingCard key={item.id} item={item} formationTarget={targets.get(item.id)} overlayLayout={overlayLayout} />
      ))}
    </div>
  );
};
