
import React, { useCallback, useEffect, useState } from 'react';
import type { Connection, Edge } from 'reactflow';
import ReactFlow, {
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import PetEdge from '../components/flow/PetEdge';
import CustomControls from '../components/flow/CustomControls';

// Register custom edge types
const edgeTypes = {
    petEdge: PetEdge,
};

// Initial Nodes representing the Hell Week Pipeline
const initialNodes = [
    {
        id: 'leo',
        type: 'input',
        data: { label: 'LEO (Analysis)' },
        position: { x: 100, y: 150 },
        style: {
            background: '#1a1a2e',
            color: '#f472b6',
            border: '1px solid #ec4899',
            width: 180,
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.2)'
        },
    },
    {
        id: 'thor',
        data: { label: 'THOR (Forgery)' },
        position: { x: 400, y: 50 },
        style: {
            background: '#1a1a2e',
            color: '#22d3ee',
            border: '1px solid #06b6d4',
            width: 180,
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
        },
    },
    {
        id: 'media_img',
        data: { label: 'MEDIA (Image Gen)' },
        position: { x: 400, y: 300 },
        style: {
            background: '#1a1a2e',
            color: '#a855f7',
            border: '1px solid #9333ea',
            width: 180,
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(147, 51, 234, 0.2)'
        },
    },
    {
        id: 'media_video',
        data: { label: 'MEDIA (Video Loop)' },
        position: { x: 400, y: 500 },
        style: {
            background: '#1a1a2e',
            color: '#ef4444', // Red for video (Veo)
            border: '1px solid #dc2626',
            width: 180,
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(220, 38, 38, 0.2)'
        },
    },
    {
        id: 'mint',
        type: 'output',
        data: { label: 'CONVICTION (Vault)' },
        position: { x: 800, y: 150 },
        style: {
            background: '#1a1a2e',
            color: '#fbbf24',
            border: '1px solid #f59e0b',
            width: 180,
            borderRadius: '12px',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
        },
    },
];

// Initial Edges
const initialEdges = [
    // 1. Leo -> Thor (Context)
    {
        id: 'e-leo-thor',
        source: 'leo',
        target: 'thor',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#ec4899', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ec4899' },
        label: 'Context & Yarn',
        labelStyle: { fill: '#ec4899', fontWeight: 600, fontSize: 11 },
        data: { isActive: true },
    },
    // 2. Thor -> Media Image (Prompts)
    {
        id: 'e-thor-media',
        source: 'thor',
        target: 'media_img',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#22d3ee', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' },
        label: 'Img Prompts',
        labelStyle: { fill: '#22d3ee', fontWeight: 600, fontSize: 11 },
        data: { isActive: true },
    },
    // 3. Media Image -> Media Video (Source Image)
    {
        id: 'e-media-video',
        source: 'media_img',
        target: 'media_video',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#a855f7', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
        label: 'Source Image',
        labelStyle: { fill: '#a855f7', fontWeight: 600, fontSize: 11 },
        data: { isActive: true },
    },
    // 4. Media Image -> Mint (Standard Asset)
    {
        id: 'e-media-mint',
        source: 'media_img',
        target: 'mint',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#a855f7', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
        label: 'PNG Asset',
        labelStyle: { fill: '#a855f7', fontWeight: 600, fontSize: 11 },
        data: { isActive: true },
    },
    // 5. Media Video -> Mint (Video Asset)
    {
        id: 'e-video-mint',
        source: 'media_video',
        target: 'mint',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#ef4444', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
        label: 'MP4 Asset',
        labelStyle: { fill: '#ef4444', fontWeight: 600, fontSize: 11 },
        data: { isActive: true },
    },
    // 6. Thor -> Mint (Text Only Bypass)
    {
        id: 'e-thor-mint',
        source: 'thor',
        target: 'mint',
        type: 'petEdge',
        animated: true,
        style: { stroke: '#06b6d4', strokeWidth: 1.5, strokeDasharray: '5,5' },
        label: 'Text Only (Bypass)',
        labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 11 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
        data: { isActive: true },
    },
];

const FlowForger: React.FC = () => {
    // Ensure initialNodes is defined before using it
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
    const [pipelineState, setPipelineState] = useState<any>(null);

    useEffect(() => {
        if (window.electronAPI?.onPipelineUpdate) {
            window.electronAPI.onPipelineUpdate((state: any) => {
                setPipelineState(state);
                updateFlowVisuals(state);
            });
        }
    }, []);

    const updateFlowVisuals = (state: any) => {
        const status = state.status;
        setNodes((nds) =>
            nds.map((node) => {
                let isActive = false;
                if (node.id === 'leo' && status.includes('LEO')) isActive = true;
                if (node.id === 'thor' && status.includes('THOR') && !status.includes('MEDIA')) isActive = true;
                if ((node.id === 'media_img' || node.id === 'media_video') && status.includes('MEDIA')) isActive = true;
                if (node.id === 'mint' && (status.includes('CONVICTION') || status === 'COMPLETE')) isActive = true;
                return {
                    ...node,
                    style: {
                        ...node.style,
                        opacity: isActive ? 1 : 0.5,
                        borderWidth: isActive ? '3px' : '1px',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        filter: isActive ? 'brightness(1.2)' : 'brightness(0.8)',
                    }
                };
            })
        );
    };

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div className="h-full w-full bg-gray-950 text-white flex flex-col">
            <div className="h-16 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold tracking-wider font-mono">FLOW FORGER</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`w-2 h-2 rounded-full ${pipelineState?.status !== 'IDLE' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    {pipelineState?.status || 'SYSTEM IDLE'}
                </div>
            </div>
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                    className="bg-gray-950"
                >
                    <Background color="#334155" gap={20} size={1} />
                    <CustomControls />
                </ReactFlow>
            </div>
        </div>
    );
};

export default FlowForger;
