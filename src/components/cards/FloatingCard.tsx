import React, { useEffect, useRef } from 'react';
import { animate } from '../../hooks/useAnime';
import type { DragItem } from '../../contexts/DragCanvasContext';
import { useDragCanvas } from '../../contexts/DragCanvasContext';

interface FloatingCardProps {
  item: DragItem;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({ item }) => {
  const dragRef = useRef<HTMLDivElement>(null);   // Controls Position (TranslateX/Y)
  const visualRef = useRef<HTMLDivElement>(null); // Controls Effects (Scale, Rotate, Glow)
  const { removeItem } = useDragCanvas();

  // Track animation instances
  const anims = useRef<{ bob?: any; tilt?: any; pulse?: any }>({});

  // Track drag state
  const state = useRef({
    currentTx: 0,
    currentTy: 0,
  });

  useEffect(() => {
    const dragEl = dragRef.current;
    const visualEl = visualRef.current;
    if (!dragEl || !visualEl) return;

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

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      state.current.currentTx = initialTx + dx;
      state.current.currentTy = initialTy + dy;

      animate(dragEl, {
        translateX: state.current.currentTx,
        translateY: state.current.currentTy,
        duration: 0,
      });
    };

    const handlePointerUp = (e: PointerEvent, startX: number, startY: number) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        dragEl.releasePointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }

      // Check for click (minimal movement from THIS session start)
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);

      if (dist < 5) {
        if (item.onClick) item.onClick(e);
        removeItem(item.id);
        return;
      }

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

    const startDragSession = (e: PointerEvent | { pointerId: number, clientX: number, clientY: number }) => {
       try {
         dragEl.setPointerCapture(e.pointerId);
       } catch (err) { 
         console.warn('Failed to capture', err);
       }
       
       stopSway();

       const startX = e.clientX;
       const startY = e.clientY;
       const initialTx = state.current.currentTx;
       const initialTy = state.current.currentTy;

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
      });
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
      
      anims.current.pulse?.pause();
      anims.current.bob?.pause();
      anims.current.tilt?.pause();
    };
  }, [item.pointerId, item.startX, item.startY, removeItem, item.id]);

  return (
    <div
      ref={dragRef}
      className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{
        left: item.initialRect.left,
        top: item.initialRect.top,
        width: item.initialRect.width,
        height: item.initialRect.height,
        touchAction: 'none',
        willChange: 'transform',
        zIndex: 99999,
      }}
      // Prevent native drag
      onDragStart={(e) => {
        e.preventDefault();
        return false;
      }}
    >
      <div 
        ref={visualRef}
        style={{
          width: '100%',
          height: '100%',
          willChange: 'transform, box-shadow',
          transformOrigin: 'center center',
        }}
      >
        {item.render(item.data)}
      </div>
    </div>
  );
};
