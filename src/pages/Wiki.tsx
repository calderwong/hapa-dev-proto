// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';

interface WikiEntryItem {
    wikiId: string;
    term: string;
    kind?: string;
    createdAt?: string;
    sourceCardId?: string;
    raw: any;
}

interface WikiTermMeta {
    term: string;
    slug?: string;
    definition?: string;
    relatedTerms?: string[];
    updatedAt?: string;
    raw: any;
}

const WIKI_CORE_NAME = 'wormhole-wiki-entries';

const Wiki: React.FC = () => {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<WikiEntryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
    const [termMeta, setTermMeta] = useState<Record<string, WikiTermMeta>>({});
    const [definitionDraft, setDefinitionDraft] = useState('');
    const [relatedTermsDraft, setRelatedTermsDraft] = useState('');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let isMounted = true;

        const loadEntries = async () => {
            if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeGetWikiIndex) {
                setError('Wiki browser requires the Electron backend with wormholeGetWikiIndex support.');
                return;
            }

            setLoading(true);
            setProgress(0);
            setError(null);
            setEntries([]);
            setTermMeta({});

            try {
                // Fetch all entries at once from the backend
                const { entryList, metaMap } = await window.electronAPI.wormholeGetWikiIndex();

                if (isMounted) {
                    setEntries(entryList || []);
                    setTermMeta(metaMap || {});
                    setLoading(false);
                    setProgress(100);
                }
            } catch (e: any) {
                if (isMounted) {
                    setError(e?.message || 'Failed to load Wiki entries');
                    setLoading(false);
                }
            }
        };

        loadEntries();
        return () => { isMounted = false; };
    }, []);

    const filteredEntries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((entry) => {
            const term = entry.term.toLowerCase();
            const wikiId = entry.wikiId.toLowerCase();
            return term.includes(q) || wikiId.includes(q);
        });
    }, [entries, search]);

    const termGroups = useMemo<{
        term: string;
        entries: WikiEntryItem[];
    }[]>(() => {
        const map = new Map<string, { term: string; entries: WikiEntryItem[] }>();
        for (const entry of filteredEntries) {
            const rawTerm = (entry.term || '').trim() || '(untitled term)';
            const key = rawTerm.toLowerCase();
            const existing = map.get(key);
            if (existing) {
                existing.entries.push(entry);
            } else {
                map.set(key, { term: rawTerm, entries: [entry] });
            }
        }

        const groups = Array.from(map.values());
        groups.sort((a, b) => a.term.localeCompare(b.term));
        return groups;
    }, [filteredEntries]);

    const selectedGroup = useMemo(() => {
        if (!selectedTerm) return null;
        const key = selectedTerm.trim().toLowerCase();
        return (
            termGroups.find((g) => g.term.trim().toLowerCase() === key) || null
        );
    }, [selectedTerm, termGroups]);

    useEffect(() => {
        if (!selectedGroup) {
            setDefinitionDraft('');
            setRelatedTermsDraft('');
            return;
        }

        const key = selectedGroup.term.trim().toLowerCase();
        const meta = termMeta[key];
        if (!meta) {
            setDefinitionDraft('');
            setRelatedTermsDraft('');
            return;
        }

        setDefinitionDraft(meta.definition || '');
        const related = Array.isArray(meta.relatedTerms) ? meta.relatedTerms : [];
        setRelatedTermsDraft(related.join(', '));
    }, [selectedGroup, termMeta]);

    const handleOpenCard = (cardId: string | undefined) => {
        if (!cardId) return;
        navigate(`/cards?cardId=${encodeURIComponent(cardId)}`);
    };

    const handleSaveMeta = async () => {
        if (!selectedGroup) return;
        if (
            typeof window === 'undefined' ||
            !window.electronAPI ||
            !window.electronAPI.p2pAppend ||
            !window.electronAPI.p2pCreateCore
        ) {
            setError('Saving wiki term metadata requires the Electron P2P backend.');
            return;
        }

        const term = selectedGroup.term;
        const slug = term
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
        const now = new Date().toISOString();

        const relatedTerms = relatedTermsDraft
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

        const record: any = {
            type: 'wiki-term-meta',
            term,
            slug,
            definition: definitionDraft.trim() || undefined,
            relatedTerms: relatedTerms.length > 0 ? relatedTerms : undefined,
            updatedAt: now,
        };

        try {
            try {
                await window.electronAPI.p2pCreateCore(WIKI_CORE_NAME);
            } catch (inner: any) {
                const msg = inner?.message || '';
                if (!msg.includes('already exists')) {
                    console.error('Failed to ensure wiki core for metadata:', inner);
                }
            }

            await window.electronAPI.p2pAppend({
                name: WIKI_CORE_NAME,
                data: JSON.stringify(record),
            });

            const key = term.trim().toLowerCase();
            setTermMeta((prev) => ({
                ...prev,
                [key]: {
                    term,
                    slug,
                    definition: record.definition,
                    relatedTerms: (record.relatedTerms as string[]) || [],
                    updatedAt: now,
                    raw: record,
                },
            }));
        } catch (e: any) {
            setError(e?.message || 'Failed to save wiki term metadata.');
        }
    };

    return (
        <PageContainer>
            <style>{`
                .wiki-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }
                .glass-panel {
                    background: rgba(17, 24, 39, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .wiki-card-hover:hover {
                    border-color: rgba(52, 211, 153, 0.5);
                    box-shadow: 0 0 20px rgba(52, 211, 153, 0.1);
                    transform: translateY(-2px);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>

            <div className="w-full text-white h-full flex flex-col max-w-[1800px] mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-6 mb-6">
                    <div>
                        <h2 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                            <rux-icon icon="library-books" size="large"></rux-icon>
                            WIKI <span className="text-blue-400 text-lg font-mono font-normal opacity-80">// NEURAL ARCHIVE</span>
                        </h2>
                        <p className="text-gray-400 mt-1 font-mono text-xs tracking-wide">
                            KNOWLEDGE GRAPH NODES & DEFINITIONS
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-200"></div>
                            <rux-input
                                type="text"
                                value={search}
                                onInput={(e: any) => setSearch(e.target.value)}
                                placeholder="Search neural index..."
                                className="relative min-w-[300px]"
                            >
                                <rux-icon slot="prefix" icon="search" size="small"></rux-icon>
                            </rux-input>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-300">
                        <rux-icon icon="warning" size="small"></rux-icon>
                        <span className="font-mono text-sm">{error}</span>
                    </div>
                )}

                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                        <rux-progress value={progress} max={100}></rux-progress>
                        <div className="font-mono text-sm animate-pulse text-blue-400">
                            SCANNING NEURAL PATHWAYS... {progress > 0 ? `${progress}%` : ''}
                        </div>
                    </div>
                )}

                {!loading && termGroups.length === 0 && !error && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                        <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center border border-gray-700">
                            <rux-icon icon="auto-stories" size="large" className="opacity-20"></rux-icon>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-gray-300">Archive Empty</div>
                            <div className="text-sm text-gray-500 mt-1 max-w-md">
                                No knowledge nodes detected. Process cards in the Wormhole to generate wiki entries.
                            </div>
                        </div>
                    </div>
                )}

                {!loading && termGroups.length > 0 && (
                    <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
                        {/* Left Panel: The Index */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div className="wiki-grid pb-6">
                                {termGroups.map((group) => {
                                    const distinctCardIds = new Set(
                                        group.entries
                                            .map((e) => e.sourceCardId)
                                            .filter((id): id is string => typeof id === 'string' && id.length > 0),
                                    );
                                    const totalEntries = group.entries.length;
                                    const first = group.entries[0];
                                    const isSelected =
                                        selectedTerm &&
                                        selectedTerm.trim().toLowerCase() === group.term.trim().toLowerCase();

                                    return (
                                        <div
                                            key={group.term}
                                            onClick={() => setSelectedTerm(group.term)}
                                            className={`cursor-pointer transition-all duration-200 rounded-lg border p-4 flex flex-col gap-3 relative overflow-hidden group wiki-card-hover ${isSelected
                                                ? 'bg-blue-900/20 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                                : 'bg-gray-900/40 border-gray-800 hover:bg-gray-800/60'
                                                }`}
                                        >
                                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}

                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-bold text-lg truncate leading-tight ${isSelected ? 'text-blue-300' : 'text-gray-200 group-hover:text-white'}`}>
                                                    {group.term}
                                                </h3>
                                                {first.kind && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-gray-800 text-gray-400 border border-gray-700">
                                                        {first.kind}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-auto flex items-center gap-4 text-[11px] font-mono text-gray-500">
                                                <div className="flex items-center gap-1.5">
                                                    <rux-icon icon="description" size="extra-small" className="opacity-60"></rux-icon>
                                                    <span>{totalEntries} NODE{totalEntries !== 1 ? 'S' : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <rux-icon icon="link" size="extra-small" className="opacity-60"></rux-icon>
                                                    <span>{distinctCardIds.size} SOURCE{distinctCardIds.size !== 1 ? 'S' : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Panel: The Inspector */}
                        {selectedGroup && (
                            <div className="w-[400px] xl:w-[480px] flex-shrink-0 flex flex-col glass-panel rounded-xl overflow-hidden border-l-4 border-l-blue-500/50 shadow-2xl animate-in slide-in-from-right-4 duration-300">
                                {/* Inspector Header */}
                                <div className="p-6 border-b border-gray-700/50 bg-gray-900/30">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-blue-400">
                                            <rux-icon icon="info" size="extra-small"></rux-icon>
                                            Node Inspector
                                        </div>
                                        <button
                                            onClick={() => setSelectedTerm(null)}
                                            className="text-gray-500 hover:text-white transition-colors"
                                        >
                                            <rux-icon icon="close" size="small"></rux-icon>
                                        </button>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2 break-words leading-tight">
                                        {selectedGroup.term}
                                    </h2>
                                    {selectedGroup.entries[0]?.kind && (
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                            {selectedGroup.entries[0].kind}
                                        </div>
                                    )}
                                </div>

                                {/* Inspector Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                    {/* Definition Section */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <rux-icon icon="menu-book" size="extra-small"></rux-icon>
                                            Definition
                                        </label>
                                        <rux-textarea
                                            value={definitionDraft}
                                            onInput={(e: any) => setDefinitionDraft(e.target.value)}
                                            placeholder="Enter a definition for this term..."
                                            rows={4}
                                            className="w-full"
                                        ></rux-textarea>
                                    </div>

                                    {/* Related Terms Section */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <rux-icon icon="share" size="extra-small"></rux-icon>
                                            Related Nodes
                                        </label>
                                        <rux-input
                                            value={relatedTermsDraft}
                                            onInput={(e: any) => setRelatedTermsDraft(e.target.value)}
                                            placeholder="e.g. Hypercore, Protocol, Network"
                                            className="w-full"
                                            help-text="Comma-separated list of related terms"
                                        ></rux-input>
                                    </div>

                                    {/* Action Button */}
                                    <div className="pt-2">
                                        <rux-button
                                            onClick={handleSaveMeta}
                                            className="w-full justify-center"
                                            icon="save"
                                        >
                                            Update Knowledge Node
                                        </rux-button>
                                    </div>

                                    <div className="h-px bg-gray-700/50 my-2"></div>

                                    {/* Source Entries */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <rux-icon icon="layers" size="extra-small"></rux-icon>
                                            Source References ({selectedGroup.entries.length})
                                        </label>
                                        <div className="space-y-2">
                                            {selectedGroup.entries.map((entry) => (
                                                <div
                                                    key={entry.wikiId + (entry.createdAt || '') + (entry.sourceCardId || '')}
                                                    className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-mono text-gray-500 truncate max-w-[150px]" title={entry.wikiId}>
                                                            {entry.wikiId}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Unknown Date'}
                                                        </span>
                                                    </div>
                                                    {entry.sourceCardId && (
                                                        <rux-button
                                                            size="small"
                                                            secondary
                                                            className="w-full justify-center"
                                                            onClick={() => handleOpenCard(entry.sourceCardId)}
                                                        >
                                                            Open Source Card
                                                        </rux-button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default Wiki;
