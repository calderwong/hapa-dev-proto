// @ts-nocheck
import React, { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';

const Revid: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [mediaType, setMediaType] = useState<'stockVideo' | 'movingImage' | 'aiVideo'>('movingImage');
    const [captionPresetName, setCaptionPresetName] = useState('Wrap 1');
    const [generationPreset, setGenerationPreset] = useState('DEFAULT');
    const [generationUserPrompt, setGenerationUserPrompt] = useState('');
    const [hasEnhancedGeneration, setHasEnhancedGeneration] = useState(true);
    const [hasToGenerateVoice, setHasToGenerateVoice] = useState(true);
    const [hasToSearchMedia, setHasToSearchMedia] = useState(true);
    const [ratio, setRatio] = useState('9 / 16');
    const [webhook, setWebhook] = useState('');
    const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
    const [compression, setCompression] = useState<number>(18);
    const [frameRate, setFrameRate] = useState<number>(30);

    const [estimateResult, setEstimateResult] = useState<any | null>(null);
    const [estimateLoading, setEstimateLoading] = useState(false);

    const [renderResult, setRenderResult] = useState<any | null>(null);
    const [renderLoading, setRenderLoading] = useState(false);

    const [pid, setPid] = useState('');
    const [statusResult, setStatusResult] = useState<any | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);

    const [projects, setProjects] = useState<any[] | null>(null);
    const [projectsLoading, setProjectsLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const hasRevidSupport = !!window.electronAPI && !!window.electronAPI.revidRender;

    useEffect(() => {
        if (!hasRevidSupport) {
            setError('Revid integration is not available in this build.');
        }
    }, [hasRevidSupport]);

    const resolveProjectMeta = (project: any) => {
        if (!project || typeof project !== 'object') {
            return { pid: '', status: '', createdAt: '', videoUrl: '' };
        }
        const pidValue =
            project.pid || project.id || project.projectId || project._id || '';
        const statusValue = project.status || project.state || project.stage || '';
        const createdValue = project.createdAt || project.created || project.date || '';
        const videoUrlValue = project.videoUrl || project.url || project.renderUrl || '';

        return {
            pid: typeof pidValue === 'string' ? pidValue : String(pidValue || ''),
            status:
                typeof statusValue === 'string' ? statusValue : String(statusValue || ''),
            createdAt:
                typeof createdValue === 'string'
                    ? createdValue
                    : String(createdValue || ''),
            videoUrl:
                typeof videoUrlValue === 'string'
                    ? videoUrlValue
                    : String(videoUrlValue || ''),
        };
    };

    const buildCreationParams = () => {
        return {
            mediaType,
            captionPresetName,
            selectedVoice: 'SAz9YHcvj6GT2YYXdXww',
            hasEnhancedGeneration,
            generationPreset,
            generationUserPrompt: generationUserPrompt || undefined,
            selectedAudio: 'Observer',
            origin: '/create',
            inputText,
            flowType: 'text-to-video',
            slug: 'create-tiktok-video',
            hasToGenerateVoice,
            hasToTranscript: false,
            hasToSearchMedia,
            hasAvatar: false,
            hasWebsiteRecorder: false,
            hasTextSmallAtBottom: false,
            ratio,
            sourceType: 'contentScraping',
            selectedStoryStyle: {
                value: 'custom',
                label: 'Custom',
            },
            hasToGenerateVideos: true,
            audioUrl: 'https://cdn.revid.ai/audio/observer.mp3',
        };
    };

    const handleEstimateCredits = async () => {
        if (!window.electronAPI || !window.electronAPI.revidEstimateCredits) return;
        if (!inputText.trim()) {
            setError('Please enter some input text or URL.');
            return;
        }
        setError(null);
        setEstimateLoading(true);
        setEstimateResult(null);
        try {
            const creationParams = buildCreationParams();
            const result = await window.electronAPI.revidEstimateCredits({ creationParams });
            setEstimateResult(result);
        } catch (e: any) {
            setError(e?.message || 'Failed to estimate Revid credits');
        } finally {
            setEstimateLoading(false);
        }
    };

    const handleRender = async () => {
        if (!window.electronAPI || !window.electronAPI.revidRender) return;
        if (!inputText.trim()) {
            setError('Please enter some input text or URL before rendering.');
            return;
        }
        setError(null);
        setRenderLoading(true);
        setRenderResult(null);
        try {
            const creationParams = buildCreationParams();
            const payload: any = {
                creationParams,
            };
            if (webhook.trim()) payload.webhook = webhook.trim();
            if (resolution) payload.resolution = resolution;
            if (compression) payload.compression = compression;
            if (frameRate) payload.frameRate = frameRate;

            const result = await window.electronAPI.revidRender(payload);
            setRenderResult(result);
            const maybePid = (result && (result.pid || result.projectId || result.id)) || '';
            if (maybePid && !pid) {
                setPid(maybePid);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to create Revid video');
        } finally {
            setRenderLoading(false);
        }
    };

    const handleGetStatus = async () => {
        if (!window.electronAPI || !window.electronAPI.revidGetStatus) return;
        const trimmedPid = pid.trim();
        if (!trimmedPid) {
            setError('Please enter a project PID to check status.');
            return;
        }
        setError(null);
        setStatusLoading(true);
        setStatusResult(null);
        try {
            const result = await window.electronAPI.revidGetStatus({ pid: trimmedPid });
            setStatusResult(result);
        } catch (e: any) {
            setError(e?.message || 'Failed to fetch Revid project status');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleListProjects = async () => {
        if (!window.electronAPI || !window.electronAPI.revidListProjects) return;
        setError(null);
        setProjectsLoading(true);
        setProjects(null);
        try {
            const result = await window.electronAPI.revidListProjects({ limit: 10 });
            const items = Array.isArray(result) ? result : result?.projects || [];
            setProjects(items);
        } catch (e: any) {
            setError(e?.message || 'Failed to list Revid projects');
        } finally {
            setProjectsLoading(false);
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
                    background: rgba(236, 72, 153, 0.2);
                    border: 1px solid rgba(236, 72, 153, 0.4);
                    color: #f472b6;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    background: rgba(236, 72, 153, 0.3);
                    border-color: rgba(236, 72, 153, 0.6);
                    color: #fbcfe8;
                }
                .btn-secondary {
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                    transition: all 0.2s;
                }
                .btn-secondary:hover {
                    background: rgba(59, 130, 246, 0.3);
                    border-color: rgba(59, 130, 246, 0.6);
                    color: #93c5fd;
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
                            <rux-icon icon="videocam" size="large"></rux-icon>
                            REVID.AI <span className="text-pink-400 text-lg font-mono font-normal opacity-80">// VIDEO GENERATION</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            AI-POWERED TEXT-TO-VIDEO GENERATION AND MANAGEMENT
                        </p>
                    </div>
                </div>

                {!hasRevidSupport && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 flex items-center gap-3">
                        <rux-icon icon="error" size="small"></rux-icon>
                        <span className="text-sm font-mono">REVID INTEGRATION UNAVAILABLE. CHECK ELECTRON SETTINGS.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Neural Render Engine */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-pink-400 font-bold tracking-widest text-xs uppercase mb-2">
                            <rux-icon icon="movie-creation" size="extra-small"></rux-icon>
                            Neural Render Engine
                        </div>

                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-pink-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                            <div className="space-y-6">
                                <div>
                                    <label className="section-label">Input Prompt / URL</label>
                                    <textarea
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        className="w-full h-32 rounded-lg px-4 py-3 input-base font-mono text-sm leading-relaxed resize-none"
                                        placeholder="Describe the video you want or paste a URL to scrape..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="section-label">Media Type</label>
                                        <select
                                            value={mediaType}
                                            onChange={(e) => setMediaType(e.target.value as any)}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs appearance-none"
                                        >
                                            <option value="stockVideo">Stock Video</option>
                                            <option value="movingImage">AI Images (Animated)</option>
                                            <option value="aiVideo">AI Video</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="section-label">Aspect Ratio</label>
                                        <select
                                            value={ratio}
                                            onChange={(e) => setRatio(e.target.value)}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs appearance-none"
                                        >
                                            <option value="9 / 16">9:16 (Vertical)</option>
                                            <option value="16 / 9">16:9 (Landscape)</option>
                                            <option value="1 / 1">1:1 (Square)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="section-label">Style Preset</label>
                                        <input
                                            type="text"
                                            value={generationPreset}
                                            onChange={(e) => setGenerationPreset(e.target.value)}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="DEFAULT"
                                        />
                                    </div>
                                    <div>
                                        <label className="section-label">Style Prompt</label>
                                        <input
                                            type="text"
                                            value={generationUserPrompt}
                                            onChange={(e) => setGenerationUserPrompt(e.target.value)}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="Optional..."
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group/check">
                                        <input
                                            type="checkbox"
                                            checked={hasEnhancedGeneration}
                                            onChange={(e) => setHasEnhancedGeneration(e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hasEnhancedGeneration ? 'bg-pink-500 border-pink-500' : 'border-gray-600 group-hover/check:border-pink-400'}`}>
                                            {hasEnhancedGeneration && <rux-icon icon="check" size="extra-small" className="text-black"></rux-icon>}
                                        </div>
                                        <span className="text-xs font-mono text-gray-300">ENHANCED QUALITY</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group/check">
                                        <input
                                            type="checkbox"
                                            checked={hasToGenerateVoice}
                                            onChange={(e) => setHasToGenerateVoice(e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hasToGenerateVoice ? 'bg-pink-500 border-pink-500' : 'border-gray-600 group-hover/check:border-pink-400'}`}>
                                            {hasToGenerateVoice && <rux-icon icon="check" size="extra-small" className="text-black"></rux-icon>}
                                        </div>
                                        <span className="text-xs font-mono text-gray-300">VOICEOVER</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group/check">
                                        <input
                                            type="checkbox"
                                            checked={hasToSearchMedia}
                                            onChange={(e) => setHasToSearchMedia(e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hasToSearchMedia ? 'bg-pink-500 border-pink-500' : 'border-gray-600 group-hover/check:border-pink-400'}`}>
                                            {hasToSearchMedia && <rux-icon icon="check" size="extra-small" className="text-black"></rux-icon>}
                                        </div>
                                        <span className="text-xs font-mono text-gray-300">AUTO MEDIA</span>
                                    </label>
                                </div>

                                <div className="pt-4 flex gap-3 border-t border-gray-800">
                                    <button
                                        onClick={handleRender}
                                        disabled={renderLoading || !hasRevidSupport}
                                        className="btn-primary flex-1 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <rux-icon icon="play-arrow" size="small"></rux-icon>
                                        {renderLoading ? 'RENDERING...' : 'INITIATE RENDER'}
                                    </button>
                                    <button
                                        onClick={handleEstimateCredits}
                                        disabled={estimateLoading || !hasRevidSupport}
                                        className="px-4 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-mono text-xs uppercase tracking-wider disabled:opacity-50"
                                    >
                                        {estimateLoading ? '...' : 'ESTIMATE'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Advanced Settings */}
                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gray-600 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="section-label">Resolution</label>
                                    <select
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value as any)}
                                        className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs appearance-none"
                                    >
                                        <option value="1080p">1080p</option>
                                        <option value="720p">720p</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="section-label">Frame Rate</label>
                                    <input
                                        type="number"
                                        value={frameRate}
                                        onChange={(e) => setFrameRate(Number(e.target.value) || 30)}
                                        className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                        placeholder="30"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Project Telemetry */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase mb-2">
                            <rux-icon icon="analytics" size="extra-small"></rux-icon>
                            Project Telemetry
                        </div>

                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="section-label">Project PID</label>
                                        <input
                                            type="text"
                                            value={pid}
                                            onChange={(e) => setPid(e.target.value)}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="Enter PID..."
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={handleGetStatus}
                                            disabled={statusLoading || !hasRevidSupport}
                                            className="btn-secondary px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider h-[34px] flex items-center gap-2"
                                        >
                                            <rux-icon icon="refresh" size="extra-small"></rux-icon>
                                            STATUS
                                        </button>
                                    </div>
                                </div>

                                {statusResult && (
                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-[10px] text-gray-400 border border-gray-800 max-h-48 overflow-y-auto custom-scrollbar">
                                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(statusResult, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel p-0 rounded-xl relative overflow-hidden group flex flex-col min-h-[400px]">
                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                            <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                <span className="text-xs font-mono text-gray-400">RECENT PROJECTS</span>
                                <button
                                    onClick={handleListProjects}
                                    disabled={projectsLoading}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <rux-icon icon="refresh" size="small" className={projectsLoading ? "animate-spin" : ""}></rux-icon>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                                {projects && projects.length > 0 ? (
                                    <table className="w-full text-left text-[10px] font-mono">
                                        <thead className="bg-black/20 text-gray-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-2">PID</th>
                                                <th className="px-4 py-2">Status</th>
                                                <th className="px-4 py-2 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {projects.map((project, idx) => {
                                                const meta = resolveProjectMeta(project);
                                                return (
                                                    <tr key={meta.pid || idx} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-2 text-gray-300 truncate max-w-[100px]" title={meta.pid}>
                                                            {meta.pid || '—'}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <span className={`px-1.5 py-0.5 rounded-full ${meta.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                                                                    meta.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                                                                        'bg-blue-900/30 text-blue-400'
                                                                }`}>
                                                                {meta.status || 'UNKNOWN'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-right flex justify-end gap-2">
                                                            {meta.videoUrl && (
                                                                <a
                                                                    href={meta.videoUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-blue-400 hover:text-blue-300"
                                                                    title="Open Video"
                                                                >
                                                                    <rux-icon icon="open-in-new" size="extra-small"></rux-icon>
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => meta.pid && setPid(meta.pid)}
                                                                className="text-gray-500 hover:text-white"
                                                                title="Use PID"
                                                            >
                                                                <rux-icon icon="content-copy" size="extra-small"></rux-icon>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 p-8">
                                        <rux-icon icon="folder-open" size="large" className="mb-2"></rux-icon>
                                        <p className="text-xs font-mono">NO PROJECTS FOUND</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Console Output */}
                        {(estimateResult || renderResult || error) && (
                            <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-60"></div>
                                <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">System Output</div>
                                <div className="bg-black/40 rounded-lg p-3 font-mono text-[10px] text-gray-300 border border-gray-800 max-h-32 overflow-y-auto custom-scrollbar">
                                    {error && <div className="text-red-400 mb-2">ERROR: {error}</div>}
                                    {estimateResult && (
                                        <div className="mb-2">
                                            <div className="text-green-400 mb-1">ESTIMATE:</div>
                                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(estimateResult, null, 2)}</pre>
                                        </div>
                                    )}
                                    {renderResult && (
                                        <div>
                                            <div className="text-pink-400 mb-1">RENDER INITIATED:</div>
                                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(renderResult, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default Revid;
