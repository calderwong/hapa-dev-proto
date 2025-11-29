import React, { useState } from 'react';
import PageContainer from '../components/PageContainer';
import { PrimaryButton } from '../components/Button';

const P2P: React.FC = () => {
    const [coreName, setCoreName] = useState('');
    const [coreInfo, setCoreInfo] = useState<any>(null);
    const [data, setData] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const handleCreate = async () => {
        if (!coreName) return;
        if (window.electronAPI) {
            const info = await window.electronAPI.p2pCreateCore(coreName);
            setCoreInfo(info);
            loadLogs();
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
            <div className="w-full text-white max-w-4xl">
                <h2 className="text-3xl font-bold mb-6">P2P Hypercore Manager</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4 text-green-400">Create / Join Core</h3>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={coreName}
                                onChange={(e) => setCoreName(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                                placeholder="Core Name"
                            />
                            <PrimaryButton
                                type="button"
                                onClick={handleCreate}
                                tone="green"
                                className="px-4"
                            >
                                Connect
                            </PrimaryButton>
                        </div>
                        {coreInfo && (
                            <div className="mt-4 p-4 bg-gray-900 rounded-lg text-xs font-mono break-all">
                                <p><span className="text-gray-500">Key:</span> {coreInfo.key}</p>
                                <p className="mt-2"><span className="text-gray-500">Discovery:</span> {coreInfo.discoveryKey}</p>
                                <p className="mt-2"><span className="text-gray-500">Length:</span> {coreInfo.length}</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4 text-blue-400">Append Data</h3>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                                placeholder="Data to append"
                            />
                            <PrimaryButton
                                type="button"
                                onClick={handleAppend}
                                className="px-4"
                            >
                                Append
                            </PrimaryButton>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-purple-400">Core Data</h3>
                        <button onClick={loadLogs} className="text-sm text-gray-400 hover:text-white">Refresh</button>
                    </div>
                    <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-1">
                        {logs.length === 0 ? (
                            <p className="text-gray-500 italic">No data found.</p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="border-b border-gray-800 pb-1 mb-1 last:border-0">
                                    <span className="text-gray-500 mr-2">[{i}]</span>
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            </div>
        </PageContainer>
    );
};

export default P2P;
