// @ts-nocheck
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrimaryButton, SecondaryButton } from './Button';
import SpriteSheetConverter from './SpriteSheetConverter';
import { SpriteAnimationGenerator } from './SpriteAnimationGenerator';

interface CardWorkspaceProps {
    card: any;
    onClose: () => void;
    onSave: (newContent: string) => Promise<void>;
    onUpdate?: () => void;
}

interface Version {
    timestamp: number;
    content: string;
    id: string;
}

const CardWorkspace: React.FC<CardWorkspaceProps> = ({ card, onClose, onSave, onUpdate }) => {
    const [content, setContent] = useState(card.data?.text || '');
    const [originalContent, setOriginalContent] = useState(card.data?.text || '');
    const [isEditing, setIsEditing] = useState(false);
    const [versions, setVersions] = useState<Version[]>([]);
    const [saving, setSaving] = useState(false);
    const [activeVersionId, setActiveVersionId] = useState<string>('original');
    const [showSpriteConverter, setShowSpriteConverter] = useState(false);
    const [showAnimationGenerator, setShowAnimationGenerator] = useState(false);
    const [converting, setConverting] = useState(false);
    const [isSeed, setIsSeed] = useState(card.data?.isSpriteSeed || false);
    const [lastAnimationResult, setLastAnimationResult] = useState<{ imageUrl: string; prompt: string; cardId: string } | null>(null);
    // Track generated children locally (card prop is stale after P2P updates)
    const [generatedChildren, setGeneratedChildren] = useState<Array<{ cardId: string; type: string; label: string; imageUrl?: string }>>(card.children || []);
    // Lightbox state for viewing generated images
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Initialize versions (simulated for now, would fetch from P2P in real app)
    useEffect(() => {
        setVersions([
            { timestamp: card.timestamp, content: card.data?.text || '', id: 'original' }
        ]);
        setContent(card.data?.text || '');
        setOriginalContent(card.data?.text || '');
        setIsSeed(card.data?.isSpriteSeed || false);
    }, [card]);

    const hasChanges = content !== originalContent;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(content);
            // Add new version locally for immediate feedback
            const newVersion = {
                timestamp: Date.now(),
                content: content,
                id: `v-${Date.now()}`
            };
            setVersions(prev => [newVersion, ...prev]);
            setOriginalContent(content);
            setActiveVersionId(newVersion.id);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleVersionSelect = (v: Version) => {
        setContent(v.content);
        setOriginalContent(v.content); // Treat selected version as "base" for diffing? Or keep original? 
        // For now, let's just view it.
        setActiveVersionId(v.id);
        setIsEditing(false);
    };

    const handleMarkAsSeed = async () => {
        if (!window.electronAPI?.p2pAppend || !window.electronAPI?.p2pRead) return;

        // Immediate UI feedback
        setIsSeed(true);

        const coreName = card.coreName || card.id;
        const coreRecords = await window.electronAPI.p2pRead(coreName);
        let latestRecord: any = {};
        for (const r of coreRecords) {
            try {
                const p = JSON.parse(r);
                if (p.type === 'card') latestRecord = p;
            } catch { }
        }

        const updatedRecord = {
            ...latestRecord,
            isSpriteSeed: true,
            tags: [...(latestRecord.tags || []).filter((t: string) => t !== 'sprite-seed'), 'sprite-seed'],
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.p2pAppend({
            name: coreName,
            data: JSON.stringify(updatedRecord)
        });

        // Update Library Index if possible (optional, but good practice)
        // Note: We don't have easy access to update library index here without reading it first.
        // Ideally the parent component or a sync process handles this. 
        // For now, just updating the core is sufficient for the workspace to reflect it on reload.
        // But to make it immediate in UI without reload, we might need to callback or refresh.
        // For this step, we'll assume the user might need to close/re-open or we force a refresh if we could.
        
        // Hack: Force a "save" effect to trigger parent refresh? 
        // Or just alert/toast.
        // Since we don't have a refresh prop, we rely on the parent re-rendering or polling.
        
        if (onUpdate) onUpdate();
    };

    const handleSpriteGenerate = async (blob: Blob) => {
        if (!window.electronAPI?.wormholeIngestContent || !window.electronAPI?.p2pAppend) return;

        setConverting(true);
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const base64 = base64data.split(',')[1];

                // Ingest GIF
                const result = await window.electronAPI.wormholeIngestContent({
                    bytesBase64: base64,
                    fileName: `sprite-animation-${Date.now()}.gif`,
                    mediaType: 'image',
                    sourceLabel: 'sprite-sheet-gif'
                });

                // Get local path
                const records = await window.electronAPI.p2pRead(result.cardId);
                let gifPath = '';
                for (const record of records) {
                    try {
                        const parsed = JSON.parse(record);
                        if (parsed.type === 'card' && parsed.wormhole?.ingest?.originalPath) {
                            gifPath = parsed.wormhole.ingest.originalPath;
                            break;
                        }
                    } catch (e) { }
                }

                // 1. Update the NEW Animation Card (result.cardId)
                // It was created by wormholeIngestContent, but we need to link it to the parent
                const animCardId = result.cardId;
                const animRecords = await window.electronAPI.p2pRead(animCardId);
                let animLatest: any = {};
                try {
                     // Find the latest card record
                     for (const r of animRecords) {
                         const p = JSON.parse(r);
                         if (p.type === 'card') animLatest = p;
                     }
                } catch (e) {}

                const updatedAnimRecord = {
                    ...animLatest,
                    id: animCardId, // Ensure ID is set
                    type: 'card', // Ensure type is set
                    title: `Sprite Animation from ${card.data?.title || 'Card'}`,
                    subType: 'sprite-animation',
                    parentId: card.id, // Link to parent
                    tags: [...(animLatest.tags || []), 'sprite', 'animation', 'generated'],
                    createdAt: new Date().toISOString(),
                    wormhole: {
                        ...animLatest.wormhole,
                        ingest: {
                            ...animLatest.wormhole?.ingest,
                            originalPath: gifPath
                        }
                    }
                };

                await window.electronAPI.p2pAppend({
                    name: animCardId,
                    data: JSON.stringify(updatedAnimRecord)
                });

                // 2. Update the ORIGINAL Parent Card to link to the child
                const coreName = card.coreName || card.id;
                const coreRecords = await window.electronAPI.p2pRead(coreName);
                let parentLatest: any = {};
                for (const r of coreRecords) {
                    try {
                        const p = JSON.parse(r);
                        if (p.type === 'card') parentLatest = p;
                    } catch { }
                }

                const updatedParentRecord = {
                    ...parentLatest,
                    // Do NOT change subType of parent
                    children: [
                        ...(parentLatest.children || []),
                        { 
                            cardId: animCardId, 
                            type: 'sprite-animation', 
                            label: 'Generated GIF' 
                        }
                    ],
                    updatedAt: new Date().toISOString()
                };

                await window.electronAPI.p2pAppend({
                    name: coreName,
                    data: JSON.stringify(updatedParentRecord)
                });

                // 3. Ensure the new card is in the Library Index
                await window.electronAPI.p2pCreateCore('card-library');
                await window.electronAPI.p2pAppend({
                    name: 'card-library',
                    data: JSON.stringify({
                        type: 'card-index',
                        cardId: animCardId,
                        coreName: animCardId, // Wormhole uses ID as core name
                        title: updatedAnimRecord.title,
                        type: 'image', // Index type
                        subType: 'sprite-animation',
                        thumbnail: `data:image/gif;base64,${base64}`, // Use the GIF itself as thumbnail
                        createdAt: updatedAnimRecord.createdAt
                    })
                });

                setShowSpriteConverter(false);
                setConverting(false);
                // Ideally trigger a refresh here, but for now just close
            };
        } catch (e) {
            console.error("Failed to generate sprite sheet GIF:", e);
        }
    };

    const handleGenerateAnimation = async (prompt: string, model: string) => {
        if (!window.electronAPI?.generateImageForCard || !window.electronAPI?.wormholeIngestContent) return;

        setConverting(true); 

        // 1. Load Seed Image for Context
        let seedImageBase64: string | undefined;
        let seedMimeType = 'image/png';
        
        const seedUrl = card.data?.imageUrl || card.data?.url;
        if (seedUrl) {
            try {
                console.log('[Animation] Loading seed image context:', seedUrl);
                const resp = await fetch(seedUrl);
                const blob = await resp.blob();
                seedMimeType = blob.type;
                
                const reader = new FileReader();
                seedImageBase64 = await new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const dataUrl = reader.result as string;
                        // Extract base64 part
                        const base64 = dataUrl.split(',')[1];
                        resolve(base64);
                    };
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn('[Animation] Failed to load seed image for context:', e);
            }
        }

        // 2. Construct Instruction-Rich Prompt
        const instructions = `
REQUIREMENT: Create a pixel-art sprite sheet animation (grid layout e.g. 4x4 or 3x3) on a white background.
The sprites should show the character in motion (e.g. walking, attacking, idling).
Maintain consistent size and style across frames.

USER REQUEST: ${prompt}
        `;

        console.log('[Animation] Sending request to Image Gen Pipeline:', instructions);

        // 3. Generate Image
        try {
            const imgResult = await window.electronAPI.generateImageForCard({
                cardContext: {
                    name: card.data?.title || 'Animation Seed',
                    mediaKind: 'image',
                    text: instructions,
                    tags: ['sprite-sheet', 'pixel-art', 'grid', 'white-background'],
                    image: seedImageBase64,
                    mimeType: seedMimeType
                },
                provider: model // 'gemini' or 'local-vision'
            });

            if (!imgResult.success || !imgResult.localPath) {
                throw new Error("Image generation failed");
            }

            // 3. Ingest the Result
            const response = await fetch(`file://${imgResult.localPath}`);
            const blob = await response.blob();
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const base64 = base64data.split(',')[1];

                const ingestResult = await window.electronAPI.wormholeIngestContent({
                    bytesBase64: base64,
                    fileName: `sprite-gen-${Date.now()}.png`,
                    mediaType: 'image',
                    sourceLabel: 'sprite-generator'
                });

                // 4. Link and Update Cards
                const animCardId = ingestResult.cardId;
                const animRecords = await window.electronAPI.p2pRead(animCardId);
                let animLatest: any = {};
                try {
                     for (const r of animRecords) {
                         const p = JSON.parse(r);
                         if (p.type === 'card') animLatest = p;
                     }
                } catch (e) {}

                const updatedAnimRecord = {
                    ...animLatest,
                    id: animCardId,
                    type: 'card',
                    title: `Animation: ${prompt}`,
                    subType: 'sprite-animation',
                    parentId: card.id,
                    tags: [...(animLatest.tags || []), 'sprite', 'animation', 'ai-generated'],
                    createdAt: new Date().toISOString(),
                    generationMetadata: {
                        originalRequest: prompt,
                        model: model,
                        seedCardId: card.id
                    }
                };

                await window.electronAPI.p2pAppend({
                    name: animCardId,
                    data: JSON.stringify(updatedAnimRecord)
                });

                // Update Parent
                const coreName = card.coreName || card.id;
                const coreRecords = await window.electronAPI.p2pRead(coreName);
                let parentLatest: any = {};
                for (const r of coreRecords) {
                    try {
                        const p = JSON.parse(r);
                        if (p.type === 'card') parentLatest = p;
                    } catch { }
                }

                const updatedParentRecord = {
                    ...parentLatest,
                    children: [
                        ...(parentLatest.children || []),
                        { 
                            cardId: animCardId, 
                            type: 'sprite-animation', 
                            label: prompt 
                        }
                    ],
                    updatedAt: new Date().toISOString()
                };

                await window.electronAPI.p2pAppend({
                    name: coreName,
                    data: JSON.stringify(updatedParentRecord)
                });

                // Update Index
                 await window.electronAPI.p2pCreateCore('card-library');
                 await window.electronAPI.p2pAppend({
                    name: 'card-library',
                    data: JSON.stringify({
                        type: 'card-index',
                        cardId: animCardId,
                        coreName: animCardId,
                        title: updatedAnimRecord.title,
                        type: 'image',
                        subType: 'sprite-animation',
                        thumbnail: `data:image/png;base64,${base64}`,
                        createdAt: updatedAnimRecord.createdAt
                    })
                });

                setConverting(false);
                
                const resultImageUrl = `data:image/png;base64,${base64}`;
                
                // Keep generator open and show result
                setLastAnimationResult({
                    imageUrl: resultImageUrl,
                    prompt: prompt,
                    cardId: animCardId
                });
                
                // Add to local children list for immediate UI feedback
                setGeneratedChildren(prev => [
                    ...prev,
                    { 
                        cardId: animCardId, 
                        type: 'sprite-animation', 
                        label: prompt,
                        imageUrl: resultImageUrl
                    }
                ]);
                
                if (onUpdate) onUpdate();
            };

        } catch (error) {
            console.error("Animation generation failed:", error);
            alert("Failed to generate animation. See console for details.");
            setConverting(false);
        }
    };

    return (
        <div className="flex h-full gap-6 animate-in fade-in zoom-in duration-300">
            {/* Left Panel: Content & Editor */}
            <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-purple-900/30 border border-purple-500/30 text-purple-400">
                            <rux-icon icon={card.type === 'text' ? 'article' : 'perm-media'} size="small"></rux-icon>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-white tracking-tight">{card.data?.title || 'Untitled Card'}</h2>
                                {isSeed && (
                                    <div className="px-2 py-0.5 rounded bg-green-900/50 border border-green-500/50 text-green-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <rux-icon icon="local-florist" size="extra-small"></rux-icon>
                                        Sprite Seed
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] font-mono text-gray-400">ID: {card.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Generate Animation - Toggle button when generator is open */}
                        {card.type === 'image' && isSeed && (
                            <SecondaryButton 
                                onClick={() => setShowAnimationGenerator(!showAnimationGenerator)} 
                                title={showAnimationGenerator ? "Close Animation Generator" : "Generate Animation from this Seed"}
                                className={showAnimationGenerator ? "border-purple-500 text-purple-400" : ""}
                            >
                                <rux-icon icon={showAnimationGenerator ? "close" : "movie-filter"} size="small" className="mr-2"></rux-icon>
                                {showAnimationGenerator ? "CLOSE GENERATOR" : "GENERATE ANIMATION"}
                            </SecondaryButton>
                        )}
                        {card.type === 'image' && !isSeed && (
                            <SecondaryButton onClick={handleMarkAsSeed} title="Mark as Sprite Seed for animations">
                                <rux-icon icon="local-florist" size="small" className="mr-2"></rux-icon>
                                MARK SEED
                            </SecondaryButton>
                        )}
                        {/* Make GIF - Always visible, toggle when converter is open */}
                        {card.type === 'image' && (
                            <SecondaryButton 
                                onClick={() => setShowSpriteConverter(!showSpriteConverter)}
                                className={showSpriteConverter ? "border-cyan-500 text-cyan-400" : ""}
                            >
                                <rux-icon icon={showSpriteConverter ? "close" : "animation"} size="small" className="mr-2"></rux-icon>
                                {showSpriteConverter ? "CLOSE" : "MAKE GIF"}
                            </SecondaryButton>
                        )}
                        {card.type === 'text' && (
                            <SecondaryButton onClick={() => setIsEditing(!isEditing)}>
                                <rux-icon icon={isEditing ? "visibility" : "edit"} size="small" className="mr-2"></rux-icon>
                                {isEditing ? "PREVIEW" : "EDIT"}
                            </SecondaryButton>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                            <rux-icon icon="close" size="small"></rux-icon>
                        </button>
                    </div>
                </div>

                {/* Main Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20 relative">
                    {card.type === 'image' && (
                        <div className="flex justify-center items-center h-full w-full">
                            {showAnimationGenerator ? (
                                <div className="w-full h-full max-w-3xl">
                                    <SpriteAnimationGenerator 
                                        seedCard={card}
                                        onGenerate={handleGenerateAnimation}
                                        onCancel={() => setShowAnimationGenerator(false)}
                                        lastResult={lastAnimationResult}
                                        onView={setViewingImage}
                                    />
                                </div>
                            ) : showSpriteConverter ? (
                                <div className="w-full h-full">
                                    <SpriteSheetConverter
                                        imageUrl={card.data?.imageUrl || card.data?.url}
                                        onGenerate={handleSpriteGenerate}
                                        onCancel={() => setShowSpriteConverter(false)}
                                    />
                                </div>
                            ) : (
                                <img src={card.data?.imageUrl || card.data?.url} alt="Card Media" className="max-h-full max-w-full rounded-lg shadow-2xl border border-gray-800" />
                            )}
                        </div>
                    )}

                    {card.type === 'video' && (
                        <div className="flex justify-center items-center h-full">
                            <video
                                src={card.data?.url}
                                controls
                                className="max-h-full max-w-full rounded-lg shadow-2xl border border-gray-800"
                            />
                        </div>
                    )}

                    {card.type === 'text' && (
                        <div className="h-full">
                            {isEditing ? (
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className={`w-full h-full bg-transparent border-none focus:ring-0 text-sm font-mono resize-none p-4 leading-relaxed ${hasChanges ? 'text-red-400' : 'text-gray-300'
                                        }`}
                                    placeholder="Enter markdown content..."
                                    style={{ outline: 'none' }}
                                />
                            ) : (
                                <div className={`prose prose-invert max-w-none ${hasChanges ? 'text-red-300' : ''}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {isEditing && hasChanges && (
                    <div className="p-4 border-t border-gray-800 bg-black/40 flex justify-between items-center animate-in slide-in-from-bottom-4">
                        <span className="text-xs text-red-400 font-mono flex items-center gap-2">
                            <rux-icon icon="warning" size="extra-small"></rux-icon>
                            UNSAVED CHANGES DETECTED
                        </span>
                        <PrimaryButton onClick={handleSave} disabled={saving}>
                            {saving ? 'SAVING...' : 'SAVE CHANGES'}
                        </PrimaryButton>
                    </div>
                )}
            </div>

            {/* Right Panel: Timeline & Metadata */}
            <div className="w-80 flex flex-col gap-6">
                {/* Timeline */}
                <div className="glass-panel rounded-xl p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-widest text-xs uppercase mb-4">
                        <rux-icon icon="history" size="extra-small"></rux-icon>
                        Version Timeline
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 relative">
                        {/* Vertical Line */}
                        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-800"></div>

                        {versions.map((v, idx) => {
                            const isActive = activeVersionId === v.id;
                            return (
                                <button
                                    key={v.id}
                                    onClick={() => handleVersionSelect(v)}
                                    className={`relative w-full text-left pl-8 py-2 pr-2 rounded group transition-all ${isActive ? 'bg-cyan-900/20' : 'hover:bg-white/5'
                                        }`}
                                >
                                    {/* Dot */}
                                    <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border transition-colors ${isActive ? 'bg-cyan-400 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-black border-gray-600 group-hover:border-gray-400'
                                        }`}></div>

                                    <div className={`text-xs font-mono mb-0.5 ${isActive ? 'text-cyan-300' : 'text-gray-300'}`}>
                                        {idx === versions.length - 1 ? 'ORIGINAL' : `UPDATE v${versions.length - 1 - idx}`}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {new Date(v.timestamp).toLocaleString()}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Metadata */}
                <div className="glass-panel rounded-xl p-4 h-auto">
                    <div className="flex items-center gap-2 text-gray-400 font-bold tracking-widest text-xs uppercase mb-4">
                        <rux-icon icon="info" size="extra-small"></rux-icon>
                        Metadata
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-gray-500 font-mono uppercase block mb-1">Created</label>
                            <div className="text-xs text-gray-300 font-mono">{new Date(card.timestamp).toLocaleString()}</div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-mono uppercase block mb-1">Type</label>
                            <div className="text-xs text-gray-300 font-mono uppercase">{card.type}</div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-mono uppercase block mb-1">Tags</label>
                            <div className="flex flex-wrap gap-1">
                                {card.data?.tags?.map((tag: string) => (
                                    <span key={tag} className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400">
                                        #{tag}
                                    </span>
                                )) || <span className="text-gray-600 text-[10px] italic">No tags</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Derived / Children */}
                <div className="glass-panel rounded-xl p-4 h-auto max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-2 text-gray-400 font-bold tracking-widest text-xs uppercase mb-4">
                        <rux-icon icon="account-tree" size="extra-small"></rux-icon>
                        Derived Assets ({generatedChildren.length})
                    </div>
                    <div className="space-y-2">
                        {generatedChildren.length > 0 ? (
                            generatedChildren.map((child: any, idx: number) => (
                                <div 
                                    key={child.cardId || idx} 
                                    onClick={() => child.imageUrl && setViewingImage(child.imageUrl)}
                                    className="p-2 bg-black/40 rounded border border-gray-800 flex items-center gap-2 group hover:border-cyan-500/50 transition-colors cursor-pointer"
                                >
                                    {child.imageUrl ? (
                                        <img src={child.imageUrl} alt={child.label} className="w-10 h-10 object-cover rounded bg-gray-900" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center text-gray-500 group-hover:text-white">
                                            <rux-icon icon="image" size="small"></rux-icon>
                                        </div>
                                    )}
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-xs text-white truncate group-hover:text-cyan-400 transition-colors">{child.label || 'Untitled'}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">{child.type}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-gray-600 italic">No derived assets yet. Generate animations above!</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Lightbox Modal */}
            {viewingImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setViewingImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] p-4">
                        <button 
                            onClick={() => setViewingImage(null)}
                            className="absolute top-0 right-0 p-2 text-white hover:text-cyan-400 transition-colors"
                            title="Close"
                        >
                            <rux-icon icon="close" size="normal"></rux-icon>
                        </button>
                        <img 
                            src={viewingImage} 
                            alt="Preview" 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-gray-700"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardWorkspace;
