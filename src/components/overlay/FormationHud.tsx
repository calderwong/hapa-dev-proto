import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragItem, HudDockState, OverlayLayoutState, OverlayFormationMode } from '../../contexts/DragCanvasContext';

type FormationHudProps = {
  overlayLayout: OverlayLayoutState;
  setOverlayLayout: React.Dispatch<React.SetStateAction<OverlayLayoutState>>;
  items: DragItem[];
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  zOffsets: Record<string, number>;
  setZOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  hudDock: HudDockState;
  setHudDock: React.Dispatch<React.SetStateAction<HudDockState>>;
  anchored: string[];
  setAnchored: React.Dispatch<React.SetStateAction<string[]>>;
  updateItemPosition: (id: string, tx: number, ty: number) => void;
  itemCount: number;
  onRecenter: () => void;
};

const MODE_ORDER: Array<{ mode: OverlayFormationMode; label: string }> = [
  { mode: 'free', label: 'FREE' },
  { mode: 'fan', label: 'FAN' },
  { mode: 'line', label: 'LINE' },
  { mode: 'stack', label: 'STACK' },
  { mode: 'arc', label: 'ARC' },
  { mode: 'ring', label: 'RING' },
  { mode: 'square', label: 'SQUARE' },
  { mode: 'rect', label: 'RECT' },
];

const ModeButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
  variant?: 'mode' | 'toggle' | 'tool' | 'color';
  title?: string;
  size?: 'normal' | 'compact';
  disabled?: boolean;
}> = ({ active, label, onClick, variant = 'mode', title, size = 'normal', disabled }) => {
  const base =
    size === 'compact'
      ? 'w-9 h-9 flex items-center justify-center rounded-md border text-[10px] font-bold uppercase tracking-[0.14em] transition-all select-none leading-none'
      : 'px-2 py-[5px] rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] transition-all select-none leading-none';

  const palette = (() => {
    if (variant === 'color') {
      return active
        ? 'bg-red-600 text-white border-red-400'
        : 'bg-cyan-600 text-white border-cyan-400';
    }

    if (variant === 'toggle') {
      return active
        ? 'bg-cyan-500/10 text-cyan-100 border-cyan-400/45 shadow-[0_0_16px_rgba(34,211,238,0.20)]'
        : 'bg-gray-900/30 text-gray-300 border-gray-700/70 hover:bg-gray-800/60';
    }

    if (variant === 'tool') {
      return active
        ? 'bg-gray-800/70 text-gray-100 border-gray-600'
        : 'bg-gray-900/30 text-gray-300 border-gray-700/70 hover:bg-gray-800/60';
    }

    // mode
    return active
      ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.35)]'
      : 'bg-gray-900/30 text-gray-300 border-gray-700/70 hover:bg-gray-800/60';
  })();

  return (
    <button
      onClick={onClick}
      className={`${base} ${palette} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={title}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export const FormationHud: React.FC<FormationHudProps> = ({
  overlayLayout,
  setOverlayLayout,
  items,
  selectedItemId,
  setSelectedItemId,
  zOffsets,
  setZOffsets,
  hudDock,
  setHudDock,
  anchored,
  setAnchored,
  updateItemPosition,
  itemCount,
  onRecenter,
}) => {
  const selectedZ = selectedItemId ? Math.round(zOffsets[selectedItemId] ?? 0) : 0;

  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [autoPinOnDrag, setAutoPinOnDrag] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('hapa.overlayDetails.autoPinOnDrag.v1');
      if (!raw) return false;
      return raw === '1' || raw === 'true';
    } catch {
      return false;
    }
  });

  const dragCountRef = useRef(0);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);

  const dockDragRef = useRef<{ active: boolean; id: string | null; fromSide: 'left' | 'right' | null; fromIndex: number; sx: number; sy: number; didDrag: boolean }>({
    active: false,
    id: null,
    fromSide: null,
    fromIndex: -1,
    sx: 0,
    sy: 0,
    didDrag: false,
  });

  const [dockHover, setDockHover] = useState<{ side: 'left' | 'right'; idx: number } | null>(null);

  useEffect(() => {
    const onPinnedChanged = (e: Event) => {
      const ev = e as CustomEvent<{ id?: string | null }>;
      setPinnedId(ev?.detail?.id ? String(ev.detail.id) : null);
    };
    window.addEventListener('hapa.overlayDetails.pin.changed', onPinnedChanged as EventListener);
    return () => window.removeEventListener('hapa.overlayDetails.pin.changed', onPinnedChanged as EventListener);
  }, []);

  useEffect(() => {
    const onAutoChanged = (e: Event) => {
      const ev = e as CustomEvent<{ value?: boolean }>;
      const next = ev?.detail?.value;
      if (typeof next === 'boolean') setAutoPinOnDrag(next);
      else if (next != null) setAutoPinOnDrag(!!next);
    };
    window.addEventListener('hapa.overlayDetails.autoPinOnDrag.changed', onAutoChanged as EventListener);
    return () => window.removeEventListener('hapa.overlayDetails.autoPinOnDrag.changed', onAutoChanged as EventListener);
  }, []);

  useEffect(() => {
    const onDrag = (e: Event) => {
      const ev = e as CustomEvent<{ dragging?: boolean }>;
      const dragging = !!ev?.detail?.dragging;

      if (dragging) {
        dragCountRef.current += 1;
        setIsDraggingOverlay(true);
        return;
      }

      dragCountRef.current = Math.max(0, dragCountRef.current - 1);
      if (dragCountRef.current === 0) setIsDraggingOverlay(false);
    };

    window.addEventListener('hapa.overlayCard.drag', onDrag as EventListener);
    return () => window.removeEventListener('hapa.overlayCard.drag', onDrag as EventListener);
  }, []);

  const modeIcon = useMemo(() => {
    const map: Record<OverlayFormationMode, string> = {
      free: 'F',
      fan: '↗',
      line: '—',
      stack: '≡',
      arc: '⌒',
      ring: 'O',
      square: '□',
      rect: '▭',
    };
    return map;
  }, []);

  const modeTitle = useMemo(() => {
    const map: Record<OverlayFormationMode, string> = {
      free: 'Free Drift — let the stars roam',
      fan: 'Fan Constellation — spread the hand',
      line: 'Stellar Line — align the orbit',
      stack: 'Stacked Orbit — compress the deck',
      arc: 'Arc Sweep — curve the formation',
      ring: 'Ring Halo — circle the center',
      square: 'Square Lattice — box the field',
      rect: 'Rect Grid — wide horizon',
    };
    return map;
  }, []);

  const HUD_Z_MIN = -600;
  const HUD_Z_MAX = 800;

  const STORAGE_KEY = 'hapa.overlayHud.pos.v1';
  const STORAGE_Z_KEY = 'hapa.overlayHud.z.v1';
  const STORAGE_COMPACT_KEY = 'hapa.overlayHud.compact.v1';

  const DEFAULT_HUD_POS = useMemo(() => {
    return { x: Math.floor(window.innerWidth * 0.5), y: 120 };
  }, []);

  const [hudPos, setHudPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y)
      ) {
        return { x: parsed.x, y: parsed.y };
      }
    } catch { }
    return { x: Math.floor(window.innerWidth * 0.5), y: 42 };
  });

  const [hudZ, setHudZ] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_Z_KEY);
      const n = raw ? Number(raw) : 0;
      if (Number.isFinite(n)) return Math.max(HUD_Z_MIN, Math.min(HUD_Z_MAX, n));
    } catch { }
    return 0;
  });

  const [hudCompact, setHudCompact] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMPACT_KEY);
      if (!raw) return false;
      return raw === '1' || raw === 'true';
    } catch { }
    return false;
  });

  const hudRef = useRef<HTMLDivElement>(null);
  const rectRafRef = useRef<number | null>(null);
  const dragRef = useRef<{ active: boolean; pid: number; sx: number; sy: number; ox: number; oy: number }>({
    active: false,
    pid: -1,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hudPos));
    } catch { }
  }, [hudPos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_Z_KEY, String(hudZ));
    } catch { }
  }, [hudZ]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COMPACT_KEY, hudCompact ? '1' : '0');
    } catch { }
  }, [hudCompact]);

  const clamp = (v: number, lo: number, hi: number) => {
    if (!Number.isFinite(v)) return (lo + hi) / 2;
    return Math.max(lo, Math.min(hi, v));
  };

  const clampHudPos = useCallback((pos: { x: number; y: number }) => {
    const margin = 10;
    const topInset = 92;
    const rect = hudRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 540;
    const height = rect?.height ?? 78;

    return {
      x: clamp(pos.x, margin + width / 2, window.innerWidth - margin - width / 2),
      y: clamp(pos.y, topInset + height / 2, window.innerHeight - margin - height / 2),
    };
  }, []);

  const hudScale = useMemo(() => {
    return Math.max(0.82, Math.min(1.25, 1 + hudZ / 4500));
  }, [hudZ]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = hudRef.current;
    if (!el) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('button')) return;

    dragRef.current.active = true;
    dragRef.current.pid = e.pointerId;
    dragRef.current.sx = e.clientX;
    dragRef.current.sy = e.clientY;
    dragRef.current.ox = hudPos.x;
    dragRef.current.oy = hudPos.y;

    try {
      el.setPointerCapture(e.pointerId);
    } catch { }
  }, [hudPos.x, hudPos.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pid) return;

    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;

    setHudPos(
      clampHudPos({
        x: dragRef.current.ox + dx,
        y: dragRef.current.oy + dy,
      })
    );
  }, [clampHudPos]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== dragRef.current.pid) return;
    dragRef.current.active = false;
    dragRef.current.pid = -1;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!hudRef.current) return;
    e.preventDefault();
    const next = hudZ + e.deltaY * -6;
    setHudZ(clamp(next, HUD_Z_MIN, HUD_Z_MAX));
  }, [HUD_Z_MAX, HUD_Z_MIN, hudZ]);

  useEffect(() => {
    setHudPos((p) => clampHudPos(p));
  }, [clampHudPos, hudScale]);

  useEffect(() => {
    const onResize = () => setHudPos((p) => clampHudPos(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampHudPos]);

  useEffect(() => {
    const publishRect = () => {
      rectRafRef.current = null;
      const rect = hudRef.current?.getBoundingClientRect();
      if (!rect) return;
      window.dispatchEvent(
        new CustomEvent('hapa.overlayHud.rect', {
          detail: {
            rect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            },
          },
        })
      );
    };

    if (rectRafRef.current != null) window.cancelAnimationFrame(rectRafRef.current);
    rectRafRef.current = window.requestAnimationFrame(publishRect);

    return () => {
      if (rectRafRef.current != null) window.cancelAnimationFrame(rectRafRef.current);
      rectRafRef.current = null;
    };
  }, [hudPos.x, hudPos.y, hudScale, hudCompact]);

  const getItemThumb = useCallback((id: string) => {
    const it = items.find((x) => x.id === id);
    const thumb = (it as any)?.data?.thumbnail;
    if (!thumb || typeof thumb !== 'string') return null;
    return thumb;
  }, [items]);

  const dockSideForSelected = useMemo(() => {
    if (!selectedItemId) return null;
    if (hudDock.left.includes(selectedItemId)) return 'left';
    if (hudDock.right.includes(selectedItemId)) return 'right';
    return null;
  }, [hudDock.left, hudDock.right, selectedItemId]);

  const selectedIsAnchored = useMemo(() => {
    if (!selectedItemId) return false;
    return anchored.includes(selectedItemId);
  }, [anchored, selectedItemId]);

  const selectedStatusLabel = useMemo(() => {
    if (!selectedItemId) return '';
    if (dockSideForSelected) return dockSideForSelected === 'left' ? 'Docked L' : 'Docked R';
    if (selectedIsAnchored) return 'Anchored';
    if (overlayLayout.mode !== 'free') return 'Formation';
    return 'Free';
  }, [dockSideForSelected, overlayLayout.mode, selectedIsAnchored, selectedItemId]);

  const constraintCounts = useMemo(() => {
    const left = hudDock.left.length;
    const right = hudDock.right.length;
    const itemIdSet = new Set(items.map((it) => it.id));
    const anchoredCount = anchored.filter((id) => itemIdSet.has(id)).length;
    return { left, right, anchored: anchoredCount };
  }, [anchored, hudDock.left.length, hudDock.right.length, items]);

  const clearDocks = useCallback(() => {
    setHudDock({ left: [], right: [] });
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [setHudDock]);

  const clearDockLeft = useCallback(() => {
    setHudDock((prev) => ({ ...prev, left: [] }));
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [setHudDock]);

  const clearDockRight = useCallback(() => {
    setHudDock((prev) => ({ ...prev, right: [] }));
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [setHudDock]);

  const clearAnchors = useCallback(() => {
    setAnchored([]);
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [setAnchored]);

  const toggleSelectedAnchor = useCallback(() => {
    if (!selectedItemId) return;
    if (dockSideForSelected) return;

    const id = selectedItemId;
    const currentlyAnchored = anchored.includes(id);

    if (!currentlyAnchored) {
      try {
        const el = document.querySelector(`[data-overlay-card-id="${id}"]`) as HTMLElement | null;
        if (el) {
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          if (Number.isFinite(m.m41) && Number.isFinite(m.m42)) {
            updateItemPosition(id, m.m41, m.m42);
          }
        }
      } catch {
        // ignore
      }

      setAnchored((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setAnchored((prev) => prev.filter((x) => x !== id));
    }

    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [anchored, dockSideForSelected, selectedItemId, setAnchored, updateItemPosition]);

  const leftRailSlots = useMemo(() => {
    const ids = hudDock.left.slice(0, 6);
    const slots: Array<string | null> = [...ids];
    while (slots.length < 3) slots.push(null);
    return slots;
  }, [hudDock.left]);

  const rightRailSlots = useMemo(() => {
    const ids = hudDock.right.slice(0, 6);
    const slots: Array<string | null> = [...ids];
    while (slots.length < 3) slots.push(null);
    return slots;
  }, [hudDock.right]);

  const applyDockMove = useCallback((id: string, fromSide: 'left' | 'right', fromIndex: number, toSide: 'left' | 'right', toIndex: number) => {
    setHudDock((prev) => {
      const currentLeft = prev.left.filter((x) => x !== id);
      const currentRight = prev.right.filter((x) => x !== id);

      const base = toSide === 'left' ? currentLeft : currentRight;

      let insertAt = Math.max(0, Math.min(toIndex, base.length));

      if (fromSide === toSide && fromIndex >= 0 && fromIndex < toIndex) {
        insertAt = Math.max(0, insertAt - 1);
      }

      const nextSide = [...base.slice(0, insertAt), id, ...base.slice(insertAt)].slice(0, 6);
      return toSide === 'left'
        ? { left: nextSide, right: currentRight }
        : { left: currentLeft, right: nextSide };
    });
  }, [setHudDock]);

  const beginDockDrag = useCallback((e: React.PointerEvent, id: string, side: 'left' | 'right', idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    dockDragRef.current.active = true;
    dockDragRef.current.id = id;
    dockDragRef.current.fromSide = side;
    dockDragRef.current.fromIndex = idx;
    dockDragRef.current.sx = e.clientX;
    dockDragRef.current.sy = e.clientY;
    dockDragRef.current.didDrag = false;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }
  }, []);

  const updateDockHoverFromPoint = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const slot = el?.closest('[data-hud-dock-slot]') as HTMLElement | null;
    if (!slot) {
      setDockHover(null);
      return;
    }
    const side = slot.getAttribute('data-hud-dock-side');
    const idxRaw = slot.getAttribute('data-hud-dock-idx');
    if ((side !== 'left' && side !== 'right') || idxRaw == null) {
      setDockHover(null);
      return;
    }
    const idx = Number(idxRaw);
    if (!Number.isFinite(idx)) {
      setDockHover(null);
      return;
    }
    setDockHover({ side, idx });
  }, []);

  const onDockSlotPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dockDragRef.current.active || !dockDragRef.current.id || !dockDragRef.current.fromSide) return;
    const dx = e.clientX - dockDragRef.current.sx;
    const dy = e.clientY - dockDragRef.current.sy;
    const dist = Math.hypot(dx, dy);
    if (!dockDragRef.current.didDrag && dist < 6) return;
    dockDragRef.current.didDrag = true;
    updateDockHoverFromPoint(e.clientX, e.clientY);
  }, [updateDockHoverFromPoint]);

  const endDockDrag = useCallback((e: React.PointerEvent, fallbackSelectId?: string) => {
    if (!dockDragRef.current.active) return;
    e.preventDefault();
    e.stopPropagation();

    const id = dockDragRef.current.id;
    const fromSide = dockDragRef.current.fromSide;
    const fromIndex = dockDragRef.current.fromIndex;
    const didDrag = dockDragRef.current.didDrag;
    const hover = dockHover;

    dockDragRef.current.active = false;
    dockDragRef.current.id = null;
    dockDragRef.current.fromSide = null;
    dockDragRef.current.fromIndex = -1;
    dockDragRef.current.didDrag = false;
    setDockHover(null);

    if (!id || !fromSide) return;

    if (!didDrag) {
      if (fallbackSelectId) setSelectedItemId(fallbackSelectId);
      return;
    }

    if (!hover) return;
    applyDockMove(id, fromSide, fromIndex, hover.side, hover.idx);
  }, [applyDockMove, dockHover, setSelectedItemId]);

  const dockSelected = useCallback((side: 'left' | 'right') => {
    if (!selectedItemId) return;
    setAnchored((prev) => prev.filter((x) => x !== selectedItemId));
    setHudDock((prev) => {
      const without = {
        left: prev.left.filter((x) => x !== selectedItemId),
        right: prev.right.filter((x) => x !== selectedItemId),
      };
      const nextSide = [selectedItemId, ...(without[side] || [])].slice(0, 6);
      return side === 'left'
        ? { left: nextSide, right: without.right }
        : { left: without.left, right: nextSide };
    });
  }, [selectedItemId, setAnchored, setHudDock]);

  const undockSelected = useCallback(() => {
    if (!selectedItemId) return;
    setHudDock((prev) => ({
      left: prev.left.filter((x) => x !== selectedItemId),
      right: prev.right.filter((x) => x !== selectedItemId),
    }));
  }, [selectedItemId, setHudDock]);

  useEffect(() => {
    const onReset = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_Z_KEY);
        localStorage.removeItem(STORAGE_COMPACT_KEY);
      } catch { }
      setHudZ(0);
      setHudCompact(false);
      setHudPos((_) => clampHudPos(DEFAULT_HUD_POS));
    };

    window.addEventListener('hapa.overlayHud.reset', onReset);
    return () => window.removeEventListener('hapa.overlayHud.reset', onReset);
  }, [DEFAULT_HUD_POS, clampHudPos]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const rect = hudRef.current?.getBoundingClientRect();
      if (!rect) return;

      const offscreen =
        rect.right < 0 ||
        rect.left > window.innerWidth ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight;

      if (offscreen) {
        window.dispatchEvent(new Event('hapa.overlayHud.reset'));
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      ref={hudRef}
      data-overlay-hud="true"
      className="fixed z-[2147483647] pointer-events-auto [transform-style:preserve-3d]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        left: hudPos.x,
        top: hudPos.y,
        transform: `translate(-50%, -50%) scale(${hudScale})`,
      }}
    >
      <div className="relative">
        <div className="absolute -inset-4 pointer-events-none">
          <div className="absolute inset-0 bg-cyan-500/10 blur-2xl opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent opacity-70" />
        </div>

        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full mr-2 flex flex-col gap-1.5 pointer-events-auto">
          <div className="px-1 text-[10px] font-mono text-gray-400/80 tracking-[0.16em]" title="Left dock rail capacity">
            L {constraintCounts.left}/6
          </div>
          {leftRailSlots.map((id, idx) => {
            if (!id) {
              return (
                <div
                  key={`hudDock:left:empty:${idx}`}
                  data-hud-dock-slot
                  data-hud-dock-side="left"
                  data-hud-dock-idx={idx}
                  className={`w-9 h-12 rounded-lg border border-dashed ${dockHover?.side === 'left' && dockHover.idx === idx ? 'border-cyan-300/50 bg-cyan-500/10' : 'border-cyan-500/15 bg-gray-950/15'}`}
                  title={selectedItemId ? 'Dock L to place selected here' : 'Select a card, then Dock L'}
                />
              );
            }
            const active = selectedItemId === id;
            const thumb = getItemThumb(id);
            return (
              <button
                key={`hudDock:left:${id}`}
                type="button"
                data-hud-dock-slot
                data-hud-dock-side="left"
                data-hud-dock-idx={idx}
                onPointerDown={(e) => beginDockDrag(e, id, 'left', idx)}
                onPointerMove={onDockSlotPointerMove}
                onPointerUp={(e) => endDockDrag(e, id)}
                onPointerCancel={(e) => endDockDrag(e, id)}
                title={active ? 'Docked (left) — selected' : 'Docked (left) — click to select'}
                className={`relative w-9 h-12 rounded-lg overflow-hidden border transition-all ${
                  active
                    ? 'border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
                    : 'border-cyan-500/20 bg-gray-950/30 hover:border-cyan-400/35'
                } ${dockHover?.side === 'left' && dockHover.idx === idx ? 'ring-1 ring-cyan-300/25' : ''}`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/30" />
              </button>
            );
          })}
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-2 flex flex-col gap-1.5 pointer-events-auto">
          <div className="px-1 text-[10px] font-mono text-gray-400/80 tracking-[0.16em] text-right" title="Right dock rail capacity">
            R {constraintCounts.right}/6
          </div>
          {rightRailSlots.map((id, idx) => {
            if (!id) {
              return (
                <div
                  key={`hudDock:right:empty:${idx}`}
                  data-hud-dock-slot
                  data-hud-dock-side="right"
                  data-hud-dock-idx={idx}
                  className={`w-9 h-12 rounded-lg border border-dashed ${dockHover?.side === 'right' && dockHover.idx === idx ? 'border-cyan-300/50 bg-cyan-500/10' : 'border-cyan-500/15 bg-gray-950/15'}`}
                  title={selectedItemId ? 'Dock R to place selected here' : 'Select a card, then Dock R'}
                />
              );
            }
            const active = selectedItemId === id;
            const thumb = getItemThumb(id);
            return (
              <button
                key={`hudDock:right:${id}`}
                type="button"
                data-hud-dock-slot
                data-hud-dock-side="right"
                data-hud-dock-idx={idx}
                onPointerDown={(e) => beginDockDrag(e, id, 'right', idx)}
                onPointerMove={onDockSlotPointerMove}
                onPointerUp={(e) => endDockDrag(e, id)}
                onPointerCancel={(e) => endDockDrag(e, id)}
                title={active ? 'Docked (right) — selected' : 'Docked (right) — click to select'}
                className={`relative w-9 h-12 rounded-lg overflow-hidden border transition-all ${
                  active
                    ? 'border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
                    : 'border-cyan-500/20 bg-gray-950/30 hover:border-cyan-400/35'
                } ${dockHover?.side === 'right' && dockHover.idx === idx ? 'ring-1 ring-cyan-300/25' : ''}`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/55" />
              </button>
            );
          })}
        </div>

        <div className={`relative flex items-center ${hudCompact ? 'gap-1.5 px-1.5 py-1.5 rounded-xl' : 'gap-2 px-2.5 py-2 rounded-2xl'} rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-gray-950/75 to-gray-950/40 shadow-[0_0_26px_rgba(34,211,238,0.12)] backdrop-blur-md overflow-hidden`}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/7 via-transparent to-transparent" />
            <div className="absolute -left-10 -top-10 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl opacity-45" />
            <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl opacity-35" />
          </div>
          <ModeButton
          variant="toggle"
          active={overlayLayout.hover}
          label={hudCompact ? '✦' : 'HOVER'}
          title={overlayLayout.hover ? 'Hover Field — the fleet floats (toggle)' : 'Hover Field — raise the fleet (toggle)'}
          onClick={() => setOverlayLayout((v) => ({ ...v, hover: !v.hover }))}
          size={hudCompact ? 'compact' : 'normal'}
        />

        <div className={`flex items-center ${hudCompact ? 'gap-1 rounded-lg px-1 py-1' : 'gap-1.5 rounded-xl px-1.5 py-1'} border border-gray-800/70 bg-gray-900/20`}>
          <button
            onClick={() => setOverlayLayout((v) => ({ ...v, mode: 'ring' }))}
            className={`${hudCompact ? 'w-9 h-9' : 'w-10 h-10'} rounded-full border text-[9px] font-bold uppercase tracking-[0.18em] transition-all ${
              overlayLayout.mode === 'ring'
                ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.22)]'
                : 'border-gray-700/70 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'
            }`}
            title={modeTitle.ring}
          >
            O
          </button>
          <button
            onClick={() => setOverlayLayout((v) => ({ ...v, mode: 'square' }))}
            className={`${hudCompact ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl border text-[9px] font-bold uppercase tracking-[0.18em] transition-all ${
              overlayLayout.mode === 'square'
                ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.22)]'
                : 'border-gray-700/70 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'
            }`}
            title={modeTitle.square}
          >
            []
          </button>
          <button
            onClick={() => setOverlayLayout((v) => ({ ...v, mode: 'rect' }))}
            className={`${hudCompact ? 'w-10 h-9' : 'w-12 h-10'} rounded-xl border text-[9px] font-bold uppercase tracking-[0.18em] transition-all ${
              overlayLayout.mode === 'rect'
                ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.22)]'
                : 'border-gray-700/70 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'
            }`}
            title={modeTitle.rect}
          >
            ▭
          </button>

          <div className={`${hudCompact ? 'w-px h-7 mx-0.5' : 'w-px h-8 mx-1'} bg-gray-800/80`} />

          <div className="flex items-center rounded-lg border border-gray-800/70 bg-gray-900/20 overflow-hidden">
            {MODE_ORDER.filter(m => !['ring', 'square', 'rect'].includes(m.mode)).map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setOverlayLayout((v) => ({ ...v, mode }))}
                title={modeTitle[mode]}
                className={`${hudCompact ? 'w-9 h-9 flex items-center justify-center' : 'px-2 py-[5px]'} text-[9px] font-bold uppercase tracking-[0.22em] leading-none transition-all border-r border-gray-800/70 last:border-r-0 ${
                  overlayLayout.mode === mode
                    ? 'bg-blue-600 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]'
                    : 'text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {hudCompact ? modeIcon[mode] : label}
              </button>
            ))}
          </div>
        </div>

        <ModeButton
          variant="color"
          active={overlayLayout.portalColorMode === 'red'}
          label={hudCompact ? (overlayLayout.portalColorMode === 'red' ? 'R' : 'B') : (overlayLayout.portalColorMode === 'red' ? 'RED' : 'BLUE')}
          title={overlayLayout.portalColorMode === 'red' ? 'Crimson Portal — switch to Azure' : 'Azure Portal — switch to Crimson'}
          onClick={() =>
            setOverlayLayout((v) => ({
              ...v,
              portalColorMode: v.portalColorMode === 'blue' ? 'red' : 'blue',
            }))
          }
          size={hudCompact ? 'compact' : 'normal'}
        />

        <div className="w-px h-6 bg-gray-700/60 mx-1" />

        <ModeButton
          variant="tool"
          active={!!pinnedId}
          label={hudCompact ? 'P' : 'PIN'}
          title={pinnedId ? 'Unpin details panel (P)' : 'Pin selected details panel (P)'}
          onClick={() => {
            const next = pinnedId ? null : selectedItemId;
            window.dispatchEvent(new CustomEvent('hapa.overlayDetails.pin.set', { detail: { id: next } }));
          }}
          size={hudCompact ? 'compact' : 'normal'}
        />

        <ModeButton
          variant="tool"
          active={autoPinOnDrag}
          label={hudCompact ? 'AU' : 'AUTO'}
          title={isDraggingOverlay ? 'Auto-pin while dragging: locked during drag' : (autoPinOnDrag ? 'Auto-pin while dragging: on (O)' : 'Auto-pin while dragging: off (O)')}
          onClick={() => {
            if (isDraggingOverlay) return;
            const next = !autoPinOnDrag;
            window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.set', { detail: { value: next } }));
          }}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={isDraggingOverlay}
        />

        <ModeButton
          variant="tool"
          active={hudCompact}
          label={hudCompact ? '⤢' : 'COMPRESS'}
          title={hudCompact ? 'Stellar Zoom — expand the cockpit HUD' : 'Stellar Zoom — compress the cockpit HUD'}
          onClick={() => setHudCompact((v) => !v)}
          size={hudCompact ? 'compact' : 'normal'}
        />

        <div className="w-px h-6 bg-gray-700/60 mx-0.5" />

        <div className={`${hudCompact ? 'hidden' : 'flex'} items-center px-2 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-100/80 select-none`}>
          DOCK
        </div>

        <ModeButton
          variant="tool"
          active={false}
          label={hudCompact ? 'CL' : 'CLR L'}
          title={constraintCounts.left > 0 ? 'Clear left dock rail' : 'Left dock rail is empty'}
          onClick={clearDockLeft}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={constraintCounts.left === 0}
        />

        <ModeButton
          variant="tool"
          active={false}
          label={hudCompact ? 'CR' : 'CLR R'}
          title={constraintCounts.right > 0 ? 'Clear right dock rail' : 'Right dock rail is empty'}
          onClick={clearDockRight}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={constraintCounts.right === 0}
        />

        <ModeButton
          variant="tool"
          active={dockSideForSelected === 'left'}
          label={hudCompact ? 'DL' : 'DOCK L'}
          title={
            !selectedItemId
              ? 'Select a card, then Dock Left'
              : dockSideForSelected === 'left'
                ? 'Docked left — move/confirm'
                : 'Dock selected card to left rail'
          }
          onClick={() => dockSelected('left')}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={!selectedItemId}
        />

        <ModeButton
          variant="tool"
          active={dockSideForSelected === 'right'}
          label={hudCompact ? 'DR' : 'DOCK R'}
          title={
            !selectedItemId
              ? 'Select a card, then Dock Right'
              : dockSideForSelected === 'right'
                ? 'Docked right — move/confirm'
                : 'Dock selected card to right rail'
          }
          onClick={() => dockSelected('right')}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={!selectedItemId}
        />

        <ModeButton
          variant="tool"
          active={dockSideForSelected != null}
          label={hudCompact ? 'UD' : 'UNDOCK'}
          title={!selectedItemId ? 'Select a card, then Undock' : dockSideForSelected != null ? 'Undock selected card' : 'Undock (no docked selection)'}
          onClick={undockSelected}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={!selectedItemId}
        />

        <ModeButton
          variant="tool"
          active={selectedIsAnchored}
          label={hudCompact ? 'A' : 'ANCH'}
          title={!selectedItemId ? 'Select a card, then Anchor' : dockSideForSelected ? 'Undock first to anchor' : selectedIsAnchored ? 'Unanchor selected card (A)' : 'Anchor selected card (A)'}
          onClick={toggleSelectedAnchor}
          size={hudCompact ? 'compact' : 'normal'}
          disabled={!selectedItemId || dockSideForSelected != null}
        />

        <div className={`flex items-center ${hudCompact ? 'gap-1.5' : 'gap-2'}`}>
          <div className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
            {hudCompact ? (
              <>
                <span title="Stars in formation">N</span>: <span className="text-cyan-200" title="Card count">{itemCount}</span>
                <span className="mx-2 text-gray-600">|</span>
                <span title="Auto-pin while dragging">AU</span>:{' '}
                <span
                  className={autoPinOnDrag ? 'text-amber-200' : 'text-gray-400'}
                  title={autoPinOnDrag ? 'Auto-pin while dragging: on' : 'Auto-pin while dragging: off'}
                >
                  {autoPinOnDrag ? 'ON' : 'OFF'}
                </span>
                {pinnedId ? (
                  <>
                    <span className="mx-2 text-gray-600">|</span>
                    <span title="Pinned star">P</span>: <span className="text-cyan-200" title="Pinned card">{pinnedId.slice(0, 6)}</span>
                  </>
                ) : null}
                {selectedItemId ? (
                  <>
                    <span className="mx-2 text-gray-600">|</span>
                    <span title="Selected star">S</span>: <span className="text-cyan-200" title="Selected card">{selectedItemId.slice(0, 6)}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span title="Selected status">ST</span>:{' '}
                    <span className="text-cyan-200" title={selectedStatusLabel || 'Status'}>
                      {selectedStatusLabel ? selectedStatusLabel.replace('Docked ', 'D').replace('Anchored', 'A').replace('Formation', 'F').replace('Free', 'FR') : '—'}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                N: <span className="text-cyan-200">{itemCount}</span>
                <span className="mx-2 text-gray-600">|</span>
                {selectedItemId ? (
                  <>
                    SEL: <span className="text-cyan-200">{selectedItemId.slice(0, 8)}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    ST: <span className="text-cyan-200">{selectedStatusLabel}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    Z: <span className="text-cyan-200">{selectedZ}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">AUTO:</span>{' '}
                    <span className={autoPinOnDrag ? 'text-amber-200' : 'text-gray-400'}>{autoPinOnDrag ? 'ON' : 'OFF'}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    {pinnedId ? (
                      <>
                        PIN: <span className="text-cyan-200">{pinnedId.slice(0, 8)}</span>
                        <span className="mx-2 text-gray-600">|</span>
                      </>
                    ) : null}
                    <span className="text-gray-500">DOCK:</span>{' '}
                    <span className="text-cyan-200">L{constraintCounts.left}</span>{' '}
                    <span className="text-gray-600">/</span>{' '}
                    <span className="text-cyan-200">R{constraintCounts.right}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">ANCH:</span>{' '}
                    <span className="text-cyan-200">{constraintCounts.anchored}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">Keys: [ ] / Ctrl+[ ] / Shift+Wheel / Ctrl+Shift+Wheel · Shift+←/→/↓ · A · Del · C · P · O</span>
                  </>
                ) : (
                  <>
                    SEL: <span className="text-gray-500">none</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">AUTO:</span>{' '}
                    <span className={autoPinOnDrag ? 'text-amber-200' : 'text-gray-400'}>{autoPinOnDrag ? 'ON' : 'OFF'}</span>
                    {pinnedId ? (
                      <>
                        <span className="mx-2 text-gray-600">|</span>
                        PIN: <span className="text-cyan-200">{pinnedId.slice(0, 8)}</span>
                      </>
                    ) : null}
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">DOCK:</span>{' '}
                    <span className="text-cyan-200">L{constraintCounts.left}</span>{' '}
                    <span className="text-gray-600">/</span>{' '}
                    <span className="text-cyan-200">R{constraintCounts.right}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">ANCH:</span>{' '}
                    <span className="text-cyan-200">{constraintCounts.anchored}</span>
                    <span className="mx-2 text-gray-600">|</span>
                    <span className="text-gray-500">Tip: Shift+Wheel depth (Ctrl fine) · Shift+←/→ dock · Shift+↓ undock · A anchor · O auto-pin</span>
                  </>
                )}
              </>
            )}
          </div>

          <button
            onClick={onRecenter}
            title="Recenter — align the cockpit to the zenith"
            className={`${hudCompact ? 'w-9 h-9 flex items-center justify-center' : 'px-2 py-[5px]'} rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] leading-none transition-all select-none bg-cyan-500/10 text-cyan-100 border-cyan-400/40 shadow-[0_0_18px_rgba(34,211,238,0.18)] hover:bg-cyan-500/15`}
          >
            {hudCompact ? '◎' : 'RECENTER'}
          </button>

          <ModeButton
            variant="tool"
            active={false}
            label={hudCompact ? '⟲' : 'HUD RESET'}
            title="Reset HUD — return the cockpit to default orbit"
            onClick={() => {
              window.dispatchEvent(new Event('hapa.overlayHud.reset'));
            }}
            size={hudCompact ? 'compact' : 'normal'}
          />

          <ModeButton
            variant="tool"
            active={false}
            label={hudCompact ? 'Z' : 'Z RESET'}
            title="Zero Depth — collapse selected star back to baseline"
            onClick={() => {
              if (!selectedItemId) return;
              setZOffsets((prev) => {
                const { [selectedItemId]: _removed, ...rest } = prev;
                return rest;
              });
            }}
            size={hudCompact ? 'compact' : 'normal'}
          />

          <ModeButton
            variant="tool"
            active={false}
            label={hudCompact ? 'CD' : 'CLR DOCK'}
            title={constraintCounts.left + constraintCounts.right > 0 ? 'Clear Docking — release all forced dock rails' : 'No docked cards'}
            onClick={clearDocks}
            size={hudCompact ? 'compact' : 'normal'}
            disabled={constraintCounts.left + constraintCounts.right === 0}
          />

          <ModeButton
            variant="tool"
            active={false}
            label={hudCompact ? 'CA' : 'CLR ANCH'}
            title={constraintCounts.anchored > 0 ? 'Clear Anchors — unanchor all anchored cards' : 'No anchored cards'}
            onClick={clearAnchors}
            size={hudCompact ? 'compact' : 'normal'}
            disabled={constraintCounts.anchored === 0}
          />

          <ModeButton
            variant="tool"
            active={false}
            label={hudCompact ? '×' : 'CLEAR'}
            title="Clear Selection — release the current star"
            onClick={() => setSelectedItemId(null)}
            size={hudCompact ? 'compact' : 'normal'}
          />
        </div>
        </div>
      </div>
    </div>
  );
};
