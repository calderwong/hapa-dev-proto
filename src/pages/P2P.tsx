// @ts-nocheck
import React, { useState } from 'react';
import PageContainer from '../components/PageContainer';

const P2P: React.FC = () => {
    const [coreName, setCoreName] = useState('');
    const [coreInfo, setCoreInfo] = useState<any>(null);
    const [data, setData] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleCreate = async () => {
        if (!coreName) return;
        setIsConnecting(true);
        if (window.electronAPI) {
            try {
                const info = await window.electronAPI.p2pCreateCore(coreName);
                setCoreInfo(info);
                loadLogs();
            } catch (e) {
                console.error(e);
            } finally {
                setIsConnecting(false);
            }
        }
    };

    const handleAppend = async () => {
        if (!coreName || !data) return;
        if (window.electronAPI) {
            await window.electronAPI.p2pAppend({ name: coreName, data });
            setData('');
            loadLogs();
        }
    };

    const loadLogs = async () => {
        if (!coreName) return;
        if (window.electronAPI) {
            const items = await window.electronAPI.p2pRead(coreName);
            setLogs(items);
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
                .input-base {
                    background: rgba(17, 24, 39, 0.4);
                    border: 1px solid rgba(75, 85, 99, 0.5);
                    color: white;
                    transition: all 0.2s;
                }
                .input-base:focus {
                    border-color: rgba(59, 130, 246, 0.5);
                    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
                    outline: none;
                }
                .btn-primary {
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    background: rgba(59, 130, 246, 0.3);
                    border-color: rgba(59, 130, 246, 0.6);
                    color: #93c5fd;
                }
                .btn-success {
                    background: rgba(16, 185, 129, 0.2);
                    border: 1px solid rgba(16, 185, 129, 0.4);
                    color: #34d399;
                    transition: all 0.2s;
                }
                .btn-success:hover {
                    background: rgba(16, 185, 129, 0.3);
                    border-color: rgba(16, 185, 129, 0.6);
                    color: #6ee7b7;
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
                            <rux-icon icon="hub" size="large"></rux-icon>
                            P2P MANAGER <span className="text-green-400 text-lg font-mono font-normal opacity-80">// HYPERCORE SWARM</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            DECENTRALIZED DATA REPLICATION AND SYNC
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Controls */}
                    <div className="space-y-8">
                        {/* Connection */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-green-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="wifi-tethering" size="extra-small"></rux-icon>
                                Neural Uplink
                            </div>

                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                        Core Connection
                                    </h4>
                                    <rux-icon icon="dns" size="small" className="text-green-400 opacity-50"></rux-icon>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="section-label">Core Name / Key</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={coreName}
                                                onChange={(e) => setCoreName(e.target.value)}
                                                className="flex-1 rounded-lg px-4 py-2.5 input-base font-mono text-sm"
                                                placeholder="Enter Core Name"
                                            />
                                            <button
                                                onClick={handleCreate}
                                                disabled={isConnecting}
                                                className="btn-success px-6 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                                            >
                                                {isConnecting ? '...' : 'Connect'}
                                            </button>
                                        </div>
                                    </div>

                                    {coreInfo && (
                                        <div className="bg-black/40 rounded-lg p-4 font-mono text-[10px] text-gray-400 border border-gray-800 space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">KEY:</span>
                                                <span className="text-green-400 select-all">{coreInfo.key}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">DISCOVERY:</span>
                                                <span className="text-blue-400 select-all">{coreInfo.discoveryKey}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">LENGTH:</span>
                                                <span className="text-white">{coreInfo.length} BLOCKS</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Append Data */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="input" size="extra-small"></rux-icon>
                                Data Injection
                            </div>

                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                        Append Data
                                    </h4>
                                    <rux-icon icon="playlist-add" size="small" className="text-blue-400 opacity-50"></rux-icon>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="section-label">Payload</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={data}
                                                onChange={(e) => setData(e.target.value)}
                                                className="flex-1 rounded-lg px-4 py-2.5 input-base font-mono text-sm"
                                                placeholder="Enter data to append..."
                                            />
                                            <button
                                                onClick={handleAppend}
                                                className="btn-primary px-6 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider"
                                            >
                                                Append
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Data Stream */}
                    <div className="space-y-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-purple-400 font-bold tracking-widest text-xs uppercase">
                                <rux-icon icon="stream" size="extra-small"></rux-icon>
                                Data Stream
                            </div>
                            <button
                                onClick={loadLogs}
                                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                                title="Refresh Stream"
                            >
                                <rux-icon icon="refresh" size="small"></rux-icon>
                            </button>
                        </div>

                        <div className="glass-panel p-0 rounded-xl relative overflow-hidden flex-1 flex flex-col min-h-[500px]">
                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60"></div>
                            <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                <span className="text-xs font-mono text-gray-400">LIVE FEED</span>
                                <span className="text-[10px] font-mono text-gray-600">{logs.length} ENTRIES</span>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar">
                                {logs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                        <rux-icon icon="portable-wifi-off" size="large" className="mb-2"></rux-icon>
                                        <p>NO DATA DETECTED</p>
                                    </div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className="group flex gap-3 hover:bg-white/5 p-1 rounded transition-colors border-b border-gray-800/50 last:border-0">
                                            <span className="text-gray-600 select-none w-8 text-right">[{i}]</span>
                                            <span className="text-gray-300 break-all">{log}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default P2P;
