/**
 * LineageBadge Component
 * 
 * Displays ancestry (↑) and descendant (↓) counts as RPG-style power badges.
 * Used on card thumbnails and in the inspector.
 */

import React from 'react';
import type { LineageInfo } from '../../utils/cardLineage';
import { formatLineageCount, getLineagePowerTier } from '../../utils/cardLineage';

interface LineageBadgeProps {
  lineage: LineageInfo;
  type: 'ancestor' | 'descendant';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}

/**
 * Single lineage badge (either ancestor or descendant)
 */
export const LineageBadge: React.FC<LineageBadgeProps> = ({
  lineage,
  type,
  size = 'small',
  showLabel = false,
  className = '',
}) => {
  const count = type === 'ancestor' ? lineage.ancestorCount : lineage.descendantCount;
  const icon = type === 'ancestor' ? '⬆' : '⬇';
  const label = type === 'ancestor' ? 'GEN' : 'SPAWN';
  
  // Color based on type and magnitude
  const getColorClasses = () => {
    if (type === 'ancestor') {
      // Blue/Cyan for ancestors - deeper = more blue
      if (count === 0) return 'bg-gray-800/80 text-gray-400 border-gray-600/50';
      if (count >= 5) return 'bg-blue-900/80 text-cyan-300 border-cyan-500/50 shadow-cyan-500/30';
      if (count >= 3) return 'bg-blue-800/80 text-cyan-400 border-cyan-400/50';
      return 'bg-blue-700/80 text-blue-300 border-blue-400/50';
    } else {
      // Orange/Red for descendants - more spawn = more orange/red
      if (count === 0) return 'bg-gray-800/80 text-gray-400 border-gray-600/50';
      if (count >= 10) return 'bg-orange-900/80 text-amber-300 border-amber-500/50 shadow-amber-500/30 animate-pulse';
      if (count >= 5) return 'bg-orange-800/80 text-orange-300 border-orange-400/50';
      if (count >= 2) return 'bg-orange-700/80 text-orange-400 border-orange-500/50';
      return 'bg-amber-800/80 text-amber-400 border-amber-500/50';
    }
  };

  // Size classes
  const sizeClasses = {
    small: 'text-[9px] px-1.5 py-0.5 min-w-[28px]',
    medium: 'text-[10px] px-2 py-1 min-w-[36px]',
    large: 'text-xs px-2.5 py-1.5 min-w-[44px]',
  };

  const tooltipText = type === 'ancestor'
    ? count === 0 
      ? 'Root card (original source)' 
      : `${count} generation${count > 1 ? 's' : ''} from source`
    : count === 0
      ? 'Leaf card (no children yet)'
      : `${count} card${count > 1 ? 's' : ''} spawned from this`;

  return (
    <div
      className={`
        inline-flex items-center justify-center gap-0.5
        font-mono font-bold tracking-tight
        rounded border backdrop-blur-sm
        transition-all duration-200
        ${getColorClasses()}
        ${sizeClasses[size]}
        ${count > 0 ? 'shadow-lg' : ''}
        ${className}
      `}
      title={tooltipText}
      aria-label={tooltipText}
    >
      <span className="opacity-70">{icon}</span>
      <span>{formatLineageCount(count)}</span>
      {showLabel && <span className="ml-1 opacity-60 text-[8px]">{label}</span>}
    </div>
  );
};

/**
 * Combined lineage badges (both ancestor and descendant)
 */
interface LineageBadgePairProps {
  lineage: LineageInfo;
  size?: 'small' | 'medium' | 'large';
  layout?: 'horizontal' | 'vertical' | 'corners';
  className?: string;
}

export const LineageBadgePair: React.FC<LineageBadgePairProps> = ({
  lineage,
  size = 'small',
  layout = 'horizontal',
  className = '',
}) => {
  if (layout === 'corners') {
    // For use on card thumbnails - position in corners
    return (
      <>
        <div className={`absolute top-1 left-1 z-10 ${className}`}>
          <LineageBadge lineage={lineage} type="ancestor" size={size} />
        </div>
        <div className={`absolute top-1 right-1 z-10 ${className}`}>
          <LineageBadge lineage={lineage} type="descendant" size={size} />
        </div>
      </>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <LineageBadge lineage={lineage} type="ancestor" size={size} showLabel />
        <LineageBadge lineage={lineage} type="descendant" size={size} showLabel />
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <LineageBadge lineage={lineage} type="ancestor" size={size} />
      <LineageBadge lineage={lineage} type="descendant" size={size} />
    </div>
  );
};

/**
 * Lineage Power Indicator - shows combined power level
 */
interface LineagePowerProps {
  lineage: LineageInfo;
  className?: string;
}

export const LineagePower: React.FC<LineagePowerProps> = ({ lineage, className = '' }) => {
  const tier = getLineagePowerTier(lineage);
  const power = lineage.spawn * 2 + lineage.depth;
  
  const tierStyles = {
    legendary: 'bg-gradient-to-r from-amber-600 to-orange-500 text-white border-amber-400 shadow-amber-500/50',
    epic: 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white border-purple-400 shadow-purple-500/50',
    rare: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-blue-400 shadow-blue-500/50',
    common: 'bg-gray-700 text-gray-300 border-gray-600',
  };

  const tierLabels = {
    legendary: '★★★',
    epic: '★★',
    rare: '★',
    common: '',
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1
        text-[10px] font-bold font-mono uppercase tracking-wider
        rounded border shadow-lg
        ${tierStyles[tier]}
        ${className}
      `}
      title={`Power Level: ${power} (Depth: ${lineage.depth}, Spawn: ${lineage.spawn})`}
    >
      {tierLabels[tier] && <span>{tierLabels[tier]}</span>}
      <span>PWR {power}</span>
    </div>
  );
};

export default LineageBadge;
