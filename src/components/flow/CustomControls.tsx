import React, { memo } from 'react';
import { useReactFlow } from 'reactflow';
import type { LucideIcon } from 'lucide-react';
import { Plus, Minus, Maximize } from 'lucide-react';

const ControlButton = ({
    onClick,
    icon: Icon,
    label,
    active = false
}: {
    onClick: () => void;
    icon: LucideIcon;
    label: string;
    active?: boolean;
}) => (
    <button
        onClick={onClick}
        className={`group relative flex items-center justify-center p-2 mb-2 rounded-lg transition-all duration-200 
      ${active
                ? 'bg-astro-primary text-gray-900 shadow-[0_0_10px_rgba(20,184,166,0.5)]'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
            }`}
        title={label}
    >
        <Icon size={20} />

        {/* Tooltip Label */}
        <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {label}
        </span>
    </button>
);

const CustomControls: React.FC = () => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();

    // We can't actually lock the viewport easily without controlling the ReactFlow props from here, 
    // but standard controls usually just offer zoom/fit. 
    // For now, let's stick to the requested visual swap for standard controls.

    return (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col">
            <ControlButton
                onClick={() => zoomIn({ duration: 300 })}
                icon={Plus}
                label="Zoom In"
            />
            <ControlButton
                onClick={() => zoomOut({ duration: 300 })}
                icon={Minus}
                label="Zoom Out"
            />
            <ControlButton
                onClick={() => fitView({ duration: 300 })}
                icon={Maximize}
                label="Fit View"
            />
            {/* 
      <ControlButton 
        onClick={() => setIsLocked(!isLocked)} 
        icon={isLocked ? Lock : Unlock} 
        label={isLocked ? "Unlock View" : "Lock View"}
        active={isLocked}
      /> 
      */}
        </div>
    );
};

export default memo(CustomControls);
