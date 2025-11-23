import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ArchiveMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    provider?: 'gemini' | 'openai' | 'llama';
    model?: string;
}

interface ArchiveRecord {
    id: string;
    archivedAt: string;
    providerSnapshot?: 'gemini' | 'openai' | 'llama';
    modelSnapshot?: string;
    messages: ArchiveMessage[];
}

const CHAT_ARCHIVES_STORAGE_KEY = 'chatArchives';
const CHAT_MESSAGES_STORAGE_KEY = 'chatMessages';

const formatProviderLabel = (value: 'gemini' | 'openai' | 'llama') => {
    if (value === 'gemini') return 'Gemini';
    if (value === 'openai') return 'OpenAI';
    return 'Local (llama.cpp)';
};

const Archives: React.FC = () => {
    const [archives, setArchives] = useState<ArchiveRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const navigate = useNavigate();

    const loadArchives = async () => {
        setLoading(true);
        setError(null);
        try {
            const byId = new Map<string, ArchiveRecord>();

            if (typeof window !== 'undefined') {
                try {
                    const rawLocal = window.localStorage.getItem(CHAT_ARCHIVES_STORAGE_KEY);
                    const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
                    if (Array.isArray(parsedLocal)) {
                        parsedLocal.forEach((item: any) => {
                            if (!item || typeof item !== 'object') return;
                            if (!item.id || typeof item.id !== 'string') return;
                            if (!Array.isArray(item.messages)) return;
                            byId.set(item.id, item as ArchiveRecord);
                        });
                    }
                } catch (inner) {
                    console.error('Failed to read local chat archives:', inner);
                }
            }

            if (typeof window !== 'undefined' && window.electronAPI?.p2pRead) {
                try {
                    const rows = await window.electronAPI.p2pRead('chat-archives');
                    if (Array.isArray(rows)) {
                        rows.forEach((raw) => {
                            try {
                                const parsed = JSON.parse(raw);
                                if (!parsed || typeof parsed !== 'object') return;
                                if (!parsed.id || typeof parsed.id !== 'string') return;
                                if (!Array.isArray(parsed.messages)) return;
                                byId.set(parsed.id, parsed as ArchiveRecord);
                            } catch (parseErr) {
                                console.error('Failed to parse chat-archives entry:', parseErr);
                            }
                        });
                    }
                } catch (p2pErr: any) {
                    console.error('Failed to read chat-archives core:', p2pErr);
                }
            }

            const merged = Array.from(byId.values());
            merged.sort((a, b) => {
                const da = Date.parse(a.archivedAt || '');
                const db = Date.parse(b.archivedAt || '');
                if (Number.isNaN(da) || Number.isNaN(db)) return 0;
                return db - da;
            });

            setArchives(merged);
            if (merged.length > 0 && !selectedId) {
                setSelectedId(merged[0].id);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load chat archives');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArchives();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selected = archives.find((a) => a.id === selectedId) || null;

    const handleRestore = async (record: ArchiveRecord) => {
        if (!record || record.messages.length === 0) return;
        if (typeof window === 'undefined') return;
        setRestoringId(record.id);
        try {
            const serializable = record.messages.map((m) => ({
                id: m.id,
                role: m.role === 'model' ? 'model' : 'user',
                content: m.content,
                provider:
                    m.provider === 'gemini' || m.provider === 'openai' || m.provider === 'llama'
                        ? m.provider
                        : undefined,
                model: typeof m.model === 'string' ? m.model : undefined,
            }));
            window.localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(serializable));
            navigate('/');
        } catch (err) {
            console.error('Failed to restore archive into chat:', err);
            setError('Failed to restore archive into chat');
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto w-full text-white">
            <h2 className="text-3xl font-bold mb-2">Chat Archives</h2>
            <p className="text-sm text-gray-300 mb-6">
                Archived conversations are written to a local Hypercore ("chat-archives") and
                mirrored in local storage. You can inspect them here and restore any archive back
                into the main Chat view.
            </p>

            {loading && <p className="text-gray-400 mb-4">Loading archives...</p>}
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {archives.length === 0 && !loading ? (
                <p className="text-gray-400 text-sm">No archived conversations yet.</p>
            ) : (
                <div className="flex gap-4 mt-2">
                    <div className="w-1/3 bg-gray-900 border border-gray-800 rounded-xl p-3 max-h-[480px] overflow-y-auto">
                        {archives.map((archive) => {
                            const active = archive.id === selectedId;
                            const messageCount = archive.messages?.length ?? 0;
                            const providerLabel = archive.providerSnapshot
                                ? formatProviderLabel(archive.providerSnapshot)
                                : 'Unknown provider';
                            return (
                                <button
                                    key={archive.id}
                                    type="button"
                                    onClick={() => setSelectedId(archive.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg mb-2 border text-xs transition-colors ${
                                        active
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                                            : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-blue-500'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold truncate">
                                            {new Date(archive.archivedAt).toLocaleString()}
                                        </span>
                                        <span className="ml-2 text-[10px] text-gray-400">
                                            {messageCount} msg
                                        </span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-300 truncate">
                                        {providerLabel}
                                        {archive.modelSnapshot ? ` · ${archive.modelSnapshot}` : ''}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 min-h-[260px]">
                        {!selected ? (
                            <p className="text-gray-400 text-sm mt-1">
                                Select an archive on the left to view its contents.
                            </p>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-semibold text-sm">
                                            {new Date(selected.archivedAt).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {selected.providerSnapshot
                                                ? formatProviderLabel(selected.providerSnapshot)
                                                : 'Unknown provider'}
                                            {selected.modelSnapshot
                                                ? ` · ${selected.modelSnapshot}`
                                                : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRestore(selected)}
                                        disabled={restoringId === selected.id}
                                        className="text-xs px-3 py-1 rounded-full border border-blue-500 text-blue-100 hover:bg-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {restoringId === selected.id ? 'Restoring...' : 'Restore into Chat'}
                                    </button>
                                </div>
                                <div className="flex-1 border-t border-gray-800 mt-2 pt-3 space-y-3 max-h-[420px] overflow-y-auto">
                                    {selected.messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                                                    msg.role === 'user'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                                                }`}
                                            >
                                                {msg.role === 'model' && msg.provider && msg.model && (
                                                    <p className="text-[10px] text-gray-400 mb-1">
                                                        {formatProviderLabel(msg.provider)} · {msg.model}
                                                    </p>
                                                )}
                                                <div className="prose prose-invert max-w-none break-words">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ node, ...props }) => (
                                                                // eslint-disable-next-line react/jsx-props-no-spreading
                                                                <p {...props} className="mb-1 last:mb-0" />
                                                            ),
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Archives;
