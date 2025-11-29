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

    useEffect(() => {
        const loadEntries = async () => {
            if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.p2pRead) {
                setError('Wiki browser requires the Electron P2P backend.');
                return;
            }

            setLoading(true);
            setError(null);
            try {
                let items: string[] = [];
                try {
                    items = await window.electronAPI.p2pRead(WIKI_CORE_NAME);
                } catch (inner: any) {
                    const msg = inner?.message || '';
                    if (msg.includes('not found')) {
                        setEntries([]);
                        setLoading(false);
                        return;
                    }
                    throw inner;
                }

                const entryList: WikiEntryItem[] = [];
                const metaMap = new Map<string, WikiTermMeta>();
                for (const raw of items) {
                    if (!raw || typeof raw !== 'string') continue;
                    try {
                        const data = JSON.parse(raw);
                        if (!data || typeof data.type !== 'string') continue;

                        if (data.type === 'wiki-entry') {
                            const entry: WikiEntryItem = {
                                wikiId: String(data.wikiId || ''),
                                term: String(data.term || ''),
                                kind: typeof data.kind === 'string' ? data.kind : undefined,
                                createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
                                sourceCardId:
                                    typeof data.sourceCardId === 'string' ? (data.sourceCardId as string) : undefined,
                                raw: data,
                            };
                            entryList.push(entry);
                            continue;
                        }

                        if (data.type === 'wiki-term-meta') {
                            const term = (String(data.term || '').trim() || '(untitled term)');
                            const key = term.toLowerCase();
                            const updatedAt =
                                typeof data.updatedAt === 'string'
                                    ? data.updatedAt
                                    : typeof data.createdAt === 'string'
                                    ? data.createdAt
                                    : '';

                            const relatedTerms = Array.isArray(data.relatedTerms)
                                ? (data.relatedTerms as any[])
                                      .filter((t) => typeof t === 'string' && t.trim().length > 0)
                                      .map((t: string) => t.trim())
                                : undefined;

                            const nextMeta: WikiTermMeta = {
                                term,
                                slug: typeof data.slug === 'string' ? data.slug : undefined,
                                definition: typeof data.definition === 'string' ? data.definition : undefined,
                                relatedTerms,
                                updatedAt,
                                raw: data,
                            };

                            const existing = metaMap.get(key);
                            if (!existing) {
                                metaMap.set(key, nextMeta);
                            } else {
                                const prevTime = existing.updatedAt || '';
                                if (!prevTime || (updatedAt || '').localeCompare(prevTime) >= 0) {
                                    metaMap.set(key, nextMeta);
                                }
                            }
                        }
                    } catch {
                        // ignore parse errors
                    }
                }

                entryList.sort((a, b) => {
                    const termCmp = a.term.localeCompare(b.term);
                    if (termCmp !== 0) return termCmp;
                    const aTime = a.createdAt || '';
                    const bTime = b.createdAt || '';
                    return bTime.localeCompare(aTime);
                });

                const metaObj: Record<string, WikiTermMeta> = {};
                metaMap.forEach((value, key) => {
                    metaObj[key] = value;
                });

                setEntries(entryList);
                setTermMeta(metaObj);
            } catch (e: any) {
                setError(e?.message || 'Failed to load Wiki entries');
            } finally {
                setLoading(false);
            }
        };

        loadEntries();
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
            <div className="w-full text-white">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold">Wiki</h2>
                        <p className="text-sm text-gray-300 mt-1">
                            Browse Wormhole wiki entries created from key terms and jump to their source Cards.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by term or wiki ID"
                            className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/70 min-w-[220px]"
                        />
                    </div>
                </div>

                {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

                {loading && <p className="text-sm text-gray-400 mb-4">Loading wiki entries…</p>}

                {!loading && termGroups.length === 0 && !error && (
                    <p className="text-sm text-gray-400">
                        No wiki entries found yet. Run Wormhole processing (key terms + wiki update) on some Cards.
                    </p>
                )}

                {termGroups.length > 0 && (
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <button
                                        type="button"
                                        key={group.term}
                                        onClick={() => setSelectedTerm(group.term)}
                                        className={`text-left rounded-xl border p-4 flex flex-col gap-2 bg-gray-850/60 transition-colors ${{
                                            true: 'border-blue-500/80 shadow-md shadow-blue-900/30',
                                            false: 'border-gray-700 hover:border-gray-500/80',
                                        }[String(!!isSelected) as 'true' | 'false']}`}
                                    >
                                        <div className="text-sm font-semibold text-emerald-300 truncate" title={group.term}>
                                            {group.term}
                                        </div>
                                        {first.kind && (
                                            <div className="text-[11px] text-gray-400">Type: {first.kind}</div>
                                        )}
                                        <div className="text-[11px] text-gray-400">
                                            {totalEntries} wiki entr{totalEntries === 1 ? 'y' : 'ies'} ·{' '}
                                            {distinctCardIds.size} source card
                                            {distinctCardIds.size === 1 ? '' : 's'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedGroup && (
                            <div className="lg:w-1/3 rounded-xl border border-gray-700 bg-gray-900/80 p-4 text-xs text-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-semibold text-emerald-300">
                                        Term details
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTerm(null)}
                                        className="text-[11px] text-gray-400 hover:text-gray-200"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="mb-2">
                                    <div className="text-[11px] text-gray-500">Term</div>
                                    <div className="text-sm text-gray-100 break-words">{selectedGroup.term}</div>
                                </div>
                                {selectedGroup.entries[0]?.kind && (
                                    <div className="mb-2">
                                        <div className="text-[11px] text-gray-500">Type</div>
                                        <div className="text-[11px] text-gray-200">
                                            {selectedGroup.entries[0].kind}
                                        </div>
                                    </div>
                                )}
                                <div className="mt-2">
                                    <div className="text-[11px] text-gray-500 mb-0.5">Definition</div>
                                    <textarea
                                        value={definitionDraft}
                                        onChange={(e) => setDefinitionDraft(e.target.value)}
                                        rows={3}
                                        className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/70 resize-none"
                                        placeholder="Short description or definition for this term"
                                    />
                                </div>
                                <div className="mt-2">
                                    <div className="text-[11px] text-gray-500 mb-0.5">
                                        Related terms (comma-separated)
                                    </div>
                                    <input
                                        type="text"
                                        value={relatedTermsDraft}
                                        onChange={(e) => setRelatedTermsDraft(e.target.value)}
                                        className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/70"
                                        placeholder="e.g. Hypercore, Sovereign Memory"
                                    />
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveMeta}
                                        className="px-3 py-1.5 text-[11px] rounded-md bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white"
                                    >
                                        Save wiki notes
                                    </button>
                                </div>
                                <div className="mt-3">
                                    <div className="text-[11px] font-semibold text-gray-300 mb-1">
                                        Wiki entries
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-auto pr-1">
                                        {selectedGroup.entries.map((entry) => (
                                            <div
                                                key={entry.wikiId + (entry.createdAt || '') + (entry.sourceCardId || '')}
                                                className="border border-gray-700 rounded-md px-2 py-1.5 flex flex-col gap-1 bg-gray-900/60"
                                            >
                                                {entry.wikiId && (
                                                    <div className="text-[11px] text-gray-400 break-all">
                                                        <span className="text-gray-500">Wiki ID: </span>
                                                        {entry.wikiId}
                                                    </div>
                                                )}
                                                {entry.createdAt && (
                                                    <div className="text-[11px] text-gray-500">
                                                        Created: {entry.createdAt}
                                                    </div>
                                                )}
                                                {entry.sourceCardId && (
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenCard(entry.sourceCardId)}
                                                            className="px-2 py-0.5 text-[11px] rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-100"
                                                        >
                                                            Open source Card
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
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
