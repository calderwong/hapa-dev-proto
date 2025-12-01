// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageContainer from '../components/PageContainer';
import { SecondaryButton } from '../components/Button';

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
        <PageContainer>
            <style>{`
                .glass-panel {
                    background: rgba(17, 24, 39, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .glass-panel:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .section-label {
                    font-size: 0.7rem;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(156, 163, 175, 0.8);
                    font-family: monospace;
                    margin-bottom: 0.5rem;
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

            <div className="w-full max-w-[1600px] mx-auto pb-24">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <rux-icon icon="history" size="large"></rux-icon>
                            ARCHIVES <span className="text-cyan-400 text-lg font-mono font-normal opacity-80">// HISTORY LOGS</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            INSPECT AND RESTORE PAST CONVERSATIONS FROM HYPERCORE
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 text-[10px] font-mono uppercase tracking-wider">
                            {archives.length} {archives.length === 1 ? 'RECORD' : 'RECORDS'}
                        </div>
                    </div>
                </div>

                {loading && <p className="text-gray-400 font-mono text-sm">LOADING ARCHIVES...</p>}
                {error && <p className="text-red-400 font-mono text-sm mb-4">ERROR: {error}</p>}

                {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-250px)]">
                        {/* Left Column: List */}
                        <div className="lg:col-span-1 flex flex-col h-full min-h-0">
                            <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="list" size="extra-small"></rux-icon>
                                Conversation History
                            </div>

                            <div className="glass-panel p-2 rounded-xl flex-1 overflow-hidden flex flex-col relative">
                                {archives.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
                                        <rux-icon icon="history-toggle-off" size="large" className="mb-2"></rux-icon>
                                        <p className="text-xs font-mono">NO ARCHIVES FOUND</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 p-1">
                                        {archives.map((archive) => {
                                            const active = archive.id === selectedId;
                                            const messageCount = archive.messages?.length ?? 0;
                                            const providerLabel = archive.providerSnapshot
                                                ? formatProviderLabel(archive.providerSnapshot)
                                                : 'Unknown';

                                            return (
                                                <button
                                                    key={archive.id}
                                                    type="button"
                                                    onClick={() => setSelectedId(archive.id)}
                                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all group ${active
                                                            ? 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                                                            : 'bg-transparent border-transparent hover:bg-white/5 hover:border-gray-700'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className={`font-mono text-xs ${active ? 'text-cyan-300' : 'text-gray-300 group-hover:text-white'}`}>
                                                            {new Date(archive.archivedAt).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 font-mono">
                                                            {new Date(archive.archivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] text-gray-400 font-medium">
                                                                {providerLabel}
                                                            </span>
                                                            {archive.modelSnapshot && (
                                                                <span className="text-[10px] text-gray-600 truncate max-w-[150px]">
                                                                    {archive.modelSnapshot}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="px-2 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 font-mono border border-gray-700">
                                                            {messageCount} MSG
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Detail */}
                        <div className="lg:col-span-2 flex flex-col h-full min-h-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-gray-400 font-bold tracking-widest text-xs uppercase">
                                    <rux-icon icon="chat" size="extra-small"></rux-icon>
                                    Archive Content
                                </div>
                                {selected && (
                                    <SecondaryButton
                                        type="button"
                                        onClick={() => handleRestore(selected)}
                                        disabled={restoringId === selected.id}
                                        className="h-[28px] text-[10px] px-3"
                                    >
                                        {restoringId === selected.id ? (
                                            <span className="flex items-center gap-2"><rux-icon icon="refresh" size="extra-small" className="animate-spin"></rux-icon> RESTORING...</span>
                                        ) : (
                                            <span className="flex items-center gap-2"><rux-icon icon="restore" size="extra-small"></rux-icon> RESTORE TO CHAT</span>
                                        )}
                                    </SecondaryButton>
                                )}
                            </div>

                            <div className="glass-panel rounded-xl flex-1 overflow-hidden flex flex-col relative">
                                {!selected ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
                                        <rux-icon icon="touch-app" size="large" className="mb-2"></rux-icon>
                                        <p className="text-xs font-mono">SELECT AN ARCHIVE TO VIEW</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-black/20">
                                        {selected.messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                                                    }`}
                                            >
                                                <div
                                                    className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-lg ${msg.role === 'user'
                                                            ? 'bg-cyan-900/20 border border-cyan-500/30 text-cyan-100 rounded-tr-sm'
                                                            : 'bg-gray-800/60 border border-gray-700 text-gray-200 rounded-tl-sm backdrop-blur-sm'
                                                        }`}
                                                >
                                                    {msg.role === 'model' && msg.provider && (
                                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                                                            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                                                                {formatProviderLabel(msg.provider)}
                                                            </span>
                                                            {msg.model && (
                                                                <span className="text-[10px] text-gray-500 font-mono">
                                                                    // {msg.model}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                p: ({ node, ...props }) => (
                                                                    // eslint-disable-next-line react/jsx-props-no-spreading
                                                                    <p {...props} className="mb-2 last:mb-0" />
                                                                ),
                                                                code: ({ node, inline, className, children, ...props }: any) => {
                                                                    return inline ? (
                                                                        <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-200 font-mono text-xs" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    ) : (
                                                                        <code className="block bg-black/30 p-3 rounded-lg text-gray-300 font-mono text-xs overflow-x-auto my-2 border border-white/5" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default Archives;
