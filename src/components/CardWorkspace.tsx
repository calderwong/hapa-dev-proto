// @ts-nocheck
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrimaryButton, SecondaryButton } from './Button';
import SpriteSheetConverter from './SpriteSheetConverter';

interface CardWorkspaceProps {
    card: any;
    onClose: () => void;
    onSave: (newContent: string) => Promise<void>;
}

interface Version {
    timestamp: number;
    content: string;
    id: string;
}

const CardWorkspace: React.FC<CardWorkspaceProps> = ({ card, onClose, onSave }) => {
    const [content, setContent] = useState(card.data?.text || '');
    const [originalContent, setOriginalContent] = useState(card.data?.text || '');
    const [isEditing, setIsEditing] = useState(false);
    const [versions, setVersions] = useState<Version[]>([]);
    const [saving, setSaving] = useState(false);
    const [activeVersionId, setActiveVersionId] = useState<string>('original');
    const [showSpriteConverter, setShowSpriteConverter] = useState(false);
    const [converting, setConverting] = useState(false);

    // Initialize versions (simulated for now, would fetch from P2P in real app)
    useEffect(() => {
        setVersions([
            { timestamp: card.timestamp, content: card.data?.text || '', id: 'original' }
        ]);
        setContent(card.data?.text || '');
        setOriginalContent(card.data?.text || '');
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

                // Append to original card's core
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
                    subType: 'sprite-sheet',
                    tags: [...(latestRecord.tags || []), 'sprite'],
                    derivedGif: {
                        localPath: gifPath,
                        cardId: result.cardId
                    },
                    updatedAt: new Date().toISOString()
                };

                await window.electronAPI.p2pAppend({
                    name: coreName,
                    data: JSON.stringify(updatedRecord)
                });

                setShowSpriteConverter(false);
                setConverting(false);
                // Ideally trigger a refresh here, but for now just close
            };
        } catch (e) {
            console.error("Failed to generate sprite sheet GIF:", e);
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
                            <h2 className="text-lg font-bold text-white tracking-tight">{card.data?.title || 'Untitled Card'}</h2>
                            <p className="text-[10px] font-mono text-gray-400">ID: {card.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {card.type === 'image' && !showSpriteConverter && (
                            <SecondaryButton onClick={() => setShowSpriteConverter(true)}>
                                <rux-icon icon="animation" size="small" className="mr-2"></rux-icon>
                                MAKE GIF
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
                            {showSpriteConverter ? (
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
            </div>
        </div>
    );
};

export default CardWorkspace;
