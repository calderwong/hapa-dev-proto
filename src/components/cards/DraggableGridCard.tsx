import React from 'react';
import { useGlobalDrag } from '../../hooks/useGlobalDrag';
import type { CardIndexEntry } from '../../hooks/useCardLoadQueue';
import type { PortalColorMode } from '../../contexts/DragCanvasContext';

interface DraggableGridCardProps {
  card: CardIndexEntry;
  children: React.ReactNode;
  renderPreview: () => React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  portalColorMode?: PortalColorMode;
}

export const DraggableGridCard: React.FC<DraggableGridCardProps> = ({
  card,
  children,
  renderPreview,
  onClick,
  className = '',
  portalColorMode,
}) => {
  const { dragHandlers } = useGlobalDrag({
    id: card.cardId,
    type: 'LIBRARY_CARD',
    data: card,
    render: renderPreview,
    onClick: onClick ? (e) => onClick(e as any) : undefined,
    portalColorMode: portalColorMode ?? 'blue',
  });

  return (
    <div
      {...dragHandlers}
      onClick={onClick}
      className={`relative touch-none ${className}`}
    >
      {children}
    </div>
  );
};
