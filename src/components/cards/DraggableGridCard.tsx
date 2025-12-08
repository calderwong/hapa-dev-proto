import React from 'react';
import { useGlobalDrag } from '../../hooks/useGlobalDrag';
import type { CardIndexEntry } from '../../hooks/useCardLoadQueue';

interface DraggableGridCardProps {
  card: CardIndexEntry;
  children: React.ReactNode;
  renderPreview: () => React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const DraggableGridCard: React.FC<DraggableGridCardProps> = ({
  card,
  children,
  renderPreview,
  onClick,
  className = '',
}) => {
  const { dragHandlers } = useGlobalDrag({
    id: card.cardId,
    type: 'LIBRARY_CARD',
    data: card,
    render: renderPreview,
    onClick: onClick ? (e) => onClick(e as any) : undefined,
  });

  return (
    <div
      {...dragHandlers}
      onClick={onClick}
      className={`relative ${className}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
};
