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
    
    spawnItem({
      id,
      type,
      data,
      render,
      initialRect: rect,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: (e as any).pointerId, // Cast because React.MouseEvent doesn't have pointerId
      onClick,
      portalColorMode,
    });
    
    if (onDragStart) onDragStart();
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
