import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_MODELS,
  getApiKey,
  getModelSettings,
  setApiKey,
  setModelSettings,
} from '@/shared/genai/settings';

export default function SettingsPage() {
  const [apiKey, setApiKeyInput] = useState('');
  const [textModel, setTextModel] = useState(DEFAULT_MODELS.textModel);
  const [imageModel, setImageModel] = useState(DEFAULT_MODELS.imageModel);
  const [videoModel, setVideoModel] = useState(DEFAULT_MODELS.videoModel);

  useEffect(() => {
    setApiKeyInput(getApiKey() || '');
    const models = getModelSettings();
    setTextModel(models.textModel);
    setImageModel(models.imageModel);
    setVideoModel(models.videoModel);
  }, []);

  const keyStatus = useMemo(() => {
    if (!apiKey.trim()) return { label: 'No key set', ok: false };
    if (apiKey.trim().length < 20) return { label: 'Key looks too short', ok: false };
    return { label: 'Key set', ok: true };
  }, [apiKey]);

  const onSave = () => {
    setApiKey(apiKey);
    setModelSettings({ textModel, imageModel, videoModel });
    alert('Settings saved.');
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-orbitron text-2xl text-white">Settings</h1>
        <p className="text-slate-300 mt-2">
          Add your Gemini API key and choose default models. The app prefers the key you paste here
          (stored in localStorage) and falls back to <code className="text-slate-200">GEMINI_API_KEY</code> in <code className="text-slate-200">.env.local</code>.
        </p>

        <div className="mt-8 space-y-6">
          <div className="glass-panel rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron text-sm text-white tracking-wide">Gemini API Key</h2>
              <span
                className={
                  'text-xs font-mono px-2 py-1 rounded ' +
                  (keyStatus.ok
                    ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                    : 'bg-red-500/10 text-red-300 border border-red-500/20')
                }
              >
                {keyStatus.label}
              </span>
            </div>

            <textarea
              className="mt-4 w-full h-24 rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-white/20"
              placeholder="Paste your Gemini API key here"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <div className="mt-2 text-xs text-slate-400">
              Stored locally in your browser (localStorage).
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6 border border-white/10">
            <h2 className="font-orbitron text-sm text-white tracking-wide">Default Models</h2>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="text-sm text-slate-200">
                Text/JSON model
                <input
                  className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-white/20"
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                />
              </label>

              <label className="text-sm text-slate-200">
                Image model
                <input
                  className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-white/20"
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                />
              </label>

              <label className="text-sm text-slate-200">
                Video model
                <input
                  className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-white/20"
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                />
              </label>

              <div className="text-xs text-slate-400">
                Defaults: <span className="font-mono">{DEFAULT_MODELS.textModel}</span>,{' '}
                <span className="font-mono">{DEFAULT_MODELS.imageModel}</span>,{' '}
                <span className="font-mono">{DEFAULT_MODELS.videoModel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              className="px-4 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue hover:bg-hapa-blue/30 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setApiKeyInput('');
                setTextModel(DEFAULT_MODELS.textModel);
                setImageModel(DEFAULT_MODELS.imageModel);
                setVideoModel(DEFAULT_MODELS.videoModel);
              }}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-colors"
            >
              Reset form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
