import React, { useEffect, useMemo, useState } from 'react';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import { FloatingCard } from './cards/FloatingCard';
import { FormationHud } from './overlay/FormationHud';

export const DragCanvas: React.FC = () => {
  const { items, overlayLayout, setOverlayLayout, selectedItemId, setSelectedItemId, zOffsets, setZOffsets } = useDragCanvas();

  const [viewportTick, setViewportTick] = useState(0);
  const [recenterTick, setRecenterTick] = useState(0);
  const [showRecenterPulse, setShowRecenterPulse] = useState(false);

  const hasItems = items.length > 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;

      if (e.key === 'Escape') {
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
  }, [setOverlayLayout, setSelectedItemId]);

  useEffect(() => {
    const onResize = () => setViewportTick((v) => v + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showRecenterPulse) return;
    const to = window.setTimeout(() => setShowRecenterPulse(false), 650);
    return () => window.clearTimeout(to);
  }, [showRecenterPulse]);

  const targets = useMemo(() => {
    if (!hasItems) return new Map<string, any>();
    if (overlayLayout.mode === 'free') return new Map<string, any>();

    const N = items.length;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const refW = items.reduce((sum, it) => sum + (it.initialRect?.width ?? 0), 0) / Math.max(N, 1);

    const anchorX = vw * 0.5;
    const anchorY = Math.max(150, Math.floor(vh * 0.34));
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
        const radius = Math.min(220, Math.min(vw, vh) * 0.18);
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
  }, [hasItems, items, overlayLayout.hover, overlayLayout.mode, viewportTick, recenterTick]);

  const anchorPoint = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: vw * 0.5,
      y: Math.max(150, Math.floor(vh * 0.34)),
    };
  }, [viewportTick, recenterTick]);

  if (!hasItems) return null;

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none" style={{ perspective: '1200px' }}>
      <FormationHud
        overlayLayout={overlayLayout}
        setOverlayLayout={setOverlayLayout}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        zOffsets={zOffsets}
        setZOffsets={setZOffsets}
        itemCount={items.length}
        onRecenter={() => {
          setRecenterTick((v) => v + 1);
          setShowRecenterPulse(true);
        }}
      />

      {showRecenterPulse && overlayLayout.mode !== 'free' ? (
        <div
          key={recenterTick}
          className="fixed z-[100001] pointer-events-none"
          style={{ left: anchorPoint.x, top: anchorPoint.y }}
        >
          <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full border border-cyan-300/60 shadow-[0_0_18px_rgba(34,211,238,0.35)] animate-ping" />
          <div className="absolute -left-2.5 -top-2.5 w-5 h-5 rounded-full border border-cyan-200/60 bg-cyan-500/5" />
          <div className="absolute left-0 -top-4 w-px h-8 bg-cyan-200/50" />
          <div className="absolute -left-4 top-0 w-8 h-px bg-cyan-200/50" />
        </div>
      ) : null}

      {items.map(item => (
        <FloatingCard key={item.id} item={item} formationTarget={targets.get(item.id)} overlayLayout={overlayLayout} />
      ))}
    </div>
  );
};
