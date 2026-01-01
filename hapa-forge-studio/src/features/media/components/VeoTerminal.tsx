import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Upload, Play, Film, Loader2, Maximize, RefreshCw, AlertTriangle, Key, Cpu, Share2 } from 'lucide-react';
import { AspectRatio, VideoState } from '../types';
import { generateVeoVideo, blobToBase64, ensureApiKey, promptForApiKey } from '../services/geminiService';
import { getModelSettings } from '@/shared/genai/settings';
import { downloadDataUrl, downloadJson, copyToClipboard, HapaBundle } from '@/shared/export/hapaBundle';
import { getLibraryItem, listLibraryItems, upsertLibraryItem } from '@/shared/storage/library';
import {
  getBundleBestImageDataUrl,
  getBundlePreferredAspectRatio,
  getBundleSuggestedPrompt,
} from '@/shared/export/selectors';
import { useLocation } from 'react-router-dom';

const VeoTerminal: React.FC = () => {
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);

  const [lastBundle, setLastBundle] = useState<HapaBundle | null>(null);

  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);

  // User-facing warning/notice for preload errors (handoff or deep link).
  const [preloadWarning, setPreloadWarning] = useState<string | null>(null);
  
  const [videoState, setVideoState] = useState<VideoState>({
    isGenerating: false,
    progressMessage: '',
    videoUrl: null,
    error: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [head, b64] = dataUrl.split(',');
    const mimeMatch = head.match(/data:(.*?);base64/);
    const mime = mimeMatch?.[1] || 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  };

  // Phase 2/3: preload from sessionStorage handoff OR deep link (?libraryItemId=...)
  // Precedence: sessionStorage handoff > query param libraryItemId > manual selection
  useEffect(() => {
    const HANDOFF_KEY = 'hapa_forge_media_handoff_v1';
    const params = new URLSearchParams(location.search);

    // Reset any previous preload-only notice when the URL changes.
    setPreloadWarning(null);

    let appliedPreload = false;

    const applyPreload = (args: {
      imageDataUrl: string;
      filename: string;
      prompt: string;
      aspectRatio: '16:9' | '9:16';
    }) => {
      const file = dataUrlToFile(args.imageDataUrl, args.filename);
      setSelectedFile(file);
      setPreviewUrl(args.imageDataUrl);
      setPrompt(args.prompt || '');
      setAspectRatio(args.aspectRatio === '9:16' ? AspectRatio.PORTRAIT : AspectRatio.LANDSCAPE);
      setLastBundle(null);
      setPreloadWarning(null);
      setVideoState((prev) => ({ ...prev, videoUrl: null, error: null }));
      appliedPreload = true;
    };

    // 1) SessionStorage handoff (Character → Media, or Library fast-path)
    const rawHandoff = sessionStorage.getItem(HANDOFF_KEY);
    const shouldTryHandoff = params.get('handoff') === '1' || !!rawHandoff;

    if (shouldTryHandoff && rawHandoff) {
      try {
        const payload = JSON.parse(rawHandoff) as {
          imageDataUrl?: string;
          prompt?: string;
          aspectRatio?: '16:9' | '9:16';
        };

        if (!payload?.imageDataUrl || !payload.imageDataUrl.startsWith('data:')) {
          throw new Error('Handoff payload missing imageDataUrl');
        }

        applyPreload({
          imageDataUrl: payload.imageDataUrl,
          filename: `handoff_${Date.now()}.png`,
          prompt: payload.prompt || '',
          aspectRatio: payload.aspectRatio === '9:16' ? '9:16' : '16:9',
        });
      } catch (e: any) {
        console.warn('Failed to apply media handoff payload', e);
        setVideoState((prev) => ({
          ...prev,
          error:
            'Failed to load handoff payload. Please try again or select an image manually.',
        }));
      } finally {
        sessionStorage.removeItem(HANDOFF_KEY);
      }
    }

    // 2) Deep link preload via libraryItemId (shareable within the same browser profile)
    if (!appliedPreload) {
      const libraryItemId = params.get('libraryItemId');
      const use = params.get('use');
      if (libraryItemId && (!use || use === 'image')) {
        const item = getLibraryItem(libraryItemId);
        if (!item) {
          setPreloadWarning(`No library item found for id: ${libraryItemId}`);
          return;
        }

        const imageDataUrl = getBundleBestImageDataUrl(item.bundle);
        if (!imageDataUrl) {
          setPreloadWarning('No image asset available in this bundle.');
          return;
        }

        const promptFromBundle = getBundleSuggestedPrompt(item.bundle) || '';
        const ar = getBundlePreferredAspectRatio(item.bundle);
        applyPreload({
          imageDataUrl,
          filename: `${item.title.replace(/\s+/g, '_') || 'library'}.png`,
          prompt: promptFromBundle,
          aspectRatio: ar,
        });
      }
    }
  }, [location.search]);

  const libraryImages = useMemo(() => {
    const items = listLibraryItems();
    const images: Array<{ id: string; title: string; kind: string; dataUrl: string; mimeType?: string }> = [];
    for (const item of items) {
      for (const asset of item.bundle.assets || []) {
        if (asset.type === 'image' && asset.dataUrl) {
          images.push({
            id: `${item.id}:${asset.id}`,
            title: item.title,
            kind: item.kind,
            dataUrl: asset.dataUrl,
            mimeType: asset.mimeType,
          });
        }
      }
    }
    return images;
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setLastBundle(null);
      setPreloadWarning(null);
      setVideoState(prev => ({ ...prev, videoUrl: null, error: null }));
    }
  };

  const handlePickFromLibrary = (dataUrl: string, title: string) => {
    const file = dataUrlToFile(dataUrl, `${title.replace(/\s+/g, '_')}.png`);
    setSelectedFile(file);
    setPreviewUrl(dataUrl);
    setIsLibraryPickerOpen(false);
    setLastBundle(null);
    setPreloadWarning(null);
    setVideoState(prev => ({ ...prev, videoUrl: null, error: null }));
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    const stepStartedAt = Date.now();

    // Billing check
    const hasKey = await ensureApiKey();
    if (!hasKey) {
      setVideoState(prev => ({ ...prev, error: "API Key required. Open Settings and paste your Gemini API key." }));
      return;
    }

    setVideoState({
      isGenerating: true,
      progressMessage: 'Initializing upload stream...',
      videoUrl: null,
      error: null,
    });

    try {
      setLastBundle(null);
      const base64Data = await blobToBase64(selectedFile);
      const sourceDataUrl = `data:${selectedFile.type};base64,${base64Data}`;
      
      const videoUrl = await generateVeoVideo(
        base64Data,
        prompt,
        aspectRatio,
        selectedFile.type,
        (msg) => setVideoState(prev => ({ ...prev, progressMessage: msg }))
      );

      const stepEndedAt = Date.now();
      const { videoModel } = getModelSettings();
      const bundle: HapaBundle = {
        version: '1.0',
        kind: 'media',
        createdAt: stepEndedAt,
        inputs: {
          prompt,
          aspectRatio,
          sourceMimeType: selectedFile.type,
        },
        steps: [
          {
            id: 'media.generateVideo',
            name: 'Generate Animated Video',
            model: videoModel,
            prompt,
            status: 'success',
            startedAt: stepStartedAt,
            endedAt: stepEndedAt,
            output: { videoUrl },
          },
        ],
        assets: [
          {
            id: 'source.image',
            type: 'image',
            mimeType: selectedFile.type,
            dataUrl: sourceDataUrl,
            name: 'source.png',
          },
          {
            id: 'output.video',
            type: 'video',
            url: videoUrl,
            name: 'veo.mp4',
          },
        ],
        outputs: { videoUrl },
      };
      setLastBundle(bundle);

      setVideoState({
        isGenerating: false,
        progressMessage: 'Complete',
        videoUrl: videoUrl,
        error: null,
      });

    } catch (error: any) {
      const stepEndedAt = Date.now();
      const { videoModel } = getModelSettings();
      setLastBundle({
        version: '1.0',
        kind: 'media',
        createdAt: stepEndedAt,
        inputs: { prompt, aspectRatio, sourceMimeType: selectedFile.type },
        steps: [
          {
            id: 'media.generateVideo',
            name: 'Generate Animated Video',
            model: videoModel,
            prompt,
            status: 'error',
            startedAt: stepStartedAt,
            endedAt: stepEndedAt,
            output: { error: error?.message || String(error) },
          },
        ],
        assets: [],
        outputs: {},
      });
      setVideoState({
        isGenerating: false,
        progressMessage: '',
        videoUrl: null,
        error: error.message || 'Unknown error occurred',
      });
    }
  };

  const handleKeySelection = async () => {
      try {
          await promptForApiKey();
          // Clear error if it was a key error
          setVideoState(prev => ({...prev, error: null}));
      } catch (e) {
          console.error(e);
      }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 bg-black/40 flex items-center justify-between px-6 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
            <div className="flex flex-col">
                <h2 className="text-xl font-bold text-white tracking-widest flex items-center gap-2">
                    <Film className="text-hapa-blue" />
                    REVID PROTOCOL <span className="text-xs bg-hapa-blue/20 text-hapa-blue px-2 py-0.5 rounded border border-hapa-blue/30">VEO-3.1</span>
                </h2>
                <p className="text-[10px] text-gray-500 font-mono">LATENCY: 12ms // SECURE CONNECTION</p>
            </div>
        </div>
        
        <div className="flex items-center space-x-3">
             <button 
                onClick={handleKeySelection}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-xs hover:bg-yellow-500/20 transition-colors"
             >
                <Key size={12} />
                <span>API KEY</span>
             </button>
             <div className="h-8 w-px bg-gray-800 mx-2" />
             <div className="flex items-center space-x-2 text-xs text-gray-400 font-mono">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>SYSTEM ONLINE</span>
             </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 p-6 overflow-y-auto grid grid-cols-12 gap-6">
        
        {/* Left Control Panel */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            {/* Input Module */}
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-hapa-blue relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Upload className="text-hapa-blue" size={20} />
                </div>
                <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Source Material</h3>

                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setIsLibraryPickerOpen(true)}
                    className="px-3 py-1.5 rounded border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10"
                    type="button"
                  >
                    Use from Library
                  </button>
                  <div className="text-[10px] text-gray-500 font-mono">(Character portraits / ship art)</div>
                </div>
                
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        aspect-video rounded-lg border-2 border-dashed border-gray-700 bg-black/50 
                        flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                        hover:border-hapa-blue hover:bg-hapa-blue/5
                        ${previewUrl ? 'border-none p-0' : 'p-8'}
                    `}
                >
                    {previewUrl ? (
                        <div className="relative w-full h-full group/preview">
                            <img src={previewUrl} className="w-full h-full object-cover rounded-lg" alt="Preview" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-mono border border-white px-3 py-1 rounded">CHANGE SOURCE</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3 group-hover:bg-hapa-blue/20">
                                <Upload className="text-gray-400 group-hover:text-hapa-blue" size={20} />
                            </div>
                            <span className="text-xs text-gray-500 font-mono text-center">DROP IMAGE OR CLICK TO SCAN</span>
                        </>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>

                {libraryImages.length > 0 && (
                  <button
                    onClick={() => setIsLibraryPickerOpen(true)}
                    className="mt-3 w-full px-4 py-2 rounded border border-white/10 bg-white/5 text-slate-200 text-xs hover:bg-white/10 transition-colors"
                  >
                    USE FROM LIBRARY ({libraryImages.length})
                  </button>
                )}
            </div>

            {/* Library Picker Modal */}
            {isLibraryPickerOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl glass-panel border border-white/10 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="font-orbitron text-sm text-white">Pick an image from Library</div>
                    <button
                      onClick={() => setIsLibraryPickerOpen(false)}
                      className="text-xs text-slate-300 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-auto">
                    {libraryImages.length === 0 ? (
                      <div className="text-slate-300 text-sm">
                        No images found. Generate a character portrait or ship concept art, then save to Library.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {libraryImages.map((img) => (
                          <button
                            key={img.id}
                            className="text-left rounded-lg overflow-hidden border border-white/10 hover:border-white/20"
                            onClick={() => handlePickFromLibrary(img.dataUrl, img.title)}
                          >
                            <div className="h-28 bg-black/40">
                              <img src={img.dataUrl} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-2">
                              <div className="text-xs text-white truncate">{img.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{img.kind}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Config Module */}
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-hapa-purple">
                 <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Parameters</h3>
                 
                 <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Prompt Vector</label>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the desired motion (e.g., 'Make the camera pan right and the character breathe')"
                            className="w-full bg-black/50 border border-gray-700 rounded p-3 text-xs text-gray-300 focus:border-hapa-purple focus:outline-none resize-none h-24 font-mono"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Aspect Ratio</label>
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => setAspectRatio(AspectRatio.LANDSCAPE)}
                                className={`flex-1 py-2 text-xs border rounded transition-colors ${aspectRatio === AspectRatio.LANDSCAPE ? 'bg-hapa-purple/20 border-hapa-purple text-hapa-purple' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                            >
                                16:9 (Cinema)
                            </button>
                            <button 
                                onClick={() => setAspectRatio(AspectRatio.PORTRAIT)}
                                className={`flex-1 py-2 text-xs border rounded transition-colors ${aspectRatio === AspectRatio.PORTRAIT ? 'bg-hapa-purple/20 border-hapa-purple text-hapa-purple' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                            >
                                9:16 (Mobile)
                            </button>
                        </div>
                    </div>
                 </div>

                 <button 
                    onClick={handleGenerate}
                    disabled={!selectedFile || videoState.isGenerating}
                    className={`
                        mt-6 w-full py-3 rounded text-sm font-bold uppercase tracking-widest transition-all
                        flex items-center justify-center gap-2
                        ${!selectedFile || videoState.isGenerating 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-hapa-purple to-hapa-blue hover:shadow-[0_0_20px_rgba(189,0,255,0.4)] text-white'
                        }
                    `}
                 >
                    {videoState.isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            PROCESSING
                        </>
                    ) : (
                        <>
                            <Play size={16} fill="currentColor" />
                            INITIATE RENDER
                        </>
                    )}
                 </button>
            </div>
        </div>

        {/* Right Output Panel */}
        <div className="col-span-12 lg:col-span-8 flex flex-col">
            <div className="flex-1 glass-panel rounded-xl border border-gray-800 relative overflow-hidden flex flex-col">
                {/* Header for Viewport */}
                <div className="h-10 border-b border-gray-800 bg-black/40 flex items-center justify-between px-4">
                    <span className="text-[10px] text-hapa-blue font-mono uppercase">Viewport 01 // Veo Output</span>
                    <div className="flex space-x-2">
                         <div className="w-2 h-2 rounded-full bg-gray-700" />
                         <div className="w-2 h-2 rounded-full bg-gray-700" />
                    </div>
                </div>

                {/* Viewport Content */}
                <div className="flex-1 bg-black/80 relative flex items-center justify-center p-4">
                     {/* Background Grid */}
                     <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                     
                     {videoState.error && (
                        <div className="relative z-10 max-w-md p-6 bg-red-900/20 border border-red-500/50 rounded-lg text-center backdrop-blur-md">
                            <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
                            <h3 className="text-red-500 font-bold mb-1">SYSTEM ERROR</h3>
                            <p className="text-red-200 text-sm font-mono">{videoState.error}</p>
                            {videoState.error.includes("API Key") && (
                                <button onClick={handleKeySelection} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/50 rounded text-xs uppercase">
                                    Re-authenticate
                                </button>
                            )}
                        </div>
                     )}

                     {preloadWarning && !videoState.isGenerating && !videoState.videoUrl && !videoState.error && (
                       <div className="relative z-10 max-w-md p-6 bg-yellow-900/20 border border-yellow-500/50 rounded-lg text-center backdrop-blur-md">
                         <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                         <h3 className="text-yellow-500 font-bold mb-1">SYSTEM NOTICE</h3>
                         <p className="text-yellow-200 text-sm font-mono">{preloadWarning}</p>
                       </div>
                     )}

                     {videoState.isGenerating && (
                        <div className="relative z-10 text-center">
                             <div className="relative w-24 h-24 mx-auto mb-4">
                                <div className="absolute inset-0 rounded-full border-t-2 border-hapa-blue animate-spin" />
                                <div className="absolute inset-2 rounded-full border-r-2 border-hapa-purple animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Cpu className="text-white/50 animate-pulse" />
                                </div>
                             </div>
                             <p className="text-hapa-blue font-mono text-sm animate-pulse">{videoState.progressMessage}</p>
                             <p className="text-gray-600 text-[10px] mt-2 font-mono">ALLOCATING GPU RESOURCES...</p>
                        </div>
                     )}

                     {!videoState.isGenerating && videoState.videoUrl && (
                        <div className="relative z-10 w-full h-full flex flex-col">
                             <div className="flex-1 relative rounded overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-gray-800 group">
                                <video 
                                    src={videoState.videoUrl} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="w-full h-full object-contain bg-black"
                                />
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 bg-black/60 rounded text-white hover:bg-hapa-blue hover:text-black transition-colors">
                                        <Maximize size={16} />
                                    </button>
                                </div>
                             </div>
                             
                             <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <button
                                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded flex items-center gap-2 border border-gray-700 transition-colors"
                                  onClick={async () => {
                                    await copyToClipboard(videoState.videoUrl!);
                                    alert('Video link copied to clipboard.');
                                  }}
                                >
                                  <Share2 size={14} /> COPY VIDEO LINK
                                </button>

                                <button
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs text-slate-200 rounded border border-white/10 transition-colors"
                                  onClick={() => {
                                    const bundle = lastBundle;
                                    if (!bundle) return;
                                    downloadJson(bundle, `media_${Date.now()}.hapa.bundle.json`);
                                  }}
                                >
                                  Download JSON
                                </button>

                                <button
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs text-slate-200 rounded border border-white/10 transition-colors"
                                  onClick={async () => {
                                    const bundle = lastBundle;
                                    if (!bundle) return;
                                    const img = bundle.assets.find((a) => a.type === 'image' && a.dataUrl)?.dataUrl;
                                    if (img) await downloadDataUrl(img, `source_${Date.now()}.png`);
                                    downloadJson(bundle, `media_${Date.now()}.hapa.bundle.json`);
                                  }}
                                >
                                  Export All
                                </button>

                                <button
                                  className="px-4 py-2 bg-hapa-blue/20 hover:bg-hapa-blue/30 text-xs text-hapa-blue rounded border border-hapa-blue/30 transition-colors"
                                  onClick={() => {
                                    const bundle = lastBundle;
                                    if (!bundle) return;
                                    const thumb = bundle.assets.find((a) => a.type === 'image' && a.dataUrl)?.dataUrl;
                                    upsertLibraryItem({
                                      id: crypto.randomUUID(),
                                      kind: 'media',
                                      title: `Media ${new Date(bundle.createdAt).toLocaleString()}`,
                                      createdAt: bundle.createdAt,
                                      thumbnailDataUrl: thumb,
                                      bundle,
                                    });
                                    alert('Saved to Library.');
                                  }}
                                >
                                  Save to Library
                                </button>
                             </div>
                        </div>
                     )}

                     {!videoState.isGenerating && !videoState.videoUrl && !videoState.error && (
                        <div className="text-center opacity-30">
                            <Film size={48} className="mx-auto mb-2" />
                            <p className="font-mono text-sm">WAITING FOR INPUT STREAM</p>
                        </div>
                     )}
                </div>
            </div>
            
            {/* Log / Terminal Output (Cosmetic) */}
            <div className="h-32 mt-6 glass-panel rounded-xl border border-gray-800 p-4 font-mono text-[10px] text-green-500/70 overflow-hidden relative">
                <div className="absolute top-2 right-2 px-1 border border-green-900 text-green-700 rounded">SYS.LOG</div>
                <div className="space-y-1">
                    <p>[SYSTEM] Veo-3.1 Core loaded.</p>
                    <p>[SYSTEM] Connected to node: us-central-1.</p>
                    <p>[MEMORY] Heap aligned. 4096TB available.</p>
	                    {videoState.isGenerating && (
	                      <p className="text-hapa-blue animate-pulse">{'> '}Processing request... {videoState.progressMessage}</p>
	                    )}
	                    {videoState.videoUrl && (
	                      <p className="text-hapa-purple">{'> '}Generation successful. Asset cached.</p>
	                    )}
                </div>
                {/* Scanline */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px] pointer-events-none" />
            </div>
        </div>
      </div>
    </div>
  );
};

export default VeoTerminal;