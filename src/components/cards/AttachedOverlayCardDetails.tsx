import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDragCanvas, DEFAULT_CARD_POSE, OVERLAY_CARD_Z_MAX, OVERLAY_CARD_Z_MIN, OVERLAY_CARD_Z_STEP } from '../../contexts/DragCanvasContext';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const formatMetaValue = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString();
  if (Array.isArray(v)) {
    const parts = v
      .slice(0, 6)
      .map((x) => (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' ? String(x) : '…'));
    return parts.join(', ');
  }
  return '';
};

const formatMaybeIsoDate = (v: unknown): string => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (Number.isFinite(d.getTime())) return d.toISOString();
    return v;
  }
  return formatMetaValue(v);
};

const copyToClipboard = async (text: string) => {
  const value = String(text ?? '');
  if (!value) return;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
  } catch {
    // ignore
  }
};

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">{label}</div>
        <div className="text-[10px] font-mono text-cyan-200 tabular-nums">{Math.round(value)}</div>
      </div>
      <label className="sr-only">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
};

export const AttachedOverlayCardDetails: React.FC = () => {
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    removeItem,
    poses,
    setPoses,
    zOffsets,
    setZOffsets,
    hudDock,
    setHudDock,
    anchored,
    setAnchored,
    overlayLayout,
    updateItemPosition,
  } = useDragCanvas();
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [hudRect, setHudRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [bottomDockRect, setBottomDockRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [fullRecord, setFullRecord] = useState<any>(null);
  const [p2pStatus, setP2pStatus] = useState<{ loading: boolean; error: string | null; fetchedAt: number | null; coreName: string | null }>(() => ({
    loading: false,
    error: null,
    fetchedAt: null,
    coreName: null,
  }));
  const [copiedHint, setCopiedHint] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const [showAllMeta, setShowAllMeta] = useState<boolean>(false);
  const [showAllRecord, setShowAllRecord] = useState<boolean>(false);
  const [rowFilter, setRowFilter] = useState<string>('');
  const FIELD_PINS_STORAGE_KEY = 'hapa.overlayDetails.fieldPins.v1';
  const [fieldPinsByCore, setFieldPinsByCore] = useState<Record<string, string[]>>(() => {
    try {
      const raw = window.localStorage.getItem(FIELD_PINS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, string[]>;
      return {};
    } catch {
      return {};
    }
  });
  const AUTO_PIN_ON_DRAG_KEY = 'hapa.overlayDetails.autoPinOnDrag.v1';
  const PIN_STORAGE_KEY = 'hapa.overlayDetails.pin.v1';
  const HELP_STORAGE_KEY = 'hapa.overlayDetails.help.v1';
  const PLACEMENT_STORAGE_KEY = 'hapa.overlayDetails.placement.v1';

  const [pinnedItemId, setPinnedItemId] = useState<string | null>(() => {
    try {
      const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
      const v = raw ? String(raw) : '';
      return v ? v : null;
    } catch {
      return null;
    }
  });
  const [showHelp, setShowHelp] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(HELP_STORAGE_KEY);
      if (!raw) return false;
      return raw === '1' || raw === 'true';
    } catch {
      return false;
    }
  });
  const [placementPref, setPlacementPref] = useState<string>(() => {
    try {
      return window.localStorage.getItem(PLACEMENT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [autoPinOnDrag, setAutoPinOnDrag] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(AUTO_PIN_ON_DRAG_KEY);
      if (!raw) return false;
      return raw === '1' || raw === 'true';
    } catch {
      return false;
    }
  });
  const [isDraggingOverlay, setIsDraggingOverlay] = useState<boolean>(false);
  const [dragPinnedItemId, setDragPinnedItemId] = useState<string | null>(null);
  const pinHydrationRef = useRef(true);
  const dragCountRef = useRef(0);
  const dragFrozenItemIdRef = useRef<string | null>(null);
  const lastRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const lastMeasureAtRef = useRef(0);
  const rafMeasureRef = useRef<number>(0);
  const followRafRef = useRef<number>(0);
  const followUntilRef = useRef<number>(0);

  const isPinned = !!pinnedItemId;
  const activeItemId = isPinned
    ? pinnedItemId
    : (isDraggingOverlay && dragPinnedItemId)
      ? dragPinnedItemId
      : isDraggingOverlay
        ? (dragFrozenItemIdRef.current ?? selectedItemId)
        : selectedItemId;

  const isDragFrozen = !!(isDraggingOverlay && !isPinned && (dragPinnedItemId || dragFrozenItemIdRef.current));

  useEffect(() => {
    // Keep a stable item shown while dragging cards.
    // Explicit panel pin always wins and bypasses drag-freeze.
    const onDrag = (e: Event) => {
      const ev = e as CustomEvent<{ id?: string; dragging?: boolean }>;
      const dragging = !!ev?.detail?.dragging;
      const draggedId = ev?.detail?.id ? String(ev.detail.id) : null;

      if (dragging) {
        dragCountRef.current += 1;
        if (!isPinned && !dragFrozenItemIdRef.current) dragFrozenItemIdRef.current = draggedId ?? selectedItemId;
        if (!isPinned && autoPinOnDrag && !dragPinnedItemId) setDragPinnedItemId(draggedId ?? selectedItemId);
        setIsDraggingOverlay(true);
        return;
      }

      dragCountRef.current = Math.max(0, dragCountRef.current - 1);
      if (dragCountRef.current === 0) {
        dragFrozenItemIdRef.current = null;
        setDragPinnedItemId(null);
        setIsDraggingOverlay(false);
      }
    };

    window.addEventListener('hapa.overlayCard.drag', onDrag as EventListener);
    return () => window.removeEventListener('hapa.overlayCard.drag', onDrag as EventListener);
  }, [autoPinOnDrag, dragPinnedItemId, isPinned, selectedItemId]);

  useEffect(() => {
    const to = window.setTimeout(() => {
      pinHydrationRef.current = false;
    }, 450);
    return () => window.clearTimeout(to);
  }, []);

  useEffect(() => {
    if (!pinHydrationRef.current) return;
    if (items.length > 0) pinHydrationRef.current = false;
  }, [items.length]);

  useEffect(() => {
    try {
      if (pinnedItemId) window.localStorage.setItem(PIN_STORAGE_KEY, pinnedItemId);
      else window.localStorage.removeItem(PIN_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [PIN_STORAGE_KEY, pinnedItemId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HELP_STORAGE_KEY, showHelp ? '1' : '0');
    } catch {
      // ignore
    }
  }, [HELP_STORAGE_KEY, showHelp]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FIELD_PINS_STORAGE_KEY, JSON.stringify(fieldPinsByCore || {}));
    } catch {
      // ignore
    }
  }, [FIELD_PINS_STORAGE_KEY, fieldPinsByCore]);

  useEffect(() => {
    if (!placementPref) return;
    try {
      window.localStorage.setItem(PLACEMENT_STORAGE_KEY, placementPref);
    } catch {
      // ignore
    }
  }, [PLACEMENT_STORAGE_KEY, placementPref]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hapa.overlayDetails.pin.changed', { detail: { id: pinnedItemId } }));
  }, [pinnedItemId]);

  useEffect(() => {
    const onPinSet = (e: Event) => {
      const ev = e as CustomEvent<{ id?: string | null }>;
      const next = ev?.detail?.id;
      setPinnedItemId(next ? String(next) : null);
    };
    window.addEventListener('hapa.overlayDetails.pin.set', onPinSet as EventListener);
    return () => window.removeEventListener('hapa.overlayDetails.pin.set', onPinSet as EventListener);
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
    if (!pinnedItemId) return;
    if (pinHydrationRef.current) return;
    const exists = items.some((it) => it.id === pinnedItemId);
    if (!exists) setPinnedItemId(null);
  }, [items, pinnedItemId]);

  const item = useMemo(() => {
    if (!activeItemId) return null;
    return items.find((it) => it.id === activeItemId) || null;
  }, [items, activeItemId]);

  const pose = useMemo(() => {
    if (!item) return DEFAULT_CARD_POSE;
    return { ...DEFAULT_CARD_POSE, ...(poses[item.id] || {}) };
  }, [item, poses]);

  const dockSideForItem = useMemo(() => {
    if (!item) return null;
    if (hudDock.left.includes(item.id)) return 'left';
    if (hudDock.right.includes(item.id)) return 'right';
    return null;
  }, [hudDock.left, hudDock.right, item]);

  const isAnchored = useMemo(() => {
    if (!item) return false;
    return anchored.includes(item.id);
  }, [anchored, item]);

  const statusLabel = useMemo(() => {
    if (!item) return '';
    if (dockSideForItem) return dockSideForItem === 'left' ? 'Docked L' : 'Docked R';
    if (isAnchored) return 'Anchored';
    if (overlayLayout.mode !== 'free') return 'Formation';
    return 'Free';
  }, [dockSideForItem, isAnchored, item, overlayLayout.mode]);

  const dockItem = useCallback((side: 'left' | 'right') => {
    if (!item) return;
    setAnchored((prev) => prev.filter((x) => x !== item.id));
    setHudDock((prev) => {
      const without = {
        left: prev.left.filter((x) => x !== item.id),
        right: prev.right.filter((x) => x !== item.id),
      };
      const nextSide = [item.id, ...(without[side] || [])].slice(0, 6);
      return side === 'left'
        ? { left: nextSide, right: without.right }
        : { left: without.left, right: nextSide };
    });
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [item, setAnchored, setHudDock]);

  const undockItem = useCallback(() => {
    if (!item) return;
    setHudDock((prev) => ({
      left: prev.left.filter((x) => x !== item.id),
      right: prev.right.filter((x) => x !== item.id),
    }));
    window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
  }, [item, setHudDock]);

  const toggleAnchor = useCallback(() => {
    if (!item) return;
    if (dockSideForItem) return;

    if (!anchored.includes(item.id)) {
      try {
        const el = document.querySelector(`[data-overlay-card-id="${item.id}"]`) as HTMLElement | null;
        if (el) {
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          if (Number.isFinite(m.m41) && Number.isFinite(m.m42)) {
            updateItemPosition(item.id, m.m41, m.m42);
          }
        }
      } catch {
        // ignore
      }

      setAnchored((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    } else {
      setAnchored((prev) => prev.filter((x) => x !== item.id));
    }
  }, [anchored, dockSideForItem, item, setAnchored, updateItemPosition]);

  const setPose = (next: Partial<typeof DEFAULT_CARD_POSE>) => {
    if (!item) return;
    setPoses((prev) => {
      const current = { ...DEFAULT_CARD_POSE, ...(prev[item.id] || {}) };
      return { ...prev, [item.id]: { ...current, ...next } };
    });
  };

  useEffect(() => {
    if (!item) {
      setAnchorRect(null);
      lastRectRef.current = null;
      lastMeasureAtRef.current = 0;
      if (rafMeasureRef.current) window.cancelAnimationFrame(rafMeasureRef.current);
      if (followRafRef.current) window.cancelAnimationFrame(followRafRef.current);
      rafMeasureRef.current = 0;
      followRafRef.current = 0;
      followUntilRef.current = 0;
      return;
    }

    const measureNow = () => {
      const overlayEl = document.querySelector(
        `[data-overlay-card-id="${CSS.escape(String(item.id))}"]`,
      ) as HTMLElement | null;

      const rect = overlayEl?.getBoundingClientRect() || null;
      if (!rect) {
        if (lastRectRef.current) {
          lastRectRef.current = null;
          setAnchorRect(null);
        }
        return;
      }

      const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      const prev = lastRectRef.current;
      const changed =
        !prev ||
        prev.left !== next.left ||
        prev.top !== next.top ||
        prev.width !== next.width ||
        prev.height !== next.height;

      if (changed) {
        lastRectRef.current = next;
        setAnchorRect(rect);
      }
    };

    const scheduleMeasure = () => {
      if (rafMeasureRef.current) return;
      rafMeasureRef.current = window.requestAnimationFrame(() => {
        rafMeasureRef.current = 0;
        const now = performance.now();
        if (now - lastMeasureAtRef.current < 33) return;
        lastMeasureAtRef.current = now;
        measureNow();
      });
    };

    const startFollow = (ms: number) => {
      followUntilRef.current = performance.now() + ms;
      if (followRafRef.current) return;
      const tick = () => {
        followRafRef.current = 0;
        scheduleMeasure();
        if (performance.now() < followUntilRef.current) {
          followRafRef.current = window.requestAnimationFrame(tick);
        }
      };
      followRafRef.current = window.requestAnimationFrame(tick);
    };

    const onMoved = (e: Event) => {
      const ev = e as CustomEvent<{ id?: string }>;
      if (ev?.detail?.id !== item.id) return;
      scheduleMeasure();
    };

    const onLayoutTick = () => {
      scheduleMeasure();
      // Formation mode changes animate card movement; follow briefly.
      startFollow(520);
    };

    const onResize = () => scheduleMeasure();
    const onScroll = () => scheduleMeasure();

    window.addEventListener('hapa.overlayCard.moved', onMoved as EventListener);
    window.addEventListener('hapa.overlay.layoutTick', onLayoutTick);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);

    // Initial measure and short follow (covers initial mount and "snap" animations)
    scheduleMeasure();
    startFollow(420);

    return () => {
      window.removeEventListener('hapa.overlayCard.moved', onMoved as EventListener);
      window.removeEventListener('hapa.overlay.layoutTick', onLayoutTick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);

      if (rafMeasureRef.current) window.cancelAnimationFrame(rafMeasureRef.current);
      if (followRafRef.current) window.cancelAnimationFrame(followRafRef.current);
      rafMeasureRef.current = 0;
      followRafRef.current = 0;
      followUntilRef.current = 0;
    };
  }, [item?.id]);

  useEffect(() => {
    if (!item) {
      setFullRecord(null);
      setP2pStatus({ loading: false, error: null, fetchedAt: null, coreName: null });
      return;
    }

    let cancelled = false;

    const data: any = item.data || {};
    const coreName = data.coreName || data.cardId || item.id;

    const run = async () => {
      if (!window.electronAPI?.p2pRead) return;
      setP2pStatus({ loading: true, error: null, fetchedAt: null, coreName: String(coreName) });
      try {
        const records = await window.electronAPI.p2pRead(coreName, { reverse: true, limit: 16 });
        if (!Array.isArray(records) || records.length === 0) {
          if (!cancelled) setP2pStatus({ loading: false, error: null, fetchedAt: Date.now(), coreName: String(coreName) });
          return;
        }
        for (let i = 0; i < records.length; i++) {
          try {
            const parsed = JSON.parse(records[i]);
            if (parsed) {
              if (!cancelled) {
                setFullRecord(parsed);
                setP2pStatus({ loading: false, error: null, fetchedAt: Date.now(), coreName: String(coreName) });
              }
              return;
            }
          } catch {
          }
        }
        if (!cancelled) setP2pStatus({ loading: false, error: 'No parseable record found', fetchedAt: Date.now(), coreName: String(coreName) });
      } catch {
        if (!cancelled) setP2pStatus({ loading: false, error: 'p2pRead failed', fetchedAt: Date.now(), coreName: String(coreName) });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    setShowAllMeta(false);
    setShowAllRecord(false);
    setRowFilter('');
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;

      if (e.key === 'Escape') {
        setPinnedItemId(null);
        setSelectedItemId(null);
      }

      if (e.key === 'p' || e.key === 'P') {
        setPinnedItemId((prev) => (prev ? null : item.id));
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShowHelp((v) => !v);
      }

      if (e.key === 'o' || e.key === 'O') {
        if (isDraggingOverlay) return;
        const next = !autoPinOnDrag;
        window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.set', { detail: { value: next } }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [autoPinOnDrag, item, isDraggingOverlay, setSelectedItemId]);

  useEffect(() => {
    if (!item) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      if (isPinned) return;
      if (isDraggingOverlay) return;
      setSelectedItemId(null);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [item, isPinned, isDraggingOverlay, setSelectedItemId]);

  useEffect(() => {
    const onHudRect = (e: Event) => {
      const ev = e as CustomEvent<{ rect?: { left: number; top: number; width: number; height: number } }>;
      const r = ev?.detail?.rect;
      if (!r) return;
      if (typeof r.left !== 'number' || typeof r.top !== 'number' || typeof r.width !== 'number' || typeof r.height !== 'number') return;
      setHudRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    const onBottomDockRect = (e: Event) => {
      const ev = e as CustomEvent<{ rect?: { left: number; top: number; width: number; height: number } }>;
      const r = ev?.detail?.rect;
      if (!r) return;
      if (typeof r.left !== 'number' || typeof r.top !== 'number' || typeof r.width !== 'number' || typeof r.height !== 'number') return;
      setBottomDockRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };

    window.addEventListener('hapa.overlayHud.rect', onHudRect as EventListener);
    window.addEventListener('hapa.bottomDock.rect', onBottomDockRect as EventListener);
    return () => {
      window.removeEventListener('hapa.overlayHud.rect', onHudRect as EventListener);
      window.removeEventListener('hapa.bottomDock.rect', onBottomDockRect as EventListener);
    };
  }, []);

  const panelPos = useMemo(() => {
    if (!anchorRect) return null;

    const gap = 12;
    const marginX = 10;
    const marginTop = 70;
    const marginBottom = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const getMaxWidthFor = (side: 'left' | 'right' | 'above' | 'below') => {
      if (side === 'left') return Math.max(260, Math.min(520, anchorRect.left - gap - marginX));
      if (side === 'right') return Math.max(260, Math.min(520, vw - (anchorRect.right + gap) - marginX));
      return Math.max(260, Math.min(520, vw - marginX * 2));
    };

    const computeMaxH = (top: number) => {
      const max = vh - top - marginBottom;
      return clamp(520, 220, max);
    };

    const clampLeft = (x: number, w: number) => clamp(x, marginX, vw - w - marginX);
    const clampTop = (y: number, maxH: number) => {
      const maxTop = Math.max(marginTop, vh - maxH - marginBottom);
      return clamp(y, marginTop, maxTop);
    };

    const cx = anchorRect.left + anchorRect.width / 2;
    const leftCandidate = {
      name: 'left',
      left: anchorRect.left - gap,
      top: anchorRect.top - 16,
    };
    const rightCandidate = {
      name: 'right',
      left: anchorRect.right + gap,
      top: anchorRect.top - 16,
    };
    const aboveCandidate = {
      name: 'above',
      left: cx,
      top: anchorRect.top - gap,
    };
    const belowCandidate = {
      name: 'below',
      left: cx,
      top: anchorRect.bottom + gap,
    };

    const candidates = [leftCandidate, rightCandidate, aboveCandidate, belowCandidate].map((c) => {
      let top = c.top;

      const w = clamp(340, 260, getMaxWidthFor(c.name as any));

      if (c.name === 'above') {
        const maxH = clamp(520, 220, anchorRect.top - marginTop - gap);
        const clampedLeft = clampLeft(cx - w / 2, w);
        const clampedTop = clampTop(anchorRect.top - gap - maxH, maxH);
        return { name: c.name, left: clampedLeft, top: clampedTop, width: w, maxH };
      }

      if (c.name === 'below') {
        const clampedLeft = clampLeft(cx - w / 2, w);
        const maxH = clamp(520, 220, vh - (anchorRect.bottom + gap) - marginBottom);
        const clampedTop = clampTop(anchorRect.bottom + gap, maxH);
        return { name: c.name, left: clampedLeft, top: clampedTop, width: w, maxH };
      }

      const maxH = computeMaxH(marginTop);
      top = clampTop(anchorRect.top + anchorRect.height / 2 - maxH / 2, maxH);
      const left = c.name === 'left'
        ? clampLeft(anchorRect.left - gap - w, w)
        : clampLeft(anchorRect.right + gap, w);
      return { name: c.name, left, top, width: w, maxH };
    });

    const score = (p: { name: string; left: number; top: number; width: number; maxH: number }) => {
      const viewport = { left: marginX, top: marginTop, right: vw - marginX, bottom: vh - marginBottom };
      const r = { left: p.left, top: p.top, right: p.left + p.width, bottom: p.top + p.maxH };
      const ix = Math.max(0, Math.min(r.right, viewport.right) - Math.max(r.left, viewport.left));
      const iy = Math.max(0, Math.min(r.bottom, viewport.bottom) - Math.max(r.top, viewport.top));
      const area = ix * iy;

      const overlapArea = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => {
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return ox * oy;
      };

      let penalty = 0;
      const avoid: Array<{ left: number; top: number; right: number; bottom: number }> = [];
      if (hudRect) avoid.push({ left: hudRect.left, top: hudRect.top, right: hudRect.left + hudRect.width, bottom: hudRect.top + hudRect.height });
      if (bottomDockRect) avoid.push({ left: bottomDockRect.left, top: bottomDockRect.top, right: bottomDockRect.left + bottomDockRect.width, bottom: bottomDockRect.top + bottomDockRect.height });
      for (const a of avoid) {
        penalty += overlapArea(r, a);
      }

      const preferredForDocked = dockSideForItem === 'left' ? 'right' : dockSideForItem === 'right' ? 'left' : null;
      const dockBias = preferredForDocked && p.name === preferredForDocked ? 80000 : 0;
      const dockPenaltyBias = dockSideForItem && p.name === dockSideForItem ? -20000 : 0;
      const prefBias = !dockSideForItem && placementPref && p.name === placementPref ? 2500 : 0;
      return area + prefBias + dockBias + dockPenaltyBias - penalty * 1.35;
    };

    candidates.sort((a, b) => score(b) - score(a));
    return candidates[0];
  }, [anchorRect, placementPref, hudRect, bottomDockRect, dockSideForItem]);

  useEffect(() => {
    if (!panelPos?.name) return;
    if (dockSideForItem) return;
    if (panelPos.name === placementPref) return;
    setPlacementPref(panelPos.name);
  }, [panelPos?.name, placementPref, dockSideForItem]);

  if (!item || !panelPos) return null;

  const data: any = item.data || {};
  const coreName = data.coreName || data.cardId || item.id;
  const localRecord: any = data.cardRecord || data.raw || {};
  const localMetadata: any = localRecord.metadata || data.metadata || {};
  const p2pRecord: any = fullRecord || null;
  const p2pMetadata: any = p2pRecord?.metadata || {};

  const record: any = p2pRecord || localRecord || {};
  const metadata: any = record.metadata || localMetadata || {};

  const name = data.name || record.name || data.cardId || item.id;
  const thumbnail = data.thumbnail || record.thumbnail || metadata.thumbnail;
  const lore = record.lore || record.description || metadata.lore || metadata.description || '';
  const desires = record.desires || metadata.desires || '';
  const skills = record.skills || metadata.skills || [];

  const localThumbnail = data.thumbnail || localRecord.thumbnail || localMetadata.thumbnail || '';
  const p2pThumbnail = p2pRecord ? ((p2pRecord as any)?.thumbnail || (p2pMetadata as any)?.thumbnail || '') : '';

  const localLore =
    localRecord.lore || localRecord.description || localMetadata.lore || localMetadata.description || '';
  const p2pLore = p2pRecord
    ? ((p2pRecord as any)?.lore || (p2pRecord as any)?.description || (p2pMetadata as any)?.lore || (p2pMetadata as any)?.description || '')
    : '';

  const localDesires = localRecord.desires || localMetadata.desires || '';
  const p2pDesires = p2pRecord ? ((p2pRecord as any)?.desires || (p2pMetadata as any)?.desires || '') : '';

  const localSkills = localRecord.skills || localMetadata.skills || [];
  const p2pSkills = p2pRecord ? ((p2pRecord as any)?.skills || (p2pMetadata as any)?.skills || []) : [];

  const formattedSkills = (skills || []).map((s: any) => (typeof s === 'string' ? s : s?.name || s?.id || 'Unknown Skill'));

  const z = Math.round(Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, zOffsets[item.id] ?? 0)));

  const cardId = data.cardId || record.cardId || metadata.cardId || '';
  const mediaKind = data.mediaKind || record.mediaKind || metadata.mediaKind || '';
  const createdAt = data.createdAt || record.createdAt || metadata.createdAt || '';
  const tier = data.tier || record.tier || metadata.tier || '';

  const localCardId = data.cardId || localRecord.cardId || localMetadata.cardId || '';
  const localMediaKind = data.mediaKind || localRecord.mediaKind || localMetadata.mediaKind || '';
  const localCreatedAt = data.createdAt || localRecord.createdAt || localMetadata.createdAt || '';
  const localTier = data.tier || localRecord.tier || localMetadata.tier || '';

  const p2pCardId = p2pRecord ? ((p2pRecord as any)?.cardId || (p2pMetadata as any)?.cardId || '') : '';
  const p2pMediaKind = p2pRecord ? ((p2pRecord as any)?.mediaKind || (p2pMetadata as any)?.mediaKind || '') : '';
  const p2pCreatedAt = p2pRecord ? ((p2pRecord as any)?.createdAt || (p2pMetadata as any)?.createdAt || '') : '';
  const p2pTier = p2pRecord ? ((p2pRecord as any)?.tier || (p2pMetadata as any)?.tier || '') : '';

  const metaRows: Array<{ k: string; v: string; copy?: string }> = [];
  metaRows.push({ k: 'id', v: String(item.id) });
  metaRows.push({ k: 'coreName', v: String(coreName), copy: String(coreName) });
  metaRows.push({ k: 'dock', v: dockSideForItem ? String(dockSideForItem) : 'free' });
  metaRows.push({ k: 'status', v: statusLabel || '' });
  metaRows.push({ k: 'z', v: String(z) });
  if (cardId) metaRows.push({ k: 'cardId', v: String(cardId), copy: String(cardId) });
  if (mediaKind) metaRows.push({ k: 'mediaKind', v: String(mediaKind) });
  if (createdAt) metaRows.push({ k: 'createdAt', v: formatMaybeIsoDate(createdAt) });
  if (tier) metaRows.push({ k: 'tier', v: String(tier) });

  const metaTitle = formatMetaValue(metadata.title);
  const metaSource = formatMetaValue(metadata.source);
  const metaUrl = formatMetaValue(metadata.url);
  const metaTags = formatMetaValue(metadata.tags);
  if (metaTitle) metaRows.push({ k: 'title', v: metaTitle });
  if (metaSource) metaRows.push({ k: 'source', v: metaSource });
  if (metaUrl) metaRows.push({ k: 'url', v: metaUrl, copy: metaUrl });
  if (metaTags) metaRows.push({ k: 'tags', v: metaTags });

  type FieldSource = { short: string; title: string; className: string };
  const srcChip = useCallback((s: FieldSource) => {
    return (
      <div
        className={`flex-shrink-0 px-1.5 py-[2px] rounded-md border text-[8px] font-bold font-mono tracking-widest ${s.className}`}
        title={s.title}
      >
        {s.short}
      </div>
    );
  }, []);

  const normalizeCmp = useCallback((v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }, []);

  const isEmptyValue = useCallback((v: unknown): boolean => {
    if (v == null) return true;
    if (typeof v === 'string') return !v.trim();
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length === 0;
    return false;
  }, []);

  const computeSource = useCallback(
    (hasP2p: boolean, localVal: unknown, p2pVal: unknown): FieldSource => {
      if (!hasP2p) {
        return { short: 'L', title: 'source: local', className: 'border-gray-700/60 bg-gray-900/30 text-gray-300' };
      }

      const l = normalizeCmp(localVal);
      const p = normalizeCmp(p2pVal);
      if (isEmptyValue(localVal)) {
        return { short: 'P', title: 'source: p2p', className: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' };
      }
      if (l === p) {
        return { short: 'B', title: 'source: both (same)', className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' };
      }
      return { short: 'O', title: 'source: p2p overrides local', className: 'border-amber-400/40 bg-amber-500/10 text-amber-100' };
    },
    [isEmptyValue, normalizeCmp],
  );

  const contentSourceByKey = useMemo(() => {
    const hasP2p = !!p2pRecord;
    const out: Record<string, FieldSource> = {};
    out.thumbnail = computeSource(hasP2p, localThumbnail, p2pThumbnail);
    out.lore = computeSource(hasP2p, localLore, p2pLore);
    out.desires = computeSource(hasP2p, localDesires, p2pDesires);
    out.skills = computeSource(hasP2p, localSkills, p2pSkills);
    return out;
  }, [computeSource, localDesires, localLore, localSkills, localThumbnail, p2pDesires, p2pLore, p2pRecord, p2pSkills, p2pThumbnail]);

  const metaSourceByKey = useMemo(() => {
    const hasP2p = !!p2pRecord;
    const out: Record<string, FieldSource> = {};
    const localOverride = (): FieldSource => ({
      short: 'L',
      title: 'source: local (item.data)',
      className: 'border-gray-700/60 bg-gray-900/30 text-gray-300',
    });

    const systemDerived = (label: string): FieldSource => ({
      short: 'L',
      title: `source: system (${label})`,
      className: 'border-gray-700/60 bg-gray-900/30 text-gray-300',
    });

    out.id = systemDerived('overlay item');
    out.coreName = systemDerived('p2p key');
    out.dock = systemDerived('overlay state');
    out.status = systemDerived('overlay state');
    out.z = systemDerived('overlay state');

    out.title = computeSource(hasP2p, (localMetadata as any)?.title, (p2pMetadata as any)?.title);
    out.source = computeSource(hasP2p, (localMetadata as any)?.source, (p2pMetadata as any)?.source);
    out.url = computeSource(hasP2p, (localMetadata as any)?.url, (p2pMetadata as any)?.url);
    out.tags = computeSource(hasP2p, (localMetadata as any)?.tags, (p2pMetadata as any)?.tags);

    out.cardId = data.cardId ? localOverride() : computeSource(hasP2p, localCardId, p2pCardId);
    out.mediaKind = data.mediaKind ? localOverride() : computeSource(hasP2p, localMediaKind, p2pMediaKind);
    out.createdAt = data.createdAt
      ? localOverride()
      : computeSource(hasP2p, formatMaybeIsoDate(localCreatedAt), formatMaybeIsoDate(p2pCreatedAt));
    out.tier = data.tier ? localOverride() : computeSource(hasP2p, localTier, p2pTier);
    return out;
  }, [computeSource, data.cardId, data.createdAt, data.mediaKind, data.tier, localCardId, localCreatedAt, localMediaKind, localMetadata, localTier, p2pCardId, p2pCreatedAt, p2pMediaKind, p2pMetadata, p2pRecord, p2pTier]);

  const p2pStatusLabel = useMemo(() => {
    if (!p2pStatus.coreName) return '';
    if (p2pStatus.loading) return 'P2P: loading…';
    if (p2pStatus.error) return `P2P: ${p2pStatus.error}`;
    if (p2pStatus.fetchedAt) {
      try {
        return `P2P: ok @ ${new Date(p2pStatus.fetchedAt).toLocaleTimeString()}`;
      } catch {
        return 'P2P: ok';
      }
    }
    return 'P2P: idle';
  }, [p2pStatus.coreName, p2pStatus.error, p2pStatus.fetchedAt, p2pStatus.loading]);

  const p2pStatusTitle = useMemo(() => {
    if (!p2pStatus.coreName) return '';
    const src = fullRecord ? 'resolved (p2p)' : 'local (item.data)';
    return `coreName: ${p2pStatus.coreName} · source: ${src}`;
  }, [fullRecord, p2pStatus.coreName]);

  const safeExternalUrl = useMemo(() => {
    const raw = String(metaUrl || '').trim();
    if (!raw) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  }, [metaUrl]);

  const openExternalUrl = useCallback(async (url: string) => {
    const raw = String(url || '').trim();
    if (!raw) return;
    try {
      const w = window.open(raw, '_blank', 'noopener,noreferrer');
      if (w) return;
    } catch {
      // ignore
    }
    await copyToClipboard(raw);
    setCopiedHint('url');
    window.setTimeout(() => setCopiedHint((v) => (v === 'url' ? null : v)), 900);
  }, []);

  const rawJsonText = useMemo(() => {
    try {
      const payload = {
        id: item.id,
        coreName,
        data,
        record,
        metadata,
        fullRecord,
      };
      const json = JSON.stringify(payload, null, 2);
      if (json.length > 24000) return json.slice(0, 24000) + '\n… (truncated)';
      return json;
    } catch {
      return '';
    }
  }, [coreName, data, fullRecord, item.id, metadata, record]);

  const recordType = formatMetaValue((record as any)?.type) || formatMetaValue((record as any)?.recordType) || formatMetaValue((record as any)?.kind);
  const recordVersion = formatMetaValue((record as any)?.version) || formatMetaValue((record as any)?.schemaVersion);
  const recordId = formatMetaValue((record as any)?.id) || formatMetaValue((record as any)?.cardId);

  const localRecordType =
    formatMetaValue((localRecord as any)?.type) || formatMetaValue((localRecord as any)?.recordType) || formatMetaValue((localRecord as any)?.kind);
  const localRecordVersion = formatMetaValue((localRecord as any)?.version) || formatMetaValue((localRecord as any)?.schemaVersion);
  const localRecordId = formatMetaValue((localRecord as any)?.id) || formatMetaValue((localRecord as any)?.cardId);
  const p2pRecordType = p2pRecord
    ? formatMetaValue((p2pRecord as any)?.type) || formatMetaValue((p2pRecord as any)?.recordType) || formatMetaValue((p2pRecord as any)?.kind)
    : '';
  const p2pRecordVersion = p2pRecord ? formatMetaValue((p2pRecord as any)?.version) || formatMetaValue((p2pRecord as any)?.schemaVersion) : '';
  const p2pRecordId = p2pRecord ? formatMetaValue((p2pRecord as any)?.id) || formatMetaValue((p2pRecord as any)?.cardId) : '';

  const recordSourceByKey = useMemo(() => {
    const hasP2p = !!p2pRecord;
    const out: Record<string, FieldSource> = {};
    out.type = computeSource(hasP2p, localRecordType, p2pRecordType);
    out.version = computeSource(hasP2p, localRecordVersion, p2pRecordVersion);
    out.recordId = computeSource(hasP2p, localRecordId, p2pRecordId);
    return out;
  }, [computeSource, localRecordId, localRecordType, localRecordVersion, p2pRecord, p2pRecordId, p2pRecordType, p2pRecordVersion]);
  const recordRows: Array<{ k: string; v: string }> = [];
  if (recordType) recordRows.push({ k: 'type', v: recordType });
  if (recordVersion) recordRows.push({ k: 'version', v: recordVersion });
  if (recordId && recordId !== String(cardId)) recordRows.push({ k: 'recordId', v: recordId });

  const normalizedFilter = useMemo(() => rowFilter.trim().toLowerCase(), [rowFilter]);

  const filteredMetaRows = useMemo(() => {
    if (!normalizedFilter) return metaRows;
    return metaRows.filter((r) => {
      const hay = `${r.k}:${r.v}`.toLowerCase();
      return hay.includes(normalizedFilter);
    });
  }, [metaRows, normalizedFilter]);

  const filteredRecordRows = useMemo(() => {
    if (!normalizedFilter) return recordRows;
    return recordRows.filter((r) => {
      const hay = `${r.k}:${r.v}`.toLowerCase();
      return hay.includes(normalizedFilter);
    });
  }, [recordRows, normalizedFilter]);

  const visibleMetaRows = useMemo(() => {
    return showAllMeta ? filteredMetaRows : filteredMetaRows.slice(0, 10);
  }, [filteredMetaRows, showAllMeta]);

  const visibleRecordRows = useMemo(() => {
    return showAllRecord ? filteredRecordRows : filteredRecordRows.slice(0, 6);
  }, [filteredRecordRows, showAllRecord]);

  const copyRowsAsText = useCallback(async (rows: Array<{ k: string; v: string }>, hint: string) => {
    const text = rows.map((r) => `${r.k}: ${r.v}`).join('\n');
    await copyToClipboard(text);
    setCopiedHint(hint);
    window.setTimeout(() => setCopiedHint((v) => (v === hint ? null : v)), 900);
  }, []);

  const toggleFieldPin = useCallback((coreName: string, kind: 'meta' | 'record', key: string) => {
    const pinKey = `${kind}:${key}`;
    setFieldPinsByCore((prev) => {
      const current = Array.isArray(prev?.[coreName]) ? prev[coreName] : [];
      const exists = current.includes(pinKey);
      const next = exists ? current.filter((x) => x !== pinKey) : [pinKey, ...current];
      return { ...(prev || {}), [coreName]: next };
    });
  }, []);

  const bulkPinFields = useCallback((coreName: string, kind: 'meta' | 'record', keys: string[]) => {
    const k = String(coreName || '');
    if (!k) return;
    const uniqKeys = Array.from(new Set((keys || []).map((x) => String(x)).filter(Boolean)));
    if (uniqKeys.length === 0) return;
    const pinKeys = uniqKeys.map((key) => `${kind}:${key}`);
    setFieldPinsByCore((prev) => {
      const current = Array.isArray(prev?.[k]) ? prev[k] : [];
      const withoutDups = current.filter((x) => !pinKeys.includes(x));
      return { ...(prev || {}), [k]: [...pinKeys, ...withoutDups] };
    });
  }, []);

  const bulkUnpinAllForKind = useCallback((coreName: string, kind: 'meta' | 'record') => {
    const k = String(coreName || '');
    if (!k) return;
    setFieldPinsByCore((prev) => {
      const current = Array.isArray(prev?.[k]) ? prev[k] : [];
      const next = current.filter((x) => !String(x).startsWith(`${kind}:`));
      return { ...(prev || {}), [k]: next };
    });
  }, []);

  const pinnedKeysForCore = useMemo(() => {
    const k = String(coreName || '');
    if (!k) return [] as string[];
    const arr = fieldPinsByCore?.[k];
    return Array.isArray(arr) ? arr : [];
  }, [coreName, fieldPinsByCore]);

  const pinnedKeySet = useMemo(() => new Set(pinnedKeysForCore), [pinnedKeysForCore]);

  const pinnedRows = useMemo(() => {
    const core = String(coreName || '');
    if (!core) return [] as Array<{ kind: 'meta' | 'record'; k: string; v: string; copy?: string }>;

    const out: Array<{ kind: 'meta' | 'record'; k: string; v: string; copy?: string }> = [];
    for (const pin of pinnedKeysForCore) {
      const [kindRaw, key] = String(pin).split(':', 2);
      const kind = kindRaw === 'record' ? 'record' : kindRaw === 'meta' ? 'meta' : null;
      if (!kind || !key) continue;
      if (kind === 'meta') {
        const row = metaRows.find((r) => r.k === key);
        if (row) out.push({ kind, k: row.k, v: row.v, copy: row.copy });
      }
      if (kind === 'record') {
        const row = recordRows.find((r) => r.k === key);
        if (row) out.push({ kind, k: row.k, v: row.v });
      }
    }
    return out;
  }, [coreName, metaRows, pinnedKeysForCore, recordRows]);

  const returnLabel = item.type === 'HAND_CARD' ? 'Return Hand' : 'Return';

  const shortcutsLabel = showHelp
    ? 'hide help: ?'
    : '[ / ] / Ctrl+[ ] / Shift+Wheel / Ctrl+Shift+Wheel depth · Shift+←/→ dock · Shift+↓ undock · A anchor · Del return · C camera · P pin · O auto-pin · ? help';

  return createPortal(
    <div
      ref={panelRef}
      data-overlay-details="true"
      className="fixed z-[2147483600] pointer-events-auto"
      style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width, maxHeight: panelPos.maxH }}
    >
      <div className="relative rounded-xl border border-cyan-500/20 bg-gradient-to-b from-gray-950/75 to-gray-950/50 shadow-[0_0_30px_rgba(34,211,238,0.10)] backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/6 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        </div>

        <div className="relative px-3 py-2 border-b border-cyan-500/15 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Card Details</div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-mono font-semibold text-white truncate" title={String(name)}>{String(name)}</div>
              {statusLabel ? (
                <div className={`flex-shrink-0 px-2 py-[2px] rounded-full border text-[9px] font-bold uppercase tracking-[0.22em] ${dockSideForItem ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : isAnchored ? 'border-purple-400/40 bg-purple-500/10 text-purple-100' : overlayLayout.mode !== 'free' ? 'border-gray-500/40 bg-gray-900/30 text-gray-200' : 'border-gray-700/60 bg-gray-900/20 text-gray-400'}`}
                >
                  {statusLabel}
                </div>
              ) : null}
              {isPinned ? (
                <div className="flex-shrink-0 px-2 py-[2px] rounded-full border border-cyan-400/40 bg-cyan-500/10 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-100">
                  Pinned
                </div>
              ) : null}
              <div
                className={`flex-shrink-0 px-2 py-[2px] rounded-full border text-[9px] font-bold uppercase tracking-[0.22em] ${isDraggingOverlay ? 'opacity-60' : ''} ${autoPinOnDrag ? 'border-amber-400/40 bg-amber-500/10 text-amber-100' : 'border-gray-700/60 bg-gray-900/20 text-gray-400'}`}
                title={isDraggingOverlay ? 'Auto-pin while dragging: locked during drag' : (autoPinOnDrag ? 'Auto-pin while dragging: on (O)' : 'Auto-pin while dragging: off (O)')}
              >
                Auto: {autoPinOnDrag ? 'On' : 'Off'}
              </div>
              {isDragFrozen ? (
                <div
                  className="flex-shrink-0 px-2 py-[2px] rounded-full border border-amber-400/40 bg-amber-500/10 text-[9px] font-bold uppercase tracking-[0.22em] text-amber-100"
                  title={`Frozen on: ${String(activeItemId)}`}
                >
                  Dragging…
                </div>
              ) : null}
            </div>
            <div className="text-[9px] font-mono text-gray-500">{shortcutsLabel}</div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              title="Toggle help (?)"
              className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${showHelp ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
            >
              ?
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDraggingOverlay) return;
                const next = !autoPinOnDrag;
                window.dispatchEvent(new CustomEvent('hapa.overlayDetails.autoPinOnDrag.set', { detail: { value: next } }));
              }}
              title={isDraggingOverlay ? 'Auto-pin while dragging: locked during drag' : (autoPinOnDrag ? 'Auto-pin while dragging: on (O)' : 'Auto-pin while dragging: off (O)')}
              disabled={isDraggingOverlay}
              className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.22em] ${isDraggingOverlay ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800/50'} ${autoPinOnDrag ? 'border-amber-400/40 bg-amber-500/10 text-amber-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
            >
              Auto
            </button>

            <button
              type="button"
              onClick={() => setPinnedItemId((prev) => (prev ? null : item.id))}
              title={isPinned ? 'Unpin (P)' : 'Pin (P)'}
              className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${isPinned ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
            >
              Pin
            </button>

            <button
              type="button"
              onClick={() => {
                setPinnedItemId(null);
                setSelectedItemId(null);
              }}
              title="Close (Esc)"
              className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative p-3 space-y-3 overflow-auto" style={{ maxHeight: panelPos.maxH }}>
          {showHelp ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Shortcuts</div>
              <div className="space-y-1 text-[10px] font-mono text-gray-300">
                <div><span className="text-gray-500">[ / ]</span> depth down/up</div>
                <div><span className="text-gray-500">Ctrl+[ / ]</span> depth down/up (fine)</div>
                <div><span className="text-gray-500">Shift+Wheel</span> depth down/up</div>
                <div><span className="text-gray-500">Ctrl+Shift+Wheel</span> depth down/up (fine)</div>
                <div><span className="text-gray-500">A</span> anchor/unanchor selected</div>
                <div><span className="text-gray-500">Del</span> return card</div>
                <div><span className="text-gray-500">C</span> toggle camera mode</div>
                <div><span className="text-gray-500">P</span> pin/unpin panel</div>
                <div><span className="text-gray-500">O</span> toggle auto-pin while dragging</div>
                <div><span className="text-gray-500">?</span> toggle this help</div>
                <div><span className="text-gray-500">Esc</span> close panel</div>
              </div>
            </div>
          ) : null}

          <div className="flex gap-3">
            <div className="relative w-16 h-24 rounded-lg overflow-hidden border border-gray-700/60 bg-gray-900/40 flex-shrink-0">
              {thumbnail ? (
                <img src={thumbnail} alt={String(name)} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 rounded border border-gray-600 bg-gray-800/40" />
                </div>
              )}
              {thumbnail && contentSourceByKey?.thumbnail ? (
                <div className="absolute top-1 right-1">
                  {srcChip(contentSourceByKey.thumbnail)}
                </div>
              ) : null}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPinnedItemId(null);
                    removeItem(item.id);
                  }}
                  title="Return card (Del)"
                  className="flex-1 px-2 py-[6px] rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 hover:bg-cyan-500/15"
                >
                  {returnLabel}
                </button>

                <button
                  onClick={() => setPose({ cameraMode: !pose.cameraMode })}
                  title="Toggle camera (C)"
                  className={`flex-1 px-2 py-[6px] rounded-lg border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/60 ${pose.cameraMode ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                >
                  Camera
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => dockItem('left')}
                  title={dockSideForItem === 'left' ? 'Docked left' : 'Dock this card to HUD left rail'}
                  className={`flex-1 px-2 py-[6px] rounded-lg border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/60 ${dockSideForItem === 'left' ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                >
                  Dock L
                </button>
                <button
                  onClick={() => dockItem('right')}
                  title={dockSideForItem === 'right' ? 'Docked right' : 'Dock this card to HUD right rail'}
                  className={`flex-1 px-2 py-[6px] rounded-lg border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/60 ${dockSideForItem === 'right' ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                >
                  Dock R
                </button>
                <button
                  onClick={undockItem}
                  title={dockSideForItem ? 'Undock this card from HUD' : 'Not docked'}
                  className={`px-2 py-[6px] rounded-lg border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/60 ${dockSideForItem ? 'border-gray-600/60 bg-gray-800/50 text-gray-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-400'}`}
                >
                  UD
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-gray-900/20 px-2 py-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Anchor</div>
                <button
                  type="button"
                  onClick={toggleAnchor}
                  disabled={!item || !!dockSideForItem}
                  title={dockSideForItem ? 'Undock first to anchor' : isAnchored ? 'Unanchor (A)' : 'Anchor (A)'}
                  className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.22em] ${dockSideForItem ? 'border-gray-800/70 bg-gray-950/20 text-gray-600' : isAnchored ? 'border-purple-400/40 bg-purple-500/10 text-purple-100 hover:bg-purple-500/15' : 'border-gray-700/60 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'}`}
                >
                  {isAnchored ? 'Anchored' : 'Anchor'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-gray-900/20 px-2 py-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Depth</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;
                      setZOffsets((prev) => {
                        const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, (prev[item.id] ?? 0) - step));
                        return { ...prev, [item.id]: next };
                      });
                    }}
                    title="Decrease depth (Ctrl fine)"
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                  >
                    -
                  </button>
                  <div className="text-[10px] font-mono text-cyan-200 tabular-nums">{z}</div>
                  <button
                    onClick={(e) => {
                      const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;
                      setZOffsets((prev) => {
                        const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, (prev[item.id] ?? 0) + step));
                        return { ...prev, [item.id]: next };
                      });
                    }}
                    title="Increase depth (Ctrl fine)"
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {lore ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Lore</div>
                {contentSourceByKey?.lore ? srcChip(contentSourceByKey.lore) : null}
              </div>
              <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{String(lore)}</div>
            </div>
          ) : null}

          {formattedSkills.length > 0 ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Skills</div>
                {contentSourceByKey?.skills ? srcChip(contentSourceByKey.skills) : null}
              </div>
              <div className="space-y-1">
                {formattedSkills.slice(0, 8).map((skill: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
                    <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
                    <span className="truncate">{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {desires ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Desires</div>
                {contentSourceByKey?.desires ? srcChip(contentSourceByKey.desires) : null}
              </div>
              <div className="text-xs text-gray-400 italic leading-relaxed">"{String(desires)}"</div>
            </div>
          ) : null}

          {pinnedRows.length > 0 ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Pinned</div>
                  <div className="text-[9px] font-mono text-gray-600 tabular-nums">{pinnedRows.length}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      bulkPinFields(String(coreName), 'meta', visibleMetaRows.map((r) => r.k));
                      bulkPinFields(String(coreName), 'record', visibleRecordRows.map((r) => r.k));
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Pin visible Metadata + Record rows"
                    disabled={visibleMetaRows.length === 0 && visibleRecordRows.length === 0}
                  >
                    Pin Vis
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      bulkPinFields(String(coreName), 'meta', filteredMetaRows.map((r) => r.k));
                      bulkPinFields(String(coreName), 'record', filteredRecordRows.map((r) => r.k));
                    }}
                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${normalizedFilter ? 'border-gray-700/60 bg-gray-900/30 text-gray-300' : 'border-gray-800/70 bg-gray-950/20 text-gray-600'}`}
                    title={normalizedFilter ? 'Pin all filter matches (Metadata + Record)' : 'Add a filter to pin matches'}
                    disabled={!normalizedFilter || (filteredMetaRows.length === 0 && filteredRecordRows.length === 0)}
                  >
                    Pin Match
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const rows = pinnedRows.map((r) => ({ k: `${r.kind}.${r.k}`, v: r.v }));
                      await copyRowsAsText(rows, 'pins');
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Copy pinned fields"
                    disabled={pinnedRows.length === 0}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const k = String(coreName || '');
                      if (!k) return;
                      setFieldPinsByCore((prev) => {
                        const next = { ...(prev || {}) };
                        delete next[k];
                        return next;
                      });
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Clear pinned fields"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[88px_1fr_110px] gap-x-2 gap-y-1">
                {pinnedRows.map((row) => {
                  const pinKey = `${row.kind}:${row.k}`;
                  const src = row.kind === 'meta' ? metaSourceByKey?.[row.k] : recordSourceByKey?.[row.k];
                  return (
                    <React.Fragment key={pinKey}>
                      <div className="text-[10px] font-mono text-gray-500 truncate" title={`${row.kind}.${row.k}`}>{row.k}</div>
                      {row.copy ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await copyToClipboard(row.copy!);
                            setCopiedHint(row.k);
                            window.setTimeout(() => setCopiedHint((v) => (v === row.k ? null : v)), 900);
                          }}
                          className="text-left text-[10px] font-mono text-cyan-200/90 truncate hover:underline"
                          title={`Click to copy: ${row.v}`}
                        >
                          {row.v}
                        </button>
                      ) : (
                        <div className="text-[10px] font-mono text-gray-300 truncate" title={row.v}>{row.v}</div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        {src ? srcChip(src) : null}
                        <button
                          type="button"
                          onClick={() => toggleFieldPin(String(coreName), row.kind, row.k)}
                          className="px-2 py-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-100 hover:bg-cyan-500/15"
                          title="Unpin"
                        >
                          Unpin
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : null}

          {metaRows.length > 0 ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Metadata</div>
                  <div className="text-[9px] font-mono text-gray-600 tabular-nums">{visibleMetaRows.length}/{metaRows.length}</div>
                  {p2pStatusLabel ? (
                    <div className="text-[9px] font-mono text-gray-500 truncate" title={p2pStatusTitle}>{p2pStatusLabel}</div>
                  ) : null}
                  <button
                    type="button"
                    className="px-1.5 py-[2px] rounded-md border border-gray-700/60 bg-gray-900/30 text-[8px] font-bold font-mono tracking-widest text-gray-300 hover:bg-gray-800/50"
                    title={'Provenance chips: L=local · P=p2p · B=both (same) · O=p2p overrides local'}
                  >
                    L/P/B/O
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {safeExternalUrl ? (
                    <button
                      type="button"
                      onClick={() => openExternalUrl(safeExternalUrl)}
                      className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                      title={safeExternalUrl}
                    >
                      Open URL
                    </button>
                  ) : null}
                  {copiedHint ? (
                    <div className="text-[9px] font-mono text-cyan-300/80">Copied {copiedHint}</div>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      await copyRowsAsText(
                        visibleMetaRows.map((r) => ({ k: r.k, v: r.v })),
                        'meta',
                      );
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Copy displayed metadata"
                    disabled={visibleMetaRows.length === 0}
                  >
                    Copy
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkPinFields(String(coreName), 'meta', visibleMetaRows.map((r) => r.k))}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Pin visible metadata rows"
                    disabled={visibleMetaRows.length === 0}
                  >
                    Pin Vis
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkPinFields(String(coreName), 'meta', filteredMetaRows.map((r) => r.k))}
                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${normalizedFilter ? 'border-gray-700/60 bg-gray-900/30 text-gray-300' : 'border-gray-800/70 bg-gray-950/20 text-gray-600'}`}
                    title={normalizedFilter ? 'Pin all metadata rows matching filter' : 'Add a filter to pin matches'}
                    disabled={!normalizedFilter || filteredMetaRows.length === 0}
                  >
                    Pin Match
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkUnpinAllForKind(String(coreName), 'meta')}
                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${pinnedKeysForCore.some((x) => String(x).startsWith('meta:')) ? 'border-gray-700/60 bg-gray-900/30 text-gray-300' : 'border-gray-800/70 bg-gray-950/20 text-gray-600'}`}
                    title="Unpin all metadata fields"
                    disabled={!pinnedKeysForCore.some((x) => String(x).startsWith('meta:'))}
                  >
                    Unpin
                  </button>

                  {metaRows.length > 10 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllMeta((v) => !v)}
                      className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${showAllMeta ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                      title={showAllMeta ? 'Show fewer metadata rows' : 'Show all metadata rows'}
                    >
                      {showAllMeta ? 'Less' : 'More'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={rowFilter}
                  onChange={(e) => setRowFilter(e.target.value)}
                  placeholder="filter…"
                  className="flex-1 px-2 py-1 rounded-md border border-gray-700/60 bg-gray-950/25 text-[10px] font-mono text-gray-200 placeholder:text-gray-600"
                />
                {rowFilter ? (
                  <button
                    type="button"
                    onClick={() => setRowFilter('')}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Clear filter"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
                {visibleMetaRows.map((row) => (
                  <React.Fragment key={row.k}>
                    <div className="text-[10px] font-mono text-gray-500 truncate" title={row.k}>{row.k}</div>
                    {row.copy ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await copyToClipboard(row.copy!);
                            setCopiedHint(row.k);
                            window.setTimeout(() => setCopiedHint((v) => (v === row.k ? null : v)), 900);
                          }}
                          className="flex-1 min-w-0 text-left text-[10px] font-mono text-cyan-200/90 truncate hover:underline"
                          title={`Click to copy: ${row.v}`}
                        >
                          {row.v}
                        </button>
                        {metaSourceByKey?.[row.k] ? srcChip(metaSourceByKey[row.k]) : null}
                        <button
                          type="button"
                          onClick={() => toggleFieldPin(String(coreName), 'meta', row.k)}
                          className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${pinnedKeySet.has(`meta:${row.k}`) ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                          title={pinnedKeySet.has(`meta:${row.k}`) ? 'Unpin field' : 'Pin field'}
                        >
                          Pin
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-1 min-w-0 text-[10px] font-mono text-gray-300 truncate" title={row.v}>{row.v}</div>
                        {metaSourceByKey?.[row.k] ? srcChip(metaSourceByKey[row.k]) : null}
                        <button
                          type="button"
                          onClick={() => toggleFieldPin(String(coreName), 'meta', row.k)}
                          className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${pinnedKeySet.has(`meta:${row.k}`) ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                          title={pinnedKeySet.has(`meta:${row.k}`) ? 'Unpin field' : 'Pin field'}
                        >
                          Pin
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}

          {recordRows.length > 0 ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Record</div>
                  <div className="text-[9px] font-mono text-gray-600 tabular-nums">{visibleRecordRows.length}/{recordRows.length}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyRowsAsText(visibleRecordRows, 'record');
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Copy displayed record rows"
                    disabled={visibleRecordRows.length === 0}
                  >
                    Copy
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkPinFields(String(coreName), 'record', visibleRecordRows.map((r) => r.k))}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Pin visible record rows"
                    disabled={visibleRecordRows.length === 0}
                  >
                    Pin Vis
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkPinFields(String(coreName), 'record', filteredRecordRows.map((r) => r.k))}
                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${normalizedFilter ? 'border-gray-700/60 bg-gray-900/30 text-gray-300' : 'border-gray-800/70 bg-gray-950/20 text-gray-600'}`}
                    title={normalizedFilter ? 'Pin all record rows matching filter' : 'Add a filter to pin matches'}
                    disabled={!normalizedFilter || filteredRecordRows.length === 0}
                  >
                    Pin Match
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkUnpinAllForKind(String(coreName), 'record')}
                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${pinnedKeysForCore.some((x) => String(x).startsWith('record:')) ? 'border-gray-700/60 bg-gray-900/30 text-gray-300' : 'border-gray-800/70 bg-gray-950/20 text-gray-600'}`}
                    title="Unpin all record fields"
                    disabled={!pinnedKeysForCore.some((x) => String(x).startsWith('record:'))}
                  >
                    Unpin
                  </button>

                  {recordRows.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllRecord((v) => !v)}
                      className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${showAllRecord ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                      title={showAllRecord ? 'Show fewer record rows' : 'Show all record rows'}
                    >
                      {showAllRecord ? 'Less' : 'More'}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
                {visibleRecordRows.map((row) => (
                  <React.Fragment key={row.k}>
                    <div className="text-[10px] font-mono text-gray-500 truncate" title={row.k}>{row.k}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-1 min-w-0 text-[10px] font-mono text-gray-300 truncate" title={row.v}>{row.v}</div>
                      {recordSourceByKey?.[row.k] ? srcChip(recordSourceByKey[row.k]) : null}
                      <button
                        type="button"
                        onClick={() => toggleFieldPin(String(coreName), 'record', row.k)}
                        className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${pinnedKeySet.has(`record:${row.k}`) ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                        title={pinnedKeySet.has(`record:${row.k}`) ? 'Unpin field' : 'Pin field'}
                      >
                        Pin
                      </button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Raw JSON</div>
              <div className="flex items-center gap-1.5">
                {showRaw ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(rawJsonText);
                      setCopiedHint('raw');
                      window.setTimeout(() => setCopiedHint((v) => (v === 'raw' ? null : v)), 900);
                    }}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                    title="Copy raw JSON"
                    disabled={!rawJsonText}
                  >
                    Copy
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/50 ${showRaw ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                  title={showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
                >
                  {showRaw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {showRaw ? (
              <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-words max-h-64 overflow-auto rounded-lg border border-gray-800/70 bg-gray-950/30 p-2">{rawJsonText}</pre>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Pose</div>
              <button
                onClick={() => setPose({ tiltX: 0, tiltY: 0, rotZ: 0, zoom: 1 })}
                className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
              >
                Reset
              </button>
            </div>

            <SliderRow label="Tilt X" value={pose.tiltX} min={-30} max={30} onChange={(v) => setPose({ tiltX: v })} />
            <SliderRow label="Tilt Y" value={pose.tiltY} min={-30} max={30} onChange={(v) => setPose({ tiltY: v })} />
            <SliderRow label="Rot Z" value={pose.rotZ} min={-180} max={180} onChange={(v) => setPose({ rotZ: v })} />
            <SliderRow label="Zoom" value={pose.zoom * 100} min={60} max={170} step={1} onChange={(v) => setPose({ zoom: v / 100 })} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
