import React from 'react';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import { FloatingCard } from './cards/FloatingCard';

export const DragCanvas: React.FC = () => {
  const { items } = useDragCanvas();

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none">
      {items.map(item => (
        <FloatingCard key={item.id} item={item} />
      ))}
    </div>
  );
};
