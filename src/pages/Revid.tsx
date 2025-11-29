import React, { useEffect, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/Button';

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
        <div className="p-8 max-w-5xl mx-auto w-full">
            <h2 className="text-3xl font-bold mb-6">Revid.ai</h2>

            {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

            {!hasRevidSupport && (
                <p className="text-sm text-gray-300 mb-6">
                    Revid integration is not available. Make sure you are running the Electron app and have updated
                    settings.
                </p>
            )}

            <div className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                    <h3 className="text-xl font-semibold mb-2 text-pink-300">Text to video</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Input text or URL
                            </label>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="w-full h-24 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-pink-500 transition-colors text-sm"
                                placeholder="Describe the video you want or paste a URL to scrape"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Media type</label>
                                <select
                                    value={mediaType}
                                    onChange={(e) => setMediaType(e.target.value as any)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    aria-label="Select Revid media type"
                                    title="Select Revid media type"
                                >
                                    <option value="stockVideo">Stock video</option>
                                    <option value="movingImage">AI images (animated)</option>
                                    <option value="aiVideo">AI video</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Caption style</label>
                                <select
                                    value={captionPresetName}
                                    onChange={(e) => setCaptionPresetName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    aria-label="Select caption style"
                                    title="Select caption style"
                                >
                                    <option>Basic</option>
                                    <option>Revid</option>
                                    <option>Hormozi</option>
                                    <option>Ali</option>
                                    <option>Wrap 1</option>
                                    <option>Wrap 2</option>
                                    <option>Faceless</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Aspect ratio</label>
                                <select
                                    value={ratio}
                                    onChange={(e) => setRatio(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    aria-label="Select aspect ratio"
                                    title="Select aspect ratio"
                                >
                                    <option value="9 / 16">9:16 (vertical)</option>
                                    <option value="16 / 9">16:9 (landscape)</option>
                                    <option value="1 / 1">1:1 (square)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Style preset</label>
                                <input
                                    type="text"
                                    value={generationPreset}
                                    onChange={(e) => setGenerationPreset(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    placeholder="DEFAULT, REALISM, ANIME, ..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">
                                    Style prompt (optional)
                                </label>
                                <input
                                    type="text"
                                    value={generationUserPrompt}
                                    onChange={(e) => setGenerationUserPrompt(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    placeholder="e.g. cyberpunk city at night"
                                />
                            </div>
                            <div className="flex items-center gap-4 mt-5 md:mt-0">
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={hasEnhancedGeneration}
                                        onChange={(e) => setHasEnhancedGeneration(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-pink-500"
                                    />
                                    Enhanced quality
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={hasToGenerateVoice}
                                        onChange={(e) => setHasToGenerateVoice(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-pink-500"
                                    />
                                    Generate voiceover
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={hasToSearchMedia}
                                        onChange={(e) => setHasToSearchMedia(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-pink-500"
                                    />
                                    Auto media
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Resolution</label>
                                <select
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value as any)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    aria-label="Select output resolution"
                                    title="Select output resolution"
                                >
                                    <option value="1080p">1080p</option>
                                    <option value="720p">720p (faster)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Compression</label>
                                <input
                                    type="number"
                                    value={compression}
                                    onChange={(e) => setCompression(Number(e.target.value) || 18)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    placeholder="18"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Frame rate</label>
                                <input
                                    type="number"
                                    value={frameRate}
                                    onChange={(e) => setFrameRate(Number(e.target.value) || 30)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    placeholder="30 or 60"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Webhook URL</label>
                                <input
                                    type="text"
                                    value={webhook}
                                    onChange={(e) => setWebhook(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                    placeholder="Optional: receive completion events on your backend"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <PrimaryButton
                            type="button"
                            onClick={handleEstimateCredits}
                            disabled={estimateLoading || !hasRevidSupport}
                            tone="purple"
                        >
                            {estimateLoading ? 'Estimating credits...' : 'Estimate credits'}
                        </PrimaryButton>
                        <PrimaryButton
                            type="button"
                            onClick={handleRender}
                            disabled={renderLoading || !hasRevidSupport}
                            tone="pink"
                        >
                            {renderLoading ? 'Creating video...' : 'Create video'}
                        </PrimaryButton>
                        {estimateResult && (
                            <span className="text-xs text-gray-300">
                                Estimate response received (see below).
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                    <h3 className="text-xl font-semibold mb-2 text-blue-300">Project status</h3>
                    <div className="flex flex-col md:flex-row md:items-end gap-3 text-sm">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-300 mb-1">Project PID</label>
                            <input
                                type="text"
                                value={pid}
                                onChange={(e) => setPid(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                                placeholder="Paste pid from render response or /projects"
                            />
                        </div>
                        <PrimaryButton
                            type="button"
                            onClick={handleGetStatus}
                            disabled={statusLoading || !hasRevidSupport}
                        >
                            {statusLoading ? 'Checking...' : 'Get status'}
                        </PrimaryButton>
                        <SecondaryButton
                            type="button"
                            onClick={handleListProjects}
                            disabled={projectsLoading || !hasRevidSupport}
                        >
                            {projectsLoading ? 'Loading projects...' : 'List recent projects'}
                        </SecondaryButton>
                    </div>
                    {statusResult && (
                        <div className="mt-3 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-64 overflow-auto">
                            <div className="font-semibold mb-1">Status response</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(statusResult, null, 2)}</pre>
                        </div>
                    )}
                    {projects && projects.length > 0 && (
                        <div className="mt-3 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-64 overflow-auto">
                            <div className="font-semibold mb-2">Recent projects</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="text-gray-400 border-b border-gray-700">
                                            <th className="py-1 pr-3">PID</th>
                                            <th className="py-1 pr-3">Status</th>
                                            <th className="py-1 pr-3">Created</th>
                                            <th className="py-1 pr-3">Video</th>
                                            <th className="py-1 pr-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projects.map((project, idx) => {
                                            const meta = resolveProjectMeta(project);
                                            return (
                                                <tr
                                                    key={meta.pid || idx}
                                                    className="border-b border-gray-800 last:border-0"
                                                >
                                                    <td className="py-1 pr-3 max-w-[140px] truncate text-gray-100">
                                                        {meta.pid || '—'}
                                                    </td>
                                                    <td className="py-1 pr-3 max-w-[100px] truncate text-gray-300">
                                                        {meta.status || '—'}
                                                    </td>
                                                    <td className="py-1 pr-3 max-w-[160px] truncate text-gray-400">
                                                        {meta.createdAt || '—'}
                                                    </td>
                                                    <td className="py-1 pr-3 max-w-[160px] truncate text-blue-300">
                                                        {meta.videoUrl ? (
                                                            <a
                                                                href={meta.videoUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="hover:underline"
                                                                title={meta.videoUrl}
                                                            >
                                                                Open
                                                            </a>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td className="py-1 pr-0 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => meta.pid && setPid(meta.pid)}
                                                            disabled={!meta.pid}
                                                            className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 text-[11px] text-gray-100"
                                                            title="Use this PID for status checks"
                                                        >
                                                            Use PID
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {projects && projects.length === 0 && (
                        <p className="mt-2 text-xs text-gray-400">No projects returned.</p>
                    )}
                    {estimateResult && (
                        <div className="mt-3 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-64 overflow-auto">
                            <div className="font-semibold mb-1">Credit estimate</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(estimateResult, null, 2)}</pre>
                        </div>
                    )}
                    {renderResult && (
                        <div className="mt-3 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-64 overflow-auto">
                            <div className="font-semibold mb-1">Render response</div>
                            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(renderResult, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Revid;
