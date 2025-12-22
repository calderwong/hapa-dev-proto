import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate } from '../../hooks/useAnime';
import type { DragItem } from '../../contexts/DragCanvasContext';
import { useDragCanvas } from '../../contexts/DragCanvasContext';
import type { OverlayLayoutState } from '../../contexts/DragCanvasContext';
import { DEFAULT_CARD_POSE, getOverlayZBaseline, OVERLAY_CARD_Z_MAX, OVERLAY_CARD_Z_MIN, OVERLAY_CARD_Z_STEP } from '../../contexts/DragCanvasContext';
import { playCardClickSound, playCardDepthNudgeSound, playCardDropSound, playCardMoveTickSound, playCardPickUpSound, playCardSnapSound } from '../../utils/audio';

interface FloatingCardProps {
  item: DragItem;
  formationTarget?: { tx: number; ty: number; tz: number; rotZ: number; force?: boolean };
  overlayLayout: OverlayLayoutState;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({ item, formationTarget, overlayLayout }) => {
  const dragRef = useRef<HTMLDivElement>(null);   // Controls Position (TranslateX/Y)
  const visualRef = useRef<HTMLDivElement>(null); // Controls Effects (Scale, Rotate, Glow)
  const poseRef = useRef<HTMLDivElement>(null);   // Controls user pose (rotateX/rotateY/rotateZ + zoom)
  const {
    removeItem,
    snapZones,
    setOverlayLayout,
    selectedItemId,
    setSelectedItemId,
    zOffsets,
    setZOffsets,
    updateItemPosition,
    poses,
    hudDock,
    setHudDock,
    anchored,
    setAnchored,
  } = useDragCanvas();

  const [isHovered, setIsHovered] = useState(false);

  const portalColorMode = item.portalColorMode ?? overlayLayout.portalColorMode;

  // Track animation instances
  const anims = useRef<{ bob?: any; tilt?: any; pulse?: any }>({});

  const dragStateRef = useRef({ isDragging: false });

  const snapZonesRef = useRef(snapZones);

  const selectedItemIdRef = useRef<string | null>(null);

  const portalTargetModeRef = useRef(overlayLayout.portalTargetMode);

  const portalTargetPointRef = useRef(overlayLayout.portalTargetPoint);

  const portalColorModeRef = useRef(overlayLayout.portalColorMode);

  const zOffsetsRef = useRef(zOffsets);

  const hudDockRef = useRef(hudDock);

  const setHudDockRef = useRef(setHudDock);

  const posesRef = useRef(poses);

  const zDragRef = useRef({ startY: 0, startZ: 0, didAdjust: false, isAdjusting: false });

  const moveNotifyRef = useRef({ lastAt: 0 });

  const sessionStartRef = useRef({ tx: 0, ty: 0 });

  const sfxRef = useRef({ lastMoveAt: 0, lastMoveTx: 0, lastMoveTy: 0, lastNudgeAt: 0, lastZ: 0 });

  // Track drag state
  const state = useRef({
    currentTx: 0,
    currentTy: 0,
  });

  useEffect(() => {
    snapZonesRef.current = snapZones;
  }, [snapZones]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    portalTargetModeRef.current = overlayLayout.portalTargetMode;
  }, [overlayLayout.portalTargetMode]);

  useEffect(() => {
    portalTargetPointRef.current = overlayLayout.portalTargetPoint;
  }, [overlayLayout.portalTargetPoint]);

  useEffect(() => {
    portalColorModeRef.current = item.portalColorMode ?? overlayLayout.portalColorMode;
  }, [item.portalColorMode, overlayLayout.portalColorMode]);

  useEffect(() => {
    const dragEl = dragRef.current;
    if (!dragEl) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '100001';

    const laser = document.createElement('div');
    laser.style.position = 'absolute';
    laser.style.height = '2px';
    laser.style.transformOrigin = '0% 50%';
    laser.style.background = 'linear-gradient(90deg, rgba(34,211,238,0.0), rgba(34,211,238,0.85), rgba(168,85,247,0.85), rgba(168,85,247,0.0))';
    laser.style.filter = 'drop-shadow(0 0 6px rgba(34,211,238,0.45))';
    laser.style.opacity = '0';

    const reticle = document.createElement('div');
    reticle.style.position = 'absolute';
    reticle.style.width = '46px';
    reticle.style.height = '46px';
    reticle.style.borderRadius = '9999px';
    reticle.style.border = '1px solid rgba(34,211,238,0.65)';
    reticle.style.boxShadow = '0 0 18px rgba(34,211,238,0.35), 0 0 40px rgba(168,85,247,0.12)';
    reticle.style.background = 'radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, rgba(34,211,238,0.03) 35%, rgba(0,0,0,0) 70%)';
    reticle.style.transform = 'translate(-50%, -50%)';
    reticle.style.opacity = '0';

    const cross = document.createElement('div');
    cross.style.position = 'absolute';
    cross.style.left = '50%';
    cross.style.top = '50%';
    cross.style.width = '28px';
    cross.style.height = '28px';
    cross.style.transform = 'translate(-50%, -50%)';
    cross.style.borderLeft = '1px solid rgba(34,211,238,0.55)';
    cross.style.borderTop = '1px solid rgba(34,211,238,0.55)';
    cross.style.borderRight = '1px solid rgba(34,211,238,0.18)';
    cross.style.borderBottom = '1px solid rgba(34,211,238,0.18)';
    cross.style.borderRadius = '6px';
    reticle.appendChild(cross);

    overlay.appendChild(laser);
    overlay.appendChild(reticle);
    document.body.appendChild(overlay);

    let raf = 0;
    let to = 0;
    let lastTheme: string | null = null;
    const tick = () => {
      const rect = dragEl.getBoundingClientRect();
      const isActive =
        selectedItemIdRef.current === item.id ||
        dragStateRef.current.isDragging ||
        !!posesRef.current?.[item.id]?.cameraMode;

      if (!isActive) {
        laser.style.opacity = '0';
        reticle.style.opacity = '0';
        to = window.setTimeout(() => {
          raf = window.requestAnimationFrame(tick);
        }, 120) as any;
        return;
      }

      const dock = snapZonesRef.current.find(z => z.id === 'hand-dock');
      const mode = portalTargetModeRef.current;
      const useHand = mode === 'hand-dock' && !!dock;

      const custom = portalTargetPointRef.current;
      const targetX = useHand ? dock!.rect.left + dock!.rect.width / 2 : (mode === 'custom' ? custom.x : window.innerWidth / 2);
      const targetY = useHand ? dock!.rect.top + dock!.rect.height / 2 : (mode === 'custom' ? custom.y : window.innerHeight - 26);

      const theme = portalColorModeRef.current;
      if (theme !== lastTheme) {
        if (theme === 'red') {
          laser.style.background = 'linear-gradient(90deg, rgba(239,68,68,0.0), rgba(239,68,68,0.85), rgba(245,158,11,0.75), rgba(245,158,11,0.0))';
          laser.style.filter = 'drop-shadow(0 0 6px rgba(239,68,68,0.45))';
          reticle.style.border = '1px solid rgba(239,68,68,0.65)';
          reticle.style.boxShadow = '0 0 18px rgba(239,68,68,0.35), 0 0 40px rgba(245,158,11,0.12)';
          reticle.style.background = 'radial-gradient(circle at center, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.03) 35%, rgba(0,0,0,0) 70%)';
          cross.style.borderLeft = '1px solid rgba(239,68,68,0.55)';
          cross.style.borderTop = '1px solid rgba(239,68,68,0.55)';
          cross.style.borderRight = '1px solid rgba(239,68,68,0.18)';
          cross.style.borderBottom = '1px solid rgba(239,68,68,0.18)';
        } else {
          laser.style.background = 'linear-gradient(90deg, rgba(34,211,238,0.0), rgba(34,211,238,0.85), rgba(168,85,247,0.85), rgba(168,85,247,0.0))';
          laser.style.filter = 'drop-shadow(0 0 6px rgba(34,211,238,0.45))';
          reticle.style.border = '1px solid rgba(34,211,238,0.65)';
          reticle.style.boxShadow = '0 0 18px rgba(34,211,238,0.35), 0 0 40px rgba(168,85,247,0.12)';
          reticle.style.background = 'radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, rgba(34,211,238,0.03) 35%, rgba(0,0,0,0) 70%)';
          cross.style.borderLeft = '1px solid rgba(34,211,238,0.55)';
          cross.style.borderTop = '1px solid rgba(34,211,238,0.55)';
          cross.style.borderRight = '1px solid rgba(34,211,238,0.18)';
          cross.style.borderBottom = '1px solid rgba(34,211,238,0.18)';
        }
        lastTheme = theme;
      }

      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height * 0.64;

      const dx = targetX - startX;
      const dy = targetY - startY;
      const len = Math.max(0, Math.hypot(dx, dy));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      laser.style.left = `${startX}px`;
      laser.style.top = `${startY}px`;
      laser.style.width = `${len}px`;
      laser.style.transform = `rotate(${angle}deg)`;
      laser.style.opacity = dragStateRef.current.isDragging ? '0.95' : '0.65';

      reticle.style.left = `${targetX}px`;
      reticle.style.top = `${targetY}px`;
      reticle.style.opacity = dragStateRef.current.isDragging ? '0.95' : '0.6';

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (to) window.clearTimeout(to);
      overlay.remove();
    };
  }, [item.id]);

  useEffect(() => {
    const poseEl = poseRef.current;
    if (!poseEl) return;

    const base = poses[item.id] || DEFAULT_CARD_POSE;

    const currentTy = dragStateRef.current.isDragging
      ? state.current.currentTy
      : (overlayLayout.mode === 'free' || !formationTarget)
        ? (item.ty ?? state.current.currentTy)
        : formationTarget.ty;

    const homeTy = item.homeTy ?? item.ty ?? 0;
    const lift = Math.max(0, homeTy - currentTy);
    const autoTilt = Math.max(0, Math.min(14, lift / 18));

    const tiltX = (base.tiltX ?? 0) - autoTilt;
    const tiltY = base.tiltY ?? 0;
    const rotZ = base.rotZ ?? 0;
    const zoom = Math.max(0.6, Math.min(1.7, base.zoom ?? 1));

    animate(poseEl, {
      rotateX: tiltX,
      rotateY: tiltY,
      rotateZ: rotZ,
      scale: zoom,
      duration: dragStateRef.current.isDragging ? 0 : 160,
      easing: 'outQuad',
    });
  }, [formationTarget, item.homeTy, item.id, item.ty, overlayLayout.mode, poses]);

  useEffect(() => {
    zOffsetsRef.current = zOffsets;
  }, [zOffsets]);

  useEffect(() => {
    hudDockRef.current = hudDock;
    setHudDockRef.current = setHudDock;
  }, [hudDock, setHudDock]);

  const dockSideForItem = useMemo(() => {
    if (hudDock.left.includes(item.id)) return 'left';
    if (hudDock.right.includes(item.id)) return 'right';
    return null;
  }, [hudDock.left, hudDock.right, item.id]);

  const isAnchored = useMemo(() => {
    return anchored.includes(item.id);
  }, [anchored, item.id]);

  const statusLabel = useMemo(() => {
    if (dockSideForItem) return dockSideForItem === 'left' ? 'Docked L' : 'Docked R';
    if (isAnchored) return 'Anchored';
    if (overlayLayout.mode !== 'free' && formationTarget) return 'Formation';
    return 'Free';
  }, [dockSideForItem, isAnchored, overlayLayout.mode, formationTarget]);

  const zLabel = useMemo(() => {
    const z = zOffsets[item.id] ?? 0;
    const clamped = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, z));
    return Math.round(clamped);
  }, [item.id, zOffsets]);

  const dockItem = useCallback((side: 'left' | 'right') => {
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
  }, [item.id, setAnchored, setHudDock]);

  const undockItem = useCallback(() => {
    setHudDock((prev) => ({
      left: prev.left.filter((x) => x !== item.id),
      right: prev.right.filter((x) => x !== item.id),
    }));
  }, [item.id, setHudDock]);

  useEffect(() => {
    posesRef.current = poses;
  }, [poses]);

  useEffect(() => {
    const dragEl = dragRef.current;
    if (!dragEl) return;

    const onWheel = (e: WheelEvent) => {
      if (e.altKey) return;
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY > 0 ? 1 : -1;
      const step = e.ctrlKey ? 40 : OVERLAY_CARD_Z_STEP;

      setZOffsets(prev => {
        const current = prev[item.id] ?? 0;
        const next = Math.max(OVERLAY_CARD_Z_MIN, Math.min(OVERLAY_CARD_Z_MAX, current - direction * step));
        return { ...prev, [item.id]: next };
      });

      const now = Date.now();
      if (now - sfxRef.current.lastNudgeAt > 50) {
        sfxRef.current.lastNudgeAt = now;
        playCardDepthNudgeSound(direction < 0 ? 'in' : 'out');
      }
    };

    dragEl.addEventListener('wheel', onWheel, { passive: false });
    return () => dragEl.removeEventListener('wheel', onWheel as any);
  }, [item.id, setZOffsets]);

  useEffect(() => {
    const dragEl = dragRef.current;
    const visualEl = visualRef.current;
    if (!dragEl || !visualEl) return;

    const setDragging = (next: boolean) => {
      const prev = dragStateRef.current.isDragging;
      if (prev === next) return;
      dragStateRef.current.isDragging = next;
      window.dispatchEvent(new CustomEvent('hapa.overlayCard.drag', { detail: { id: item.id, dragging: next } }));
    };

    let onWinMove: ((ev: PointerEvent) => void) | null = null;
    let onWinUp: ((ev: PointerEvent) => void) | null = null;

    const clearWindowListeners = () => {
      if (onWinMove) window.removeEventListener('pointermove', onWinMove as any, true);
      if (onWinUp) window.removeEventListener('pointerup', onWinUp as any, true);
      onWinMove = null;
      onWinUp = null;
    };

    const undockIfDocked = () => {
      const d = hudDockRef.current;
      if (!d?.left?.includes(item.id) && !d?.right?.includes(item.id)) return;
      setHudDockRef.current((prev) => ({
        left: prev.left.filter((x) => x !== item.id),
        right: prev.right.filter((x) => x !== item.id),
      }));
      window.dispatchEvent(new Event('hapa.overlay.layoutTick'));
    };

    state.current.currentTx = item.tx ?? 0;
    state.current.currentTy = item.ty ?? 0;

    animate(dragEl, {
      translateX: state.current.currentTx,
      translateY: state.current.currentTy,
      duration: 0,
    });

    // ============================================
    // 1. Initial Setup & Lift
    // ============================================
    
    // Initial Lift
    animate(visualEl, {
      scale: 1.15,
      rotate: -2,
      boxShadow: [
        '0 5px 15px rgba(0,0,0,0.3)',
        '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.6)'
      ],
      duration: 400,
      easing: 'easeOutElastic(1, .8)',
    });

    // Start Pulse (Always active)
    anims.current.pulse = animate(visualEl, {
      boxShadow: [
        '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.6)',
        '0 25px 60px rgba(0,0,0,0.6), 0 0 60px rgba(34,211,238,0.8), 0 0 20px rgba(255,255,255,0.4)'
      ],
      duration: 1500,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });

    // Sway Helper (Organic independent axes)
    const startSway = () => {
      // Bob up and down (2.5s cycle)
      // anims.current.bob = animate(visualEl, {
      //   translateY: ['-6px', '6px'], // Explicit units help
      //   duration: 2500,
      //   loop: true,
      //   alternate: true,
      //   easing: 'easeInOutSine',
      // });

      // Tilt left and right (3.2s cycle - desync from bob)
      // anims.current.tilt = animate(visualEl, {
      //   rotate: [-3, 3],
      //   duration: 3200,
      //   loop: true,
      //   alternate: true,
      //   easing: 'easeInOutSine',
      // });
    };

    const stopSway = () => {
      anims.current.bob?.pause();
      anims.current.tilt?.pause();
      
      // Reset sway transforms slightly to neutral for dragging
      animate(visualEl, {
        translateY: 0,
        rotate: -2, // Keep slight tilt
        duration: 200,
        easing: 'outQuad'
      });
    };

    // ============================================
    // 2. Drag Logic
    // ============================================

    const handlePointerMove = (e: PointerEvent, startX: number, startY: number, initialTx: number, initialTy: number) => {
      e.preventDefault();
      e.stopPropagation();

      const depthModifier =
        (typeof e.getModifierState === 'function' && (e.getModifierState('Alt') || e.getModifierState('Control') || e.getModifierState('Meta'))) ||
        e.altKey ||
        e.ctrlKey ||
        (e as any).metaKey;

      if (depthModifier) {
        if (!dragStateRef.current.isDragging) {
          setDragging(true);
          playCardPickUpSound();
          setOverlayLayout((prev) => ({ ...prev, mode: 'free' }));
          stopSway();
        }
        if (!zDragRef.current.isAdjusting) {
          zDragRef.current.isAdjusting = true;
          zDragRef.current.startY = e.clientY;
          zDragRef.current.startZ = zOffsetsRef.current[item.id] ?? 0;
        }

        const next = Math.max(
          OVERLAY_CARD_Z_MIN,
          Math.min(OVERLAY_CARD_Z_MAX, zDragRef.current.startZ - (e.clientY - zDragRef.current.startY)),
        );
        zDragRef.current.didAdjust = true;
        setZOffsets(prev => ({ ...prev, [item.id]: next }));

        const now = Date.now();
        if (now - sfxRef.current.lastNudgeAt > 70) {
          sfxRef.current.lastNudgeAt = now;
          playCardDepthNudgeSound(next >= sfxRef.current.lastZ ? 'in' : 'out');
        }

        sfxRef.current.lastZ = next;

        const scale = Math.max(0.95, Math.min(1.35, 1.15 + next / 3500));

        const { baselineZ } = getOverlayZBaseline(overlayLayout.mode, overlayLayout.hover);
        const totalZ = (overlayLayout.mode === 'free' || !formationTarget) ? (baselineZ + next) : (formationTarget.tz + next);

        animate(visualEl, {
          translateZ: totalZ,
          scale,
          duration: 0,
        });
        return;
      }

      zDragRef.current.isAdjusting = false;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Don't enter drag mode on micro-movements; this prevents click-to-select from
      // leaving a live pointermove handler that later shoves the card away.
      if (!dragStateRef.current.isDragging) {
        const dist = Math.hypot(dx, dy);
        if (dist < 6) return;
        setDragging(true);
        setSelectedItemId(item.id);
        undockIfDocked();
        playCardPickUpSound();
        setOverlayLayout((prev) => ({ ...prev, mode: 'free' }));
        stopSway();
      }

      state.current.currentTx = initialTx + dx;
      state.current.currentTy = initialTy + dy;

      const now = Date.now();
      const movedSinceTick = Math.hypot(
        state.current.currentTx - sfxRef.current.lastMoveTx,
        state.current.currentTy - sfxRef.current.lastMoveTy,
      );
      if (movedSinceTick > 90 && now - sfxRef.current.lastMoveAt > 80) {
        sfxRef.current.lastMoveAt = now;
        sfxRef.current.lastMoveTx = state.current.currentTx;
        sfxRef.current.lastMoveTy = state.current.currentTy;
        playCardMoveTickSound();
      }

      animate(dragEl, {
        translateX: state.current.currentTx,
        translateY: state.current.currentTy,
        duration: 0,
      });

      const notifyNow = performance.now();
      if (notifyNow - moveNotifyRef.current.lastAt > 33) {
        moveNotifyRef.current.lastAt = notifyNow;
        window.dispatchEvent(new CustomEvent('hapa.overlayCard.moved', { detail: { id: item.id } }));
      }
    };

    const handlePointerUp = (e: PointerEvent, startX: number, startY: number) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        dragEl.releasePointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }

      clearWindowListeners();

      // Check for click (minimal movement from THIS session start)
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);

      const zoneUnderPointer = snapZonesRef.current.find((zone) => {
        const zLeft = zone.rect.left;
        const zTop = zone.rect.top;
        const zRight = zone.rect.left + zone.rect.width;
        const zBottom = zone.rect.top + zone.rect.height;
        return e.clientX >= zLeft && e.clientX <= zRight && e.clientY >= zTop && e.clientY <= zBottom;
      });

      if (zoneUnderPointer) {
        playCardSnapSound();
        const zone = zoneUnderPointer;
        const targetLeft = zone.rect.left + zone.rect.width / 2 - item.initialRect.width / 2;
        const targetTop = zone.rect.top + zone.rect.height / 2 - item.initialRect.height / 2;
        const tx = targetLeft - item.initialRect.left;
        const ty = targetTop - item.initialRect.top;
        const s = Math.min(zone.rect.width / item.initialRect.width, zone.rect.height / item.initialRect.height);

        animate(dragEl, {
          translateX: tx,
          translateY: ty,
          duration: 180,
          easing: 'outQuad',
        });

        animate(visualEl, {
          scale: Math.max(0.22, Math.min(1, s)),
          translateZ: 0,
          duration: 180,
          easing: 'outQuad',
        }).then(() => {
          try {
            zone.onSnap(item);
          } catch (err) {
            console.warn('[FloatingCard] snap onSnap failed', err);
          }
          removeItem(item.id);
        });
        return;
      }

      if (dist < 5) {
        playCardClickSound();
        setSelectedItemId(prev => (prev === item.id ? null : item.id));
        if (item.onClick) item.onClick(e);

        setDragging(false);
        startSway();
        dragEl.onpointermove = null;
        dragEl.onpointerup = null;
        dragEl.onlostpointercapture = null;
        return;
      }

      // Persist free position
      setDragging(false);

      if (zDragRef.current.didAdjust) {
        const movedXy = Math.hypot(
          state.current.currentTx - sessionStartRef.current.tx,
          state.current.currentTy - sessionStartRef.current.ty,
        );

        // If user only adjusted depth (no X/Y move), don't snap/remove or persist position.
        if (movedXy < 1) {
          zDragRef.current.didAdjust = false;
          zDragRef.current.isAdjusting = false;
          startSway();
          dragEl.onpointermove = null;
          dragEl.onpointerup = null;
          return;
        }

        // Otherwise, allow normal drop behavior (snap + persist position)
        zDragRef.current.didAdjust = false;
        zDragRef.current.isAdjusting = false;
      }

      // Snap evaluation (overlap-first for better feel)
      const cardRect = {
        left: item.initialRect.left + state.current.currentTx,
        top: item.initialRect.top + state.current.currentTy,
        width: item.initialRect.width,
        height: item.initialRect.height,
      };
      const cardRight = cardRect.left + cardRect.width;
      const cardBottom = cardRect.top + cardRect.height;
      const cardArea = Math.max(1, cardRect.width * cardRect.height);

      const cx = cardRect.left + cardRect.width / 2;
      const cy = cardRect.top + cardRect.height / 2;

      let best: { zone: any; overlapRatio: number; dist: number } | null = null;
      for (const zone of snapZonesRef.current) {
        const zLeft = zone.rect.left;
        const zTop = zone.rect.top;
        const zRight = zone.rect.left + zone.rect.width;
        const zBottom = zone.rect.top + zone.rect.height;

        const ix = Math.max(0, Math.min(cardRight, zRight) - Math.max(cardRect.left, zLeft));
        const iy = Math.max(0, Math.min(cardBottom, zBottom) - Math.max(cardRect.top, zTop));
        const overlapArea = ix * iy;
        const overlapRatio = overlapArea / cardArea;

        const zx = zone.rect.left + zone.rect.width / 2;
        const zy = zone.rect.top + zone.rect.height / 2;
        const distToCenter = Math.hypot(cx - zx, cy - zy);

        const eligible = overlapRatio >= 0.06 || distToCenter <= zone.threshold;
        if (!eligible) continue;

        if (!best) {
          best = { zone, overlapRatio, dist: distToCenter };
          continue;
        }

        if (overlapRatio > best.overlapRatio + 0.01) {
          best = { zone, overlapRatio, dist: distToCenter };
          continue;
        }

        if (Math.abs(overlapRatio - best.overlapRatio) <= 0.01 && distToCenter < best.dist) {
          best = { zone, overlapRatio, dist: distToCenter };
          continue;
        }

        if (Math.abs(overlapRatio - best.overlapRatio) <= 0.01 && Math.abs(distToCenter - best.dist) <= 6) {
          const zid = String(zone.id || '');
          const bid = String(best.zone?.id || '');
          const zIsMenu = zid.startsWith('menu-location:');
          const bIsMenu = bid.startsWith('menu-location:');
          if (zIsMenu && !bIsMenu) {
            best = { zone, overlapRatio, dist: distToCenter };
          }
        }
      }

      if (best) {
        playCardSnapSound();
        const zone = best.zone;
        const targetLeft = zone.rect.left + zone.rect.width / 2 - item.initialRect.width / 2;
        const targetTop = zone.rect.top + zone.rect.height / 2 - item.initialRect.height / 2;
        const tx = targetLeft - item.initialRect.left;
        const ty = targetTop - item.initialRect.top;

        const s = Math.min(zone.rect.width / item.initialRect.width, zone.rect.height / item.initialRect.height);

        animate(dragEl, {
          translateX: tx,
          translateY: ty,
          duration: 180,
          easing: 'outQuad',
        });

        animate(visualEl, {
          scale: Math.max(0.22, Math.min(1, s)),
          translateZ: 0,
          duration: 180,
          easing: 'outQuad',
        }).then(() => {
          try {
            zone.onSnap(item);
          } catch (err) {
            console.warn('[FloatingCard] snap onSnap failed', err);
          }
          removeItem(item.id);
        });
        return;
      }

      playCardDropSound();
      updateItemPosition(item.id, state.current.currentTx, state.current.currentTy);

      window.dispatchEvent(new Event('hapa.overlay.layoutTick'));

      // Resume Sway on Drop
      startSway();

      // Clean up listeners for this session
      // Note: We need named functions to remove them, but since we use closures for state,
      // we'll handle cleanup by storing the current handler reference if needed, 
      // or just relying on the fact that we create NEW functions for each session.
      // Actually, removing anonymous functions is impossible.
      // We must use the `onpointermove` property or a ref to the handler.
      dragEl.onpointermove = null;
      dragEl.onpointerup = null;
    };

    const startDragSession = (
      e: PointerEvent | { pointerId: number; clientX: number; clientY: number },
      immediateDrag?: boolean,
    ) => {
       const m = new DOMMatrixReadOnly(getComputedStyle(dragEl).transform);
       if (Number.isFinite(m.m41)) state.current.currentTx = m.m41;
       if (Number.isFinite(m.m42)) state.current.currentTy = m.m42;

       sessionStartRef.current.tx = state.current.currentTx;
       sessionStartRef.current.ty = state.current.currentTy;

       sfxRef.current.lastMoveAt = 0;
       sfxRef.current.lastMoveTx = state.current.currentTx;
       sfxRef.current.lastMoveTy = state.current.currentTy;
       sfxRef.current.lastZ = zOffsetsRef.current[item.id] ?? 0;

       zDragRef.current.startY = e.clientY;
       zDragRef.current.startZ = zOffsetsRef.current[item.id] ?? 0;
       zDragRef.current.didAdjust = false;
       zDragRef.current.isAdjusting = false;

       const startX = e.clientX;
       const startY = e.clientY;
       const initialTx = state.current.currentTx;
       const initialTy = state.current.currentTy;

       try {
         dragEl.setPointerCapture(e.pointerId);
       } catch (err) { 
         console.warn('Failed to capture', err);

         const pid = e.pointerId;
         onWinMove = (ev: PointerEvent) => {
           if (ev.pointerId !== pid) return;
           handlePointerMove(ev, startX, startY, initialTx, initialTy);
         };
         onWinUp = (ev: PointerEvent) => {
           if (ev.pointerId !== pid) return;
           handlePointerUp(ev, startX, startY);
         };
         window.addEventListener('pointermove', onWinMove as any, true);
         window.addEventListener('pointerup', onWinUp as any, true);
       }

       setDragging(!!immediateDrag);
       if (immediateDrag) {
         setSelectedItemId(item.id);
         undockIfDocked();
         playCardPickUpSound();
         setOverlayLayout((prev) => ({ ...prev, mode: 'free' }));
         stopSway();
       }

       // Assign handlers directly to avoid add/remove complexity with closures
       dragEl.onpointermove = (ev) => handlePointerMove(ev, startX, startY, initialTx, initialTy);
       dragEl.onpointerup = (ev) => handlePointerUp(ev, startX, startY);
       dragEl.onlostpointercapture = (ev) => handlePointerUp(ev, startX, startY);
    };

    // Initialize Trigger
    if (item.pointerId !== undefined) {
      // If spawned from a drag, start immediately
      // We simulate a "start event" using the original coords
      startDragSession({ 
        pointerId: item.pointerId, 
        clientX: item.startX, 
        clientY: item.startY 
      }, true);
    } else {
      // Just floating
      startSway();
    }

    // Allow re-dragging via direct listener on the element
    const onMouseDown = (e: PointerEvent) => {
       e.preventDefault();
       e.stopPropagation();
       startDragSession(e);
    };
    
    dragEl.addEventListener('pointerdown', onMouseDown as any);

    return () => {
      dragEl.removeEventListener('pointerdown', onMouseDown as any);
      dragEl.onpointermove = null;
      dragEl.onpointerup = null;
      clearWindowListeners();
      
      anims.current.pulse?.pause();
      anims.current.bob?.pause();
      anims.current.tilt?.pause();
    };
  }, [item.pointerId, item.startX, item.startY, removeItem, item.id, setOverlayLayout, setSelectedItemId, snapZonesRef]);

  useEffect(() => {
    const dragEl = dragRef.current;
    const visualEl = visualRef.current;
    if (!dragEl || !visualEl) return;

    if (dragStateRef.current.isDragging) return;

    const zOffset = zOffsets[item.id] ?? 0;
    const scale = Math.max(0.95, Math.min(1.35, 1.15 + zOffset / 3500));

    const { baselineZ } = getOverlayZBaseline(overlayLayout.mode, overlayLayout.hover);

    if ((overlayLayout.mode === 'free' && !formationTarget?.force) || !formationTarget) {
      const freeTx = item.tx ?? state.current.currentTx;
      const freeTy = item.ty ?? state.current.currentTy;
      state.current.currentTx = freeTx;
      state.current.currentTy = freeTy;

      animate(dragEl, {
        translateX: freeTx,
        translateY: freeTy,
        duration: 220,
        easing: 'outQuad',
      });

      animate(visualEl, {
        translateZ: baselineZ + zOffset,
        scale,
        duration: 220,
        easing: 'outQuad',
      });
      return;
    }

    animate(dragEl, {
      translateX: formationTarget.tx,
      translateY: formationTarget.ty,
      duration: 420,
      easing: 'outExpo',
    });

    animate(visualEl, {
      translateZ: formationTarget.tz + zOffset,
      rotate: formationTarget.rotZ - 2,
      scale,
      duration: 420,
      easing: 'outExpo',
    });
  }, [formationTarget, overlayLayout.mode, item.id, zOffsets, item.tx, item.ty]);

  return (
    <div
      ref={dragRef}
      data-overlay-card="true"
      data-overlay-card-id={item.id}
      className="absolute relative pointer-events-auto cursor-grab active:cursor-grabbing touch-none [will-change:transform] [transform-style:preserve-3d]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        left: item.initialRect.left,
        top: item.initialRect.top,
        width: item.initialRect.width,
        height: item.initialRect.height,
        zIndex: selectedItemId === item.id ? 100000 : 99999,
      }}
      // Prevent native drag
      onDragStart={(e) => {
        e.preventDefault();
        return false;
      }}
    >
      {(isHovered || selectedItemId === item.id) && (
        <div className="absolute left-1 top-1 z-[100001] flex flex-col items-start gap-1 pointer-events-none">
          {statusLabel ? (
            <div
              className={`px-2 py-[2px] rounded-full border text-[9px] font-bold uppercase tracking-[0.22em] ${dockSideForItem
                ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.22)]'
                : isAnchored
                  ? 'border-purple-400/40 bg-purple-500/10 text-purple-100 shadow-[0_0_14px_rgba(168,85,247,0.18)]'
                  : overlayLayout.mode !== 'free'
                    ? 'border-gray-500/40 bg-gray-900/30 text-gray-200'
                    : 'border-gray-800/70 bg-gray-950/25 text-gray-400'
                }`}
            >
              {statusLabel}
            </div>
          ) : null}

          <div
            className="px-2 py-[2px] rounded-full border border-gray-800/70 bg-gray-950/25 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300"
            title="Shift+Wheel depth · Ctrl+Shift fine"
          >
            Z {zLabel}
          </div>
        </div>
      )}

      {(isHovered || selectedItemId === item.id) && (
        <div className="absolute right-1 top-1 z-[100001] flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            title={dockSideForItem === 'left' ? 'Docked left' : 'Dock left'}
            className={`px-1.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] transition-all ${dockSideForItem === 'left'
              ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.22)]'
              : 'border-gray-700/60 bg-gray-950/35 text-gray-200 hover:bg-gray-900/50'
              }`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dockItem('left');
            }}
          >
            DL
          </button>

          <button
            type="button"
            title={dockSideForItem === 'right' ? 'Docked right' : 'Dock right'}
            className={`px-1.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] transition-all ${dockSideForItem === 'right'
              ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.22)]'
              : 'border-gray-700/60 bg-gray-950/35 text-gray-200 hover:bg-gray-900/50'
              }`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dockItem('right');
            }}
          >
            DR
          </button>

          <button
            type="button"
            title={dockSideForItem ? 'Undock' : 'Not docked'}
            className={`px-1.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-[0.22em] transition-all ${dockSideForItem
              ? 'border-gray-600/60 bg-gray-800/55 text-gray-100 hover:bg-gray-800/70'
              : 'border-gray-800/70 bg-gray-950/25 text-gray-500'
              }`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              undockItem();
            }}
          >
            UD
          </button>
        </div>
      )}

      {selectedItemId === item.id && (
        <>
          <div className={`absolute -inset-1 rounded-xl border pointer-events-none ${portalColorMode === 'red' ? 'border-red-300/80 shadow-[0_0_24px_rgba(239,68,68,0.42)]' : 'border-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.45)]'}`} />
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
            <div className={`absolute inset-0 ${portalColorMode === 'red' ? 'bg-gradient-to-b from-red-500/10 via-transparent to-amber-500/10' : 'bg-gradient-to-b from-cyan-500/10 via-transparent to-purple-500/10'}`} />
            <div className={`absolute left-1/2 top-[62%] w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full ${portalColorMode === 'red' ? 'border border-red-300/60 shadow-[0_0_22px_rgba(239,68,68,0.25)]' : 'border border-cyan-300/60 shadow-[0_0_22px_rgba(34,211,238,0.25)]'}`}>
              <div className={`absolute left-1/2 top-1/2 w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-md ${portalColorMode === 'red' ? 'border border-red-300/30' : 'border border-cyan-300/30'}`} />
              <div className={`absolute left-1/2 top-0 w-px h-full -translate-x-1/2 ${portalColorMode === 'red' ? 'bg-red-300/30' : 'bg-cyan-300/30'}`} />
              <div className={`absolute top-1/2 left-0 h-px w-full -translate-y-1/2 ${portalColorMode === 'red' ? 'bg-red-300/30' : 'bg-cyan-300/30'}`} />
            </div>
          </div>
        </>
      )}
      <div 
        ref={visualRef}
        className="w-full h-full origin-center [will-change:transform,box-shadow] [transform-style:preserve-3d]"
      >
        <div
          ref={poseRef}
          className="w-full h-full [will-change:transform] [transform-style:preserve-3d]"
        >
          {(() => {
            const Render = item.render;
            return <Render data={item.data} />;
          })()}
        </div>
      </div>
    </div>
  );
};
