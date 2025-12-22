import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import { getOverlayZBaseline, OVERLAY_CARD_Z_MAX, OVERLAY_CARD_Z_MIN, OVERLAY_CARD_Z_STEP } from '../contexts/DragCanvasContext';
import { FloatingCard } from './cards/FloatingCard';
import { FormationHud } from './overlay/FormationHud';
import { AttachedOverlayCardDetails } from './cards/AttachedOverlayCardDetails';
import { playCardDepthNudgeSound } from '../utils/audio';

export const DragCanvas: React.FC = () => {
  const {
    items,
    overlayLayout,
    setOverlayLayout,
    selectedItemId,
    setSelectedItemId,
    zOffsets,
    setZOffsets,
    updateItemPosition,
    removeItem,
    setPoses,
    hudDock,
    setHudDock,
    anchored,
    setAnchored,
  } = useDragCanvas();

  const selectedItemIdRef = useRef<string | null>(selectedItemId);
  const setZOffsetsRef = useRef(setZOffsets);
  const removeItemRef = useRef(removeItem);
  const setPosesRef = useRef(setPoses);
  const setOverlayLayoutRef = useRef(setOverlayLayout);
  const setSelectedItemIdRef = useRef(setSelectedItemId);
  const setHudDockRef = useRef(setHudDock);
  const setAnchoredRef = useRef(setAnchored);
  const updateItemPositionRef = useRef(updateItemPosition);
  const anchoredRef = useRef(anchored);
  const sfxRef = useRef<{ lastNudgeAt: number }>({ lastNudgeAt: 0 });

  const [viewportTick, setViewportTick] = useState(0);
  const [recenterTick, setRecenterTick] = useState(0);
  const [showRecenterPulse, setShowRecenterPulse] = useState(false);
  const [hudRect, setHudRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const dragCountRef = useRef(0);
  const AUTO_PIN_ON_DRAG_KEY = 'hapa.overlayDetails.autoPinOnDrag.v1';

  const hasItems = items.length > 0;

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
    setZOffsetsRef.current = setZOffsets;
    updateItemPositionRef.current = updateItemPosition;
    removeItemRef.current = removeItem;
    setPosesRef.current = setPoses;
    setOverlayLayoutRef.current = setOverlayLayout;
    setSelectedItemIdRef.current = setSelectedItemId;
    setHudDockRef.current = setHudDock;
    setAnchoredRef.current = setAnchored;
    anchoredRef.current = anchored;
  }, [selectedItemId, setZOffsets, updateItemPosition, removeItem, setPoses, setOverlayLayout, setSelectedItemId, setHudDock, setAnchored, anchored]);

  useEffect(() => {
    const onDrag = (e: Event) => {
      const ev = e as CustomEvent<{ dragging?: boolean }>;
      const dragging = !!ev?.detail?.dragging;

      if (dragging) {
        dragCountRef.current += 1;
        return;
      }

      dragCountRef.current = Math.max(0, dragCountRef.current - 1);
    };

    window.addEventListener('hapa.overlayCard.drag', onDrag as EventListener);
    return () => window.removeEventListener('hapa.overlayCard.drag', onDrag as EventListener);
  }, []);

  useEffect(() => {
    const parseBool = (raw: string | null) => {
      if (!raw) return false;
      return raw === '1' || raw === 'true';
    };

    const onAutoSet = (e: Event) => {
      const ev = e as CustomEvent<{ value?: boolean }>;
      const nextRaw = ev?.detail?.value;
      const next = typeof nextRaw === 'boolean' ? nextRaw : !!nextRaw;

      try {
        window.localStorage.setItem(AUTO_PIN_ON_DRAG_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }

      window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.changed', { detail: { value: next } }));
    };

    window.addEventListener('hapa.overlayDetails.autoPinOnDrag.set', onAutoSet as EventListener);

    // Publish the current value so the HUD can sync even if details panel is not mounted.
    try {
      const current = parseBool(window.localStorage.getItem(AUTO_PIN_ON_DRAG_KEY));
      window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.changed', { detail: { value: current } }));
    } catch {
      // ignore
    }

    return () => window.removeEventListener('hapa.overlayDetails.autoPinOnDrag.set', onAutoSet as EventListener);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.ctrlKey && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        window.dispatchEvent(new Event('hapa.overlayHud.reset'));
        return;
      }

      if (e.metaKey || e.altKey) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;

      const selectedId = selectedItemIdRef.current;

      if (e.key === 'o' || e.key === 'O') {
        // Global toggle for Auto-pin while dragging. Ignore while actively dragging.
        if (dragCountRef.current > 0) return;
        e.preventDefault();

        const current = (() => {
          try {
            const raw = window.localStorage.getItem(AUTO_PIN_ON_DRAG_KEY);
            return raw === '1' || raw === 'true';
          } catch {
            return false;
          }
        })();

        const next = !current;
        window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.set', { detail: { value: next } }));
        return;
      }

      if (selectedId && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const side = e.key === 'ArrowLeft' ? 'left' : 'right';
        setAnchoredRef.current((prev) => prev.filter((x) => x !== selectedId));
        setHudDockRef.current((prev) => {
          const without = {
            left: prev.left.filter((x) => x !== selectedId),
            right: prev.right.filter((x) => x !== selectedId),
          };
          const nextSide = [selectedId, ...(without[side] || [])].slice(0, 6);
          return side === 'left'
            ? { left: nextSide, right: without.right }
            : { left: without.left, right: nextSide };
        });
        return;
      }

      if (selectedId && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        setHudDockRef.current((prev) => ({
          left: prev.left.filter((x) => x !== selectedId),
          right: prev.right.filter((x) => x !== selectedId),
        }));
        return;
      }

      if (selectedId && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();

        const currentlyAnchored = anchoredRef.current.includes(selectedId);
        if (!currentlyAnchored) {
          try {
            const el = document.querySelector(`[data-overlay-card-id="${selectedId}"]`) as HTMLElement | null;
            if (el) {
              const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
              if (Number.isFinite(m.m41) && Number.isFinite(m.m42)) {
                updateItemPositionRef.current(selectedId, m.m41, m.m42);
              }
            }
          } catch {
            // ignore
          }

          setAnchoredRef.current((prev) => (prev.includes(selectedId) ? prev : [...prev, selectedId]));
        } else {
          setAnchoredRef.current((prev) => prev.filter((x) => x !== selectedId));
        }
        return;
      }

      if (selectedId && (e.key === '[' || e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;
        setZOffsetsRef.current((prev) => {
          const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, (prev[selectedId] ?? 0) - step));
          return { ...prev, [selectedId]: next };
        });
        return;
      }

      if (selectedId && (e.key === ']' || e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;
        setZOffsetsRef.current((prev) => {
          const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, (prev[selectedId] ?? 0) + step));
          return { ...prev, [selectedId]: next };
        });
        return;
      }

      if (selectedId && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        removeItemRef.current(selectedId);
        return;
      }

      if (selectedId && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setPosesRef.current((prev) => {
          const current = prev[selectedId] || {};
          return { ...prev, [selectedId]: { ...current, cameraMode: !current.cameraMode } };
        });
        return;
      }

      if (e.key === 'Escape') {
        setSelectedItemIdRef.current(null);
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setOverlayLayoutRef.current((v) => ({ ...v, hover: !v.hover }));
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        window.dispatchEvent(new Event('hapa.overlayHud.reset'));
        return;
      }

      if (e.key === '0') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'free' }));
        return;
      }

      if (e.key === '1') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'fan' }));
        return;
      }
      if (e.key === '2') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'line' }));
        return;
      }
      if (e.key === '3') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'stack' }));
        return;
      }
      if (e.key === '4') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'arc' }));
        return;
      }
      if (e.key === '5') {
        setOverlayLayoutRef.current((v) => ({ ...v, mode: 'ring' }));
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const isEditableTarget = (t: HTMLElement | null) => {
      const tag = t?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || !!t?.isContentEditable;
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      if (e.altKey || e.metaKey) return;

      const selectedId = selectedItemIdRef.current;
      if (!selectedId) return;

      const fromPoint = (() => {
        try {
          const x = (e as any).clientX;
          const y = (e as any).clientY;
          if (typeof x === 'number' && typeof y === 'number') {
            return document.elementFromPoint(x, y) as HTMLElement | null;
          }
        } catch {
        }
        return null;
      })();

      const target = (fromPoint || (e.target as HTMLElement | null)) as HTMLElement | null;
      if (isEditableTarget(target)) return;

      // Let local handlers win.
      if (target?.closest('[data-overlay-hud="true"]')) return;
      if (target?.closest('[data-overlay-card="true"]')) return;
      if (target?.closest('[data-overlay-details="true"]')) return;

      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY > 0 ? 1 : -1;
      const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;
      setZOffsetsRef.current((prev) => {
        const current = prev[selectedId] ?? 0;
        const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, current - direction * step));
        return { ...prev, [selectedId]: next };
      });

      const now = Date.now();
      if (now - sfxRef.current.lastNudgeAt > 50) {
        sfxRef.current.lastNudgeAt = now;
        playCardDepthNudgeSound(direction < 0 ? 'in' : 'out');
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false, capture: true } as any);
    return () => window.removeEventListener('wheel', onWheel as any, true);
  }, []);

  useEffect(() => {
    const onResize = () => setViewportTick((v) => v + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onHudRect = (e: Event) => {
      const ev = e as CustomEvent<{ rect?: { left: number; top: number; width: number; height: number } }>;
      const r = ev?.detail?.rect;
      if (!r) return;
      if (
        typeof r.left !== 'number' ||
        typeof r.top !== 'number' ||
        typeof r.width !== 'number' ||
        typeof r.height !== 'number'
      ) {
        return;
      }
      setHudRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    window.addEventListener('hapa.overlayHud.rect', onHudRect as EventListener);
    return () => window.removeEventListener('hapa.overlayHud.rect', onHudRect as EventListener);
  }, []);

  useEffect(() => {
    if (!showRecenterPulse) return;
    const to = window.setTimeout(() => setShowRecenterPulse(false), 650);
    return () => window.clearTimeout(to);
  }, [showRecenterPulse]);

  const targets = useMemo(() => {
    if (!hasItems) return new Map<string, any>();

    const N = items.length;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const refW = items.reduce((sum, it) => sum + (it.initialRect?.width ?? 0), 0) / Math.max(N, 1);

    const anchorX = vw * 0.5;
    const anchorY = Math.max(150, Math.floor(vh * 0.34));
    const gap = 28;

    const map = new Map<string, { tx: number; ty: number; tz: number; rotZ: number; force?: boolean }>();

    if (overlayLayout.mode !== 'free') {
      for (let i = 0; i < N; i++) {
        const item = items[i];

        // Anchored cards ignore formation targets (but can still be forced by HUD dock overrides below).
        if (anchored.includes(item.id)) continue;

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
        } else if (overlayLayout.mode === 'square') {
          const radius = Math.min(250, Math.min(vw, vh) * 0.2);
          const perim = 8; // 4 sides, each normalized length 2
          const u = (i / Math.max(N, 1)) * perim;
          if (u < 2) {
            // top
            targetCenterX = anchorX + (u - 1) * radius;
            targetCenterY = anchorY - radius;
          } else if (u < 4) {
            // right
            targetCenterX = anchorX + radius;
            targetCenterY = anchorY + (u - 3) * radius;
          } else if (u < 6) {
            // bottom
            targetCenterX = anchorX + (5 - u) * radius;
            targetCenterY = anchorY + radius;
          } else {
            // left
            targetCenterX = anchorX - radius;
            targetCenterY = anchorY + (7 - u) * radius;
          }
          rotZ = 0;
        } else if (overlayLayout.mode === 'rect') {
          const rx = Math.min(420, vw * 0.33);
          const ry = Math.min(170, vh * 0.14);
          const perim = 2 * (rx + ry);
          const step = perim / Math.max(N, 1);
          const dist = i * step;
          const topLen = rx * 2;
          const rightLen = ry * 2;

          if (dist < topLen) {
            targetCenterX = anchorX - rx + dist;
            targetCenterY = anchorY - ry;
          } else if (dist < topLen + rightLen) {
            targetCenterX = anchorX + rx;
            targetCenterY = anchorY - ry + (dist - topLen);
          } else if (dist < topLen + rightLen + topLen) {
            targetCenterX = anchorX + rx - (dist - (topLen + rightLen));
            targetCenterY = anchorY + ry;
          } else {
            targetCenterX = anchorX - rx;
            targetCenterY = anchorY + ry - (dist - (topLen + rightLen + topLen));
          }
          rotZ = 0;
        }

        const targetLeft = targetCenterX - w / 2;
        const targetTop = targetCenterY - h / 2;

        const tx = targetLeft - item.initialRect.left;
        const ty = targetTop - item.initialRect.top;

        const { baseZ, hoverLift } = getOverlayZBaseline(overlayLayout.mode, overlayLayout.hover);
        const tz = overlayLayout.mode === 'stack' ? baseZ + i * 18 : baseZ + i * 4;

        map.set(item.id, { tx, ty, tz: tz + hoverLift, rotZ });
      }
    }

    // HUD dock overrides (apply even in free mode)
    if (hudRect && (hudDock.left.length > 0 || hudDock.right.length > 0)) {
      const { baselineZ } = getOverlayZBaseline(overlayLayout.mode, overlayLayout.hover);
      const gutter = 16;
      const maxPerSide = 6;
      const baseY = hudRect.top + hudRect.height / 2;

      const applySide = (side: 'left' | 'right', ids: string[]) => {
        const docked = ids.filter((id) => items.some((it) => it.id === id)).slice(0, maxPerSide);
        if (docked.length === 0) return;

        const spacing = 18;
        const startY = baseY - ((docked.length - 1) * spacing) / 2;

        for (let i = 0; i < docked.length; i++) {
          const id = docked[i];
          const item = items.find((it) => it.id === id);
          if (!item) continue;
          const w = item.initialRect.width;
          const h = item.initialRect.height;

          const cx = side === 'left' ? hudRect.left - gutter - w / 2 : hudRect.left + hudRect.width + gutter + w / 2;
          const cy = startY + i * spacing;

          const targetLeft = cx - w / 2;
          const targetTop = cy - h / 2;

          map.set(id, {
            tx: targetLeft - item.initialRect.left,
            ty: targetTop - item.initialRect.top,
            tz: baselineZ,
            rotZ: 0,
            force: true,
          });
        }
      };

      applySide('left', hudDock.left);
      applySide('right', hudDock.right);
    }

    return map;
  }, [hasItems, items, overlayLayout.hover, overlayLayout.mode, viewportTick, recenterTick, hudDock.left, hudDock.right, hudRect, anchored]);

  useEffect(() => {
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [overlayLayout.mode, overlayLayout.hover, viewportTick, recenterTick]);

  useEffect(() => {
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [hudDock.left, hudDock.right]);

  useEffect(() => {
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [anchored]);

  const anchorPoint = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: vw * 0.5,
      y: Math.max(150, Math.floor(vh * 0.34)),
    };
  }, [viewportTick, recenterTick]);

  if (!hasItems) {
    return (
      <div className="fixed inset-0 z-[2147483000] pointer-events-none [perspective:1200px]">
        <FormationHud
          overlayLayout={overlayLayout}
          setOverlayLayout={setOverlayLayout}
          items={items}
          selectedItemId={selectedItemId}
          setSelectedItemId={setSelectedItemId}
          zOffsets={zOffsets}
          setZOffsets={setZOffsets}
          hudDock={hudDock}
          setHudDock={setHudDock}
          anchored={anchored}
          setAnchored={setAnchored}
          updateItemPosition={updateItemPosition}
          itemCount={0}
          onRecenter={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2147483000] pointer-events-none [perspective:1200px]">
      <FormationHud
        overlayLayout={overlayLayout}
        setOverlayLayout={setOverlayLayout}
        items={items}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        zOffsets={zOffsets}
        setZOffsets={setZOffsets}
        hudDock={hudDock}
        setHudDock={setHudDock}
        anchored={anchored}
        setAnchored={setAnchored}
        updateItemPosition={updateItemPosition}
        itemCount={items.length}
        onRecenter={() => {
          setRecenterTick((v) => v + 1);
          setShowRecenterPulse(true);
        }}
      />

      {showRecenterPulse && overlayLayout.mode !== 'free' ? (
        <div
          key={recenterTick}
          className="fixed z-[2147483001] pointer-events-none"
          style={{ left: anchorPoint.x, top: anchorPoint.y }}
        >
          <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full border border-cyan-300/60 shadow-[0_0_18px_rgba(34,211,238,0.35)] animate-ping" />
          <div className="absolute -left-2.5 -top-2.5 w-5 h-5 rounded-full border border-cyan-200/60 bg-cyan-500/5" />
          <div className="absolute left-0 -top-4 w-px h-8 bg-cyan-200/50" />
          <div className="absolute -left-4 top-0 w-8 h-px bg-cyan-200/50" />
        </div>
      ) : null}

      <AttachedOverlayCardDetails />

      {items.map(item => (
        <FloatingCard key={item.id} item={item} formationTarget={targets.get(item.id)} overlayLayout={overlayLayout} />
      ))}
    </div>
  );
};
