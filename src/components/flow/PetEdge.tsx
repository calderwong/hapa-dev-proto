import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';

const PetEdge: React.FC<EdgeProps> = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
                    className="nodrag nopan absolute text-[12px] pointer-events-auto"
                >
                    {/* Simple dog emoji to prove custom edge works */}
                    {data?.isActive && <div className="text-xl">🐕</div>}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default PetEdge;
