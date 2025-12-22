import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HandCard } from '../../contexts/HandContext';
import type { CardPose } from '../../contexts/DragCanvasContext';

type AttachedHandCardDetailsProps = {
  card: HandCard | null;
  anchorRect: DOMRect | null;
  isInFormation: boolean;
  pose: CardPose;
  setPose: (next: Partial<CardPose>) => void;
  onClose: () => void;
  onReturnToHand: () => void;
  onReturnToLibrary: () => void;
  onEnterFormation: () => void;
  onLeaveFormation: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">{label}</div>
        <div className="text-[10px] font-mono text-cyan-200 tabular-nums">{Math.round(value)}</div>
      </div>
      <label className="sr-only">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
};

export const AttachedHandCardDetails: React.FC<AttachedHandCardDetailsProps> = ({
  card,
  anchorRect,
  isInFormation,
  pose,
  setPose,
  onClose,
  onReturnToHand,
  onReturnToLibrary,
  onEnterFormation,
  onLeaveFormation,
}) => {
  const [confirmReturnLibrary, setConfirmReturnLibrary] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfirmReturnLibrary(false);
  }, [card?.cardId]);

  useEffect(() => {
    if (!card) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [card, onClose]);

  useEffect(() => {
    if (!card) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [card, onClose]);

  const panelPos = useMemo(() => {
    if (!anchorRect) return null;

    const gap = 14;
    const width = 300;
    const height = 392;

    const preferredLeft = anchorRect.left - gap - width;
    const preferredTop = anchorRect.top - 14;

    const left = clamp(preferredLeft, 10, window.innerWidth - width - 10);
    const top = clamp(preferredTop, 70, window.innerHeight - height - 10);

    return { left, top, width, height };
  }, [anchorRect]);

  if (!card || !panelPos) return null;

  const metadata = (card as any).metadata || {};
  const skills = (card as any).skills || metadata.skills || [];
  const desires = (card as any).desires || metadata.desires || 'Awaiting purpose...';
  const truths = (card as any).truths || metadata.truths || [];
  const lore = (card as any).lore || metadata.lore || (card as any).description || metadata.description || '';

  const formattedSkills = (skills || []).map((s: any) => (typeof s === 'string' ? s : s?.name || 'Unknown Skill'));

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100010] pointer-events-auto"
      style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width }}
    >
      <div className="relative rounded-xl border border-cyan-500/20 bg-gradient-to-b from-gray-950/75 to-gray-950/50 shadow-[0_0_30px_rgba(34,211,238,0.10)] backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/6 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        </div>

        <div className="relative px-3 py-2 border-b border-cyan-500/15 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Card Details</div>
            <div className="text-sm font-mono font-semibold text-white truncate">{card.name || 'UNNAMED CARD'}</div>
          </div>

          <button
            onClick={onClose}
            className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
          >
            Close
          </button>
        </div>

        <div className="relative p-3 space-y-3">
          <div className="flex gap-3">
            <div className="w-20 h-28 rounded-lg overflow-hidden border border-gray-700/60 bg-gray-900/40 flex-shrink-0">
              {card.thumbnail ? (
                <img src={card.thumbnail} alt={card.name || 'Card'} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded border border-gray-600 bg-gray-800/40" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={onReturnToHand}
                  className="flex-1 px-2 py-[6px] rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 hover:bg-cyan-500/15"
                >
                  Return Hand
                </button>

                <button
                  onClick={() => setConfirmReturnLibrary(true)}
                  className="flex-1 px-2 py-[6px] rounded-lg border border-amber-500/25 bg-amber-500/10 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-500/15"
                >
                  Return Library
                </button>
              </div>

              {confirmReturnLibrary ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                  <div className="text-[10px] font-mono text-amber-200 flex-1">Return to library?</div>
                  <button
                    onClick={() => setConfirmReturnLibrary(false)}
                    className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onReturnToLibrary}
                    className="px-2 py-1 rounded-md border border-amber-400/35 bg-amber-500/15 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-500/20"
                  >
                    Confirm
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                {isInFormation ? (
                  <button
                    onClick={onLeaveFormation}
                    className="flex-1 px-2 py-[6px] rounded-lg border border-red-500/25 bg-red-500/10 text-[10px] font-bold uppercase tracking-[0.22em] text-red-100 hover:bg-red-500/15"
                  >
                    Leave Formation
                  </button>
                ) : (
                  <button
                    onClick={onEnterFormation}
                    className="flex-1 px-2 py-[6px] rounded-lg border border-blue-500/25 bg-blue-500/10 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100 hover:bg-blue-500/15"
                  >
                    Enter Formation
                  </button>
                )}

                <button
                  onClick={() => setPose({ cameraMode: !pose.cameraMode })}
                  className={`flex-1 px-2 py-[6px] rounded-lg border text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-gray-800/60 ${pose.cameraMode ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-gray-700/60 bg-gray-900/30 text-gray-300'}`}
                >
                  Camera
                </button>
              </div>
            </div>
          </div>

          {lore ? (
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Lore</div>
              <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{String(lore)}</div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Pose</div>
                <button
                  onClick={() => setPose({ tiltX: 0, tiltY: 0, rotZ: 0, zoom: 1 })}
                  className="px-2 py-1 rounded-md border border-gray-700/60 bg-gray-900/30 text-[9px] font-bold uppercase tracking-[0.22em] text-gray-300 hover:bg-gray-800/50"
                >
                  Reset
                </button>
              </div>

              <SliderRow label="Tilt X" value={pose.tiltX} min={-30} max={30} onChange={(v) => setPose({ tiltX: v })} />
              <SliderRow label="Tilt Y" value={pose.tiltY} min={-30} max={30} onChange={(v) => setPose({ tiltY: v })} />
              <SliderRow label="Rot Z" value={pose.rotZ} min={-180} max={180} onChange={(v) => setPose({ rotZ: v })} />
              <SliderRow label="Zoom" value={pose.zoom * 100} min={60} max={170} step={1} onChange={(v) => setPose({ zoom: v / 100 })} />
            </div>

            <div className="rounded-xl border border-gray-800/70 bg-gray-900/20 p-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Summary</div>

              {formattedSkills.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/70">Skills</div>
                  <div className="space-y-1">
                    {formattedSkills.slice(0, 4).map((skill: string, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
                        <span className="truncate">{skill}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-purple-400/70">Desires</div>
                <div className="text-xs text-gray-400 italic line-clamp-2">"{String(desires)}"</div>
              </div>

              {truths && truths.length > 0 ? (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/70">Truths</div>
                  <div className="text-xs text-gray-300 line-clamp-2">{String(truths[0] || '')}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
