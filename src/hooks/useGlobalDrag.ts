import { useCallback } from 'react';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import type { PortalColorMode } from '../contexts/DragCanvasContext';

interface UseGlobalDragOptions {
  id: string;
  type: string;
  data: any;
  render: (data: any) => React.ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onClick?: (e: React.MouseEvent | React.PointerEvent | PointerEvent) => void; // Pass through click
  portalColorMode?: PortalColorMode;
}

export function useGlobalDrag(options: UseGlobalDragOptions) {
  const { spawnItem } = useDragCanvas();
  const { id, type, data, render, onDragStart, onClick, portalColorMode } = options;

  const handlePointerDown = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    // Prevent default browser drag/selection
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const startX = (e as any).clientX;
    const startY = (e as any).clientY;
    const pointerId = (e as any).pointerId;

    let didSpawn = false;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove as any, true);
      window.removeEventListener('pointerup', onUp as any, true);
      window.removeEventListener('pointercancel', onUp as any, true);
    };

    const onMove = (ev: PointerEvent) => {
      if (pointerId !== undefined && ev.pointerId !== pointerId) return;
      if (didSpawn) return;

      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dist = Math.hypot(dx, dy);

      // Small threshold so click does not spawn an overlay item.
      if (dist < 6) return;

      didSpawn = true;

      spawnItem({
        id,
        type,
        data,
        render,
        initialRect: rect,
        startX,
        startY,
        pointerId,
        onClick,
        portalColorMode,
      });

      if (onDragStart) onDragStart();

      cleanup();
    };

    const onUp = (ev: PointerEvent) => {
      if (pointerId !== undefined && ev.pointerId !== pointerId) return;
      cleanup();

      // A plain click should open details instead of spawning a FloatingCard.
      if (!didSpawn && onClick) {
        try {
          onClick(ev);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointermove', onMove as any, true);
    window.addEventListener('pointerup', onUp as any, true);
    window.addEventListener('pointercancel', onUp as any, true);
  }, [id, type, data, render, spawnItem, onDragStart, onClick, portalColorMode]);

  return {
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onDragStart: (e: React.DragEvent) => {
        e.preventDefault();
        return false;
      }
    }
  };
}
