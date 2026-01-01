import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import demoArchive from '@/assets/mimi-phan-complete-archive-2025-12-28.md?raw';
import { usePipelineRunner } from '@/shared/pipeline/usePipelineRunner';
import { PipelineStep, StepRunRecord } from '@/shared/pipeline/types';
import { copyToClipboard, downloadDataUrl, downloadJson } from '@/shared/export/hapaBundle';
import { HapaBundle } from '@/shared/export/hapaBundle';
import { upsertLibraryItem } from '@/shared/storage/library';
import { CharacterAnalysis } from './types';
import {
  analyzeCharacterFromText,
  generateLore,
  generateAnimatedCardPrompt,
  generatePortraitPrompt,
  generatePortraitImage,
} from './services/characterGenai';
import { getApiKey, getModelSettings } from '@/shared/genai/settings';
import { generateVeoVideoFromDataUrl } from '@/shared/media/veo';

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const statusPill = (r: StepRunRecord) => {
  const base = 'text-[10px] font-mono px-2 py-1 rounded border';
  if (r.status === 'running') return <span className={`${base} bg-blue-500/10 text-blue-300 border-blue-500/20`}>RUNNING</span>;
  if (r.status === 'success') return <span className={`${base} bg-green-500/10 text-green-300 border-green-500/20`}>SUCCESS</span>;
  if (r.status === 'error') return <span className={`${base} bg-red-500/10 text-red-300 border-red-500/20`}>ERROR</span>;
  return <span className={`${base} bg-white/5 text-slate-300 border-white/10`}>IDLE</span>;
};

export default function CharacterStudioPage() {
  const navigate = useNavigate();

  // Inputs
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [profileText, setProfileText] = useState<string>('');
  const [skillsText, setSkillsText] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string>('character.analyze');

  const steps: PipelineStep[] = useMemo(() => {
    return [
      {
        id: 'character.analyze',
        name: 'Analyze Skills → RPG Stats + Archetype',
        description: 'Gemini JSON analysis: stats, archetype, key skills',
        run: async (ctx) => {
          const profile = ctx.inputs.profileText as string;
          const skills = ctx.inputs.skillsText as string | undefined;
          if (!profile || profile.trim().length < 20) {
            throw new Error('Add Character Profile Text (at least a few sentences).');
          }
          const { analysis, model, prompt } = await analyzeCharacterFromText({
            profileText: profile,
            skillsText: skills,
          });
          return { output: analysis, model, prompt };
        },
      },
      {
        id: 'character.lore',
        name: 'Generate Lore + Flavor Text',
        description: 'Short cinematic lore paragraph + quest hook',
        run: async (ctx) => {
          const analysis = ctx.outputs['character.analyze'] as CharacterAnalysis | undefined;
          if (!analysis) throw new Error('Run “Analyze Skills → RPG Stats + Archetype” first.');
          const profile = ctx.inputs.profileText as string;
          const { lore, model, prompt } = await generateLore({ profileText: profile, analysis });
          return { output: lore, model, prompt };
        },
      },
      {
        id: 'character.portraitPrompt',
        name: 'Generate Character Portrait Prompt',
        description: 'Gemini text prompt to feed the image model',
        run: async (ctx) => {
          const analysis = ctx.outputs['character.analyze'] as CharacterAnalysis | undefined;
          if (!analysis) throw new Error('Run “Analyze Skills → RPG Stats + Archetype” first.');
          const profile = ctx.inputs.profileText as string;
          const avatar = ctx.inputs.avatarDataUrl as string | undefined;
          const { portraitPrompt, model, prompt } = await generatePortraitPrompt({
            profileText: profile,
            analysis,
            avatarDataUrl: avatar,
          });
          return { output: portraitPrompt, model, prompt };
        },
      },
      {
        id: 'character.portraitImage',
        name: 'Generate Character Portrait Image',
        description: 'Gemini image generation (returns dataUrl)',
        run: async (ctx) => {
          const portraitPrompt = ctx.outputs['character.portraitPrompt'] as string | undefined;
          if (!portraitPrompt) throw new Error('Run “Generate Character Portrait Prompt” first.');
          const { dataUrl, model, prompt } = await generatePortraitImage({ portraitPrompt });
          return { output: dataUrl, model, prompt };
        },
      },
      {
        id: 'character.animatedPrompt',
        name: 'Generate Animated Card Prompt',
        description: 'Gemini text prompt suitable for Veo video generation',
        run: async (ctx) => {
          const analysis = ctx.outputs['character.analyze'] as CharacterAnalysis | undefined;
          if (!analysis) throw new Error('Run analysis first.');
          const lore = ctx.outputs['character.lore'] as string | undefined;
          const portraitPrompt = ctx.outputs['character.portraitPrompt'] as string | undefined;

          const { animatedPrompt, model, prompt } = await generateAnimatedCardPrompt({
            analysis,
            lore,
            portraitPrompt,
          });

          return { output: animatedPrompt, model, prompt };
        },
      },
      {
        id: 'character.animatedVideo',
        name: 'Generate Animated Card Video',
        description: 'Veo video generation (uses portrait image + animated prompt)',
        run: async (ctx) => {
          const portraitDataUrl = ctx.outputs['character.portraitImage'] as string | undefined;
          if (!portraitDataUrl) throw new Error('Run “Generate Character Portrait Image” first.');

          const animatedPrompt = ctx.outputs['character.animatedPrompt'] as string | undefined;
          if (!animatedPrompt || animatedPrompt.trim().length === 0) {
            throw new Error('Run “Generate Animated Card Prompt” first.');
          }

          if (!getApiKey()) {
            throw new Error('API key required. Open /settings and paste your Gemini API key.');
          }

          const videoUrl = await generateVeoVideoFromDataUrl({
            imageDataUrl: portraitDataUrl,
            prompt: animatedPrompt,
            aspectRatio: '9:16',
          });

          const { videoModel } = getModelSettings();
          return { output: videoUrl, model: videoModel, prompt: animatedPrompt };
        },
      },
      {
        id: 'character.export',
        name: 'Build Hapa Bundle Export',
        description: 'Create structured export JSON (no AI)',
        run: async (ctx) => {
          const analysis = ctx.outputs['character.analyze'] as CharacterAnalysis | undefined;
          if (!analysis) throw new Error('Run analysis first.');

          const portraitDataUrl = ctx.outputs['character.portraitImage'] as string | undefined;
          const lore = ctx.outputs['character.lore'] as string | undefined;
          const animatedPrompt = ctx.outputs['character.animatedPrompt'] as string | undefined;
          const animatedVideoUrl = ctx.outputs['character.animatedVideo'] as string | undefined;

          const bundle: HapaBundle = {
            version: '1.0',
            kind: 'character',
            createdAt: Date.now(),
            inputs: {
              avatarDataUrl: ctx.inputs.avatarDataUrl || null,
              profileText: ctx.inputs.profileText || '',
              skillsText: ctx.inputs.skillsText || '',
            },
            steps: Object.values(ctx.runsById)
              .filter((r) => r.id !== 'character.export')
              .filter((r) => r.status === 'success' || r.status === 'error')
              .map((r) => ({
                id: r.id,
                name: r.name,
                model: r.model,
                prompt: r.prompt,
                status: r.status === 'success' ? 'success' : 'error',
                startedAt: r.startedAt,
                endedAt: r.endedAt,
                output: r.status === 'success' ? r.output : { error: r.error },
              })),
            assets: [],
            outputs: {
              analysis,
              lore: lore || '',
              portraitPrompt: ctx.outputs['character.portraitPrompt'] || '',
              animatedPrompt: animatedPrompt || '',
              animatedVideoUrl: animatedVideoUrl || '',
            },
          };

          const avatar = ctx.inputs.avatarDataUrl as string | undefined;
          if (avatar) {
            bundle.assets.push({
              id: 'character.avatar',
              type: 'image',
              mimeType: avatar.split(';')[0].replace('data:', ''),
              dataUrl: avatar,
              name: 'avatar.png',
            });
          }

          if (portraitDataUrl) {
            bundle.assets.push({
              id: 'character.portrait',
              type: 'image',
              mimeType: portraitDataUrl.split(';')[0].replace('data:', ''),
              dataUrl: portraitDataUrl,
              name: 'character-portrait.png',
            });
          }

          if (animatedVideoUrl) {
            bundle.assets.push({
              id: 'character.animatedVideo',
              type: 'video',
              url: animatedVideoUrl,
              name: 'character-card.mp4',
            });
          }

          return { output: bundle };
        },
      },
    ];
  }, []);

  const pipeline = usePipelineRunner(steps, {
    inputs: { avatarDataUrl: avatarDataUrl || undefined, profileText, skillsText },
  });

  // Keep pipeline inputs in sync
  useEffect(() => {
    pipeline.setInput('avatarDataUrl', avatarDataUrl || undefined);
  }, [avatarDataUrl]);

  useEffect(() => {
    pipeline.setInput('profileText', profileText);
  }, [profileText]);

  useEffect(() => {
    pipeline.setInput('skillsText', skillsText);
  }, [skillsText]);

  const analysis = pipeline.outputs['character.analyze'] as CharacterAnalysis | undefined;
  const lore = pipeline.outputs['character.lore'] as string | undefined;
  const portraitPrompt = pipeline.outputs['character.portraitPrompt'] as string | undefined;
  const portraitDataUrl = pipeline.outputs['character.portraitImage'] as string | undefined;
  const animatedPrompt = pipeline.outputs['character.animatedPrompt'] as string | undefined;
  const animatedVideoUrl = pipeline.outputs['character.animatedVideo'] as string | undefined;
  const bundle = pipeline.outputs['character.export'] as HapaBundle | undefined;

  // Update iframe preview
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !frame.contentWindow) return;

    const profile = {
      name: analysis?.name || 'Unnamed',
      title: analysis?.title || '',
      className: analysis?.className || '',
      level: analysis?.level || 1,
      avatarDataUrl: avatarDataUrl || undefined,
      portraitDataUrl: portraitDataUrl || undefined,
      quote: analysis?.quote || (lore ? lore.split('\n')[0] : undefined),
    };

    frame.contentWindow.postMessage({ type: 'HAPA_FORGE_CHARACTER_UPDATE', profile }, '*');
  }, [analysis, lore, avatarDataUrl, portraitDataUrl]);

  const stepRecord = pipeline.runsById[selectedStepId];

  const runSelected = async () => {
    try {
      await pipeline.runStep(selectedStepId);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  };

  const onRunAll = async () => {
    try {
      await pipeline.runAll();
      setSelectedStepId('character.export');
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  };

  const onSaveToLibrary = () => {
    if (!bundle) {
      alert('Run “Build Hapa Bundle Export” first.');
      return;
    }

    const thumb = bundle.assets.find((a) => a.type === 'image' && a.dataUrl)?.dataUrl;
    upsertLibraryItem({
      id: crypto.randomUUID(),
      kind: 'character',
      title: analysis?.name || `Character ${new Date(bundle.createdAt).toLocaleString()}`,
      createdAt: bundle.createdAt,
      thumbnailDataUrl: thumb,
      bundle,
    });
    alert('Saved to Library.');
  };

  const onSendToMediaStudio = () => {
    if (!portraitDataUrl) return;

    const safeDefaultPrompt =
      animatedPrompt?.trim() ||
      'Slow cinematic push-in, subtle parallax, holographic UI shimmer, scanlines, floating stat glyphs, 5–8 seconds. Keep character identity consistent; no scene change.';

    const payload = {
      imageDataUrl: portraitDataUrl,
      prompt: safeDefaultPrompt,
      aspectRatio: '9:16' as const,
    };

    try {
      sessionStorage.setItem('hapa_forge_media_handoff_v1', JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to write media handoff payload', e);
    }

    navigate('/media?handoff=1');
  };

  return (
    <div className="h-full w-full flex">
      {/* Left rail: inputs + steps */}
      <div className="w-[380px] shrink-0 border-r border-white/10 bg-black/30 backdrop-blur overflow-auto">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-orbitron text-lg text-white">Character Studio</h1>
              <div className="text-xs text-slate-400 mt-1">
                Step-runner pipeline → export a Hapa Bundle.
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setProfileText(demoArchive);
                  setSkillsText('');
                }}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
              >
                Load Demo
              </button>
              <button
                onClick={onRunAll}
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-xs text-hapa-blue hover:bg-hapa-blue/30"
              >
                Run All
              </button>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="p-4 space-y-4">
          <div className="glass-panel rounded-xl p-4 border border-white/10">
            <div className="text-xs font-orbitron text-white">Avatar Image (optional)</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                {avatarDataUrl ? (
                  <img src={avatarDataUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[10px] text-slate-500 font-mono">none</div>
                )}
              </div>
              <label className="cursor-pointer px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const data = await fileToDataUrl(f);
                    setAvatarDataUrl(data);
                  }}
                />
              </label>
              {avatarDataUrl && (
                <button
                  onClick={() => setAvatarDataUrl(null)}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-xs font-orbitron text-white">Character Profile Text</div>
              <div className="text-[10px] text-slate-400 font-mono">{profileText.length} chars</div>
            </div>
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              className="mt-3 w-full h-36 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-white/20"
              placeholder="Paste biography / notes / markdown here"
            />
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-xs font-orbitron text-white">Technical Skills Document (optional)</div>
              <div className="text-[10px] text-slate-400 font-mono">{skillsText.length} chars</div>
            </div>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="mt-3 w-full h-28 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-white/20"
              placeholder="Optional: paste a skills-only section"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs font-orbitron text-white mb-3">Pipeline Steps</div>
          <div className="space-y-2">
            {steps.map((s) => {
              const r = pipeline.runsById[s.id];
              const selected = selectedStepId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStepId(s.id)}
                  className={
                    'w-full text-left p-3 rounded-xl border transition-colors ' +
                    (selected
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/10 hover:border-white/20')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-slate-400 mt-1">{s.description}</div>
                      )}
                    </div>
                    {statusPill(r)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={runSelected}
              className="flex-1 px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-xs text-hapa-blue hover:bg-hapa-blue/30"
            >
              Run Selected
            </button>
            <button
              onClick={() => {
                const target = 'character.export';
                setSelectedStepId(target);
                pipeline.runStep(target).catch((e: any) => alert(e?.message || String(e)));
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
            >
              Export
            </button>
          </div>

          <div className="mt-3">
            <button
              disabled={!portraitDataUrl}
              className={
                'w-full px-3 py-2 rounded-lg border text-xs transition-colors ' +
                (portraitDataUrl
                  ? 'bg-hapa-purple/20 border-hapa-purple/30 text-hapa-purple hover:bg-hapa-purple/30'
                  : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed')
              }
              onClick={onSendToMediaStudio}
            >
              Send to Media Studio
            </button>
            <div className="text-[10px] text-slate-500 mt-1">
              Preloads the portrait + suggested prompt in /media (does not auto-generate).
            </div>
          </div>

          {bundle && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => downloadJson(bundle, `${(analysis?.name || 'character').replace(/\s+/g, '_')}.hapa.bundle.json`)}
              >
                Download JSON
              </button>
              {portraitDataUrl && (
                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
                  onClick={() => downloadDataUrl(portraitDataUrl, `${(analysis?.name || 'character').replace(/\s+/g, '_')}.portrait.png`)}
                >
                  Download Image
                </button>
              )}

              {animatedVideoUrl && (
                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
                  onClick={async () => {
                    await copyToClipboard(animatedVideoUrl);
                    alert('Video link copied to clipboard.');
                  }}
                >
                  Copy video link
                </button>
              )}

              <button
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 hover:bg-white/10"
                onClick={async () => {
                  downloadJson(bundle, `${(analysis?.name || 'character').replace(/\s+/g, '_')}.hapa.bundle.json`);
                  if (portraitDataUrl) {
                    await downloadDataUrl(portraitDataUrl, `${(analysis?.name || 'character').replace(/\s+/g, '_')}.portrait.png`);
                  }
                }}
              >
                Export All
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-xs text-hapa-blue hover:bg-hapa-blue/30"
                onClick={onSaveToLibrary}
              >
                Save to Library
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: preview + outputs */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-orbitron text-sm text-white">Live Preview</div>
              <div className="text-xs text-slate-400">
                iframe: OKComputer RPG profile + generated portrait
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Models: {getModelSettings().textModel} / {getModelSettings().imageModel}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full grid grid-cols-1 lg:grid-cols-2">
            <div className="h-full border-r border-white/10 bg-black/10">
              <iframe
                ref={iframeRef}
                src="/okcomputer/rpg-index.html"
                className="w-full h-full"
                title="RPG Card Preview"
              />
            </div>

            <div className="h-full overflow-auto p-4 space-y-4">
              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-orbitron text-white">Generated Portrait</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Uses the Image model. If you provided an avatar, it’s used as a weak reference for the prompt.
                    </div>
                  </div>
                  {portraitDataUrl ? (
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-green-500/10 text-green-300 border border-green-500/20">READY</span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 text-slate-300 border border-white/10">PENDING</span>
                  )}
                </div>

                <div className="mt-3">
                  {portraitDataUrl ? (
                    <img src={portraitDataUrl} className="w-full max-w-sm rounded-xl border border-white/10" />
                  ) : avatarDataUrl ? (
                    <img src={avatarDataUrl} className="w-full max-w-sm rounded-xl border border-white/10 opacity-70" />
                  ) : (
                    <div className="text-xs text-slate-400">No image yet. Run portrait steps.</div>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-orbitron text-white">Selected Step Output</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {stepRecord?.name} • {stepRecord?.status}
                    </div>
                  </div>
                  {stepRecord ? statusPill(stepRecord) : null}
                </div>

                {stepRecord?.error && (
                  <div className="mt-3 text-xs font-mono text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {stepRecord.error}
                  </div>
                )}

                <pre className="mt-3 p-3 rounded-lg bg-black/50 border border-white/10 text-xs text-slate-200 overflow-auto">
                  {stepRecord?.output
                    ? typeof stepRecord.output === 'string'
                      ? stepRecord.output
                      : JSON.stringify(stepRecord.output, null, 2)
                    : '(no output yet)'}
                </pre>

                {selectedStepId === 'character.portraitPrompt' && portraitPrompt && (
                  <div className="mt-3 text-[10px] text-slate-400 font-mono">
                    Tip: you can edit the prompt text in your clipboard after export.
                  </div>
                )}
              </div>

              {analysis && (
                <div className="glass-panel rounded-xl border border-white/10 p-4">
                  <div className="text-xs font-orbitron text-white">Quick Summary</div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-200">
                    <div>
                      <div className="text-slate-400">Name</div>
                      <div className="text-white">{analysis.name}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Class</div>
                      <div className="text-white">{analysis.className}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Archetype</div>
                      <div className="text-white">{analysis.archetype}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Level</div>
                      <div className="text-white">{analysis.level}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
