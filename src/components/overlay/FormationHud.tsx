import React from 'react';
import type { OverlayLayoutState, OverlayFormationMode } from '../../contexts/DragCanvasContext';

type FormationHudProps = {
  overlayLayout: OverlayLayoutState;
  setOverlayLayout: React.Dispatch<React.SetStateAction<OverlayLayoutState>>;
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  zOffsets: Record<string, number>;
  setZOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  itemCount: number;
  onRecenter: () => void;
};

const MODE_ORDER: Array<{ mode: OverlayFormationMode; label: string }> = [
  { mode: 'free', label: 'FREE' },
  { mode: 'fan', label: 'FAN' },
  { mode: 'line', label: 'LINE' },
  { mode: 'stack', label: 'STACK' },
  { mode: 'arc', label: 'ARC' },
  { mode: 'ring', label: 'RING' },
];

const ModeButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
  variant?: 'mode' | 'toggle' | 'tool' | 'color';
}> = ({ active, label, onClick, variant = 'mode' }) => {
  const base =
    'px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.18em] transition-all select-none';

  const palette = (() => {
    if (variant === 'color') {
      return active
        ? 'bg-red-600 text-white border-red-400'
        : 'bg-cyan-600 text-white border-cyan-400';
    }

    if (variant === 'toggle') {
      return active
        ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40'
        : 'bg-gray-800/40 text-gray-300 border-gray-700 hover:bg-gray-800/70';
    }

    if (variant === 'tool') {
      return active
        ? 'bg-gray-800/70 text-gray-100 border-gray-600'
        : 'bg-gray-800/40 text-gray-300 border-gray-700 hover:bg-gray-800/70';
    }

    // mode
    return active
      ? 'bg-blue-600 text-white border-blue-400'
      : 'bg-gray-800/40 text-gray-300 border-gray-700 hover:bg-gray-800/70';
  })();

  return (
    <button onClick={onClick} className={`${base} ${palette}`}>
      {label}
    </button>
  );
};

export const FormationHud: React.FC<FormationHudProps> = ({
  overlayLayout,
  setOverlayLayout,
  selectedItemId,
  setSelectedItemId,
  zOffsets,
  setZOffsets,
  itemCount,
  onRecenter,
}) => {
  const selectedZ = selectedItemId ? Math.round(zOffsets[selectedItemId] ?? 0) : 0;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100000] pointer-events-auto">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-950/60 border border-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.12)] backdrop-blur-md">
        <ModeButton
          variant="toggle"
          active={overlayLayout.hover}
          label="HOVER"
          onClick={() => setOverlayLayout((v) => ({ ...v, hover: !v.hover }))}
        />

        <div className="flex items-center rounded-lg border border-gray-800/70 bg-gray-900/30 overflow-hidden">
          {MODE_ORDER.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setOverlayLayout((v) => ({ ...v, mode }))}
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-all border-r border-gray-800/70 last:border-r-0 ${
                overlayLayout.mode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ModeButton
          variant="color"
          active={overlayLayout.portalColorMode === 'red'}
          label={overlayLayout.portalColorMode === 'red' ? 'RED' : 'BLUE'}
          onClick={() =>
            setOverlayLayout((v) => ({
              ...v,
              portalColorMode: v.portalColorMode === 'blue' ? 'red' : 'blue',
            }))
          }
        />

        <div className="w-px h-6 bg-gray-700/60 mx-1" />

        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
            N: <span className="text-cyan-200">{itemCount}</span>
            <span className="mx-2 text-gray-600">|</span>
            {selectedItemId ? (
              <>
                SEL: <span className="text-cyan-200">{selectedItemId.slice(0, 8)}</span>
                <span className="mx-2 text-gray-600">|</span>
                Z: <span className="text-cyan-200">{selectedZ}</span>
              </>
            ) : (
              <>
                SEL: <span className="text-gray-500">none</span>
              </>
            )}
          </div>

          <ModeButton variant="tool" active={false} label="RECENTER" onClick={onRecenter} />

          <ModeButton
            variant="tool"
            active={false}
            label="Z RESET"
            onClick={() => {
              if (!selectedItemId) return;
              setZOffsets((prev) => {
                const { [selectedItemId]: _removed, ...rest } = prev;
                return rest;
              });
            }}
          />

          <ModeButton
            variant="tool"
            active={false}
            label="CLEAR"
            onClick={() => setSelectedItemId(null)}
          />
        </div>
      </div>
    </div>
  );
};
