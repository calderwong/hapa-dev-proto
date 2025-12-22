import React from 'react';
import type { HandCard, CardState } from '../../contexts/HandContext';
import { useGlobalDrag } from '../../hooks/useGlobalDrag';
import { useDragCanvas } from '../../contexts/DragCanvasContext';
import type { PortalColorMode } from '../../contexts/DragCanvasContext';

interface DraggableHandCardProps {
  card: HandCard;
  index: number;
  state: CardState;
  stateStyle: { border: string; glow: string; pulse: boolean; label: string };
  getStateCssClass: (state: CardState) => string;
  isHovered: boolean;
  setHoveredIndex: (index: number | null) => void;
  setSelectedCard: (card: HandCard) => void;
  portalColorMode?: PortalColorMode;
}

export const DraggableHandCard: React.FC<DraggableHandCardProps> = ({
  card,
  index,
  state,
  stateStyle,
  getStateCssClass,
  isHovered,
  setHoveredIndex,
  setSelectedCard,
  portalColorMode = 'blue',
}) => {
  // Use global drag system
  const { items } = useDragCanvas();
  const isBeingDragged = items.some(i => i.id === card.cardId);

  // The render function for the drag canvas (what shows up when dragging)
  const RenderDragPreview: React.FC<{ data: any }> = () => (
    <div className={`
      relative w-12 h-16 rounded-md overflow-hidden
      border-2 shadow-2xl z-[10000]
      ${stateStyle.border} ${stateStyle.glow}
      ${getStateCssClass(state)}
    `}>
      {/* Neon edge glow */}
      <div className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-cyan-400/80"></div>
      
      {card.thumbnail ? (
        <img 
          src={card.thumbnail} 
          alt={card.name || 'Card'} 
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="w-4 h-4 rounded border border-gray-600 bg-gray-700/50"></div>
        </div>
      )}
    </div>
  );

  const { dragHandlers } = useGlobalDrag({
    id: card.cardId,
    type: 'HAND_CARD',
    data: card,
    render: RenderDragPreview,
    onClick: () => setSelectedCard(card),
    portalColorMode,
  });

  // If dragging, we can hide the original or dim it.
  // User asked to "transport up", so let's make the original invisible but take up space
  const opacityClass = isBeingDragged ? 'opacity-0' : 'opacity-100';

  return (
    <div
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
      {...dragHandlers}
      className={`
        hand-card-draggable
        relative w-12 h-16 rounded-md overflow-hidden
        cursor-grab active:cursor-grabbing
        border-2 transition-all duration-200 ease-out
        ${stateStyle.border} ${stateStyle.glow}
        ${getStateCssClass(state)}
        ${isHovered && !isBeingDragged ? 'shadow-lg ring-2 ring-cyan-400/50' : 'shadow-md'}
        ${opacityClass}
      `}
    >
      {/* Neon edge glow */}
      <div className={`absolute inset-0 rounded-md pointer-events-none ${isHovered ? 'ring-1 ring-white/20' : ''}`}></div>
      
      {/* Card content */}
      {card.thumbnail ? (
        <img 
          src={card.thumbnail} 
          alt={card.name || 'Card'} 
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="w-4 h-4 rounded border border-gray-600 bg-gray-700/50"></div>
        </div>
      )}
      
      {/* State indicator dot */}
      {state !== 'idle' && (
        <div className={`
          absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full
          ${state === 'thor' ? 'bg-red-500' : ''}
          ${state === 'leo' ? 'bg-blue-400' : ''}
          ${state === 'conviction' ? 'bg-emerald-500' : ''}
          ${state === 'run' ? 'bg-purple-500' : ''}
          ${state === 'processing' ? 'bg-yellow-500' : ''}
          ${stateStyle.pulse ? 'animate-pulse' : ''}
        `}></div>
      )}
      
      {/* Hover tooltip */}
      {isHovered && !isBeingDragged && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900/95 border border-cyan-500/30 rounded text-[9px] text-white whitespace-nowrap shadow-lg z-30 pointer-events-none">
          <div className="font-medium truncate max-w-[100px] text-cyan-400">{card.name || 'Card'}</div>
          <div className="text-gray-500 text-[8px]">Drag to move</div>
        </div>
      )}
    </div>
  );
};
