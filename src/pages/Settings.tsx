import React, { useState, useEffect } from 'react';

const Settings: React.FC = () => {
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [firebaseConfig, setFirebaseConfig] = useState('');
    const [revidKey, setRevidKey] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI) {
                const settings = await window.electronAPI.getSettings();
                setGeminiKey(settings.geminiKey);
                setOpenaiKey(settings.openaiKey || '');
                setFirebaseConfig(settings.firebaseConfig);
                setRevidKey(settings.revidKey || '');
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (window.electronAPI) {
            await window.electronAPI.saveSettings({ geminiKey, openaiKey, firebaseConfig, revidKey });
            setStatus('Settings saved!');
            setTimeout(() => setStatus(''), 3000);
        } else {
            setStatus('Electron API not available (Browser Mode)');
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold mb-8">Settings</h2>

            <div className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-blue-400">Google Gemini</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Enter your Gemini API Key"
                        />
                    </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-pink-400">Revid.ai</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={revidKey}
                            onChange={(e) => setRevidKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-pink-500 transition-colors"
                            placeholder="Enter your Revid API Key"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Get your API key from your Revid account. Calls consume credits based on your plan and
                            options.
                        </p>
                    </div>
                </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-indigo-400">OpenAI</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Enter your OpenAI API Key"
                        />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-orange-400">Firebase</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Configuration (JSON)</label>
                        <textarea
                            value={firebaseConfig}
                            onChange={(e) => setFirebaseConfig(e.target.value)}
                            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
                            placeholder='{"apiKey": "...", "authDomain": "..."}'
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <button
                        onClick={handleSave}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        Save Settings
                    </button>
                    {status && <span className="text-green-400 animate-fade-in">{status}</span>}
                </div>
            </div>
        </div>
    );
};

export default Settings;
