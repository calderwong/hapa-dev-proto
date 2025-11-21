import React, { useState, useEffect } from 'react';

const Settings: React.FC = () => {
    const [geminiKey, setGeminiKey] = useState('');
    const [firebaseConfig, setFirebaseConfig] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI) {
                const settings = await window.electronAPI.getSettings();
                setGeminiKey(settings.geminiKey);
                setFirebaseConfig(settings.firebaseConfig);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (window.electronAPI) {
            await window.electronAPI.saveSettings({ geminiKey, firebaseConfig });
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
