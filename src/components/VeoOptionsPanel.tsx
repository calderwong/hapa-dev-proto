// @ts-nocheck
import React, { useState, useEffect } from 'react';
import ImageCardPicker from './ImageCardPicker';

export interface VeoOptions {
  imageMode: 'none' | 'start-frame' | 'start-end-frame' | 'loop';
  startFrameBase64?: string;
  startFrameMimeType?: string;
  startFrameName?: string;
  endFrameBase64?: string;
  endFrameMimeType?: string;
  endFrameName?: string;
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
  durationSeconds: '4' | '5' | '6' | '8';
  negativePrompt: string;
  personGeneration: 'allow_all' | 'allow_adult' | 'dont_allow';
}

interface VeoOptionsPanelProps {
  modelName: string;
  options: VeoOptions;
  onOptionsChange: (options: VeoOptions) => void;
  onClose: () => void;
}

const VeoOptionsPanel: React.FC<VeoOptionsPanelProps> = ({
  modelName,
  options,
  onOptionsChange,
  onClose,
}) => {
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null);
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState<'start' | 'end' | null>(null);

  // Determine model capabilities
  const isVeo31 = modelName.includes('3.1');
  const isVeo3 = modelName.includes('3.0') || modelName.includes('3.1');
  const supportsInterpolation = isVeo31; // Only Veo 3.1 supports start+end frame
  const supports1080p = isVeo31;

  // Available duration options vary by model
  const getDurationOptions = () => {
    if (isVeo31) return ['4', '5', '6', '8'];
    if (isVeo3) return ['5', '6', '8'];
    return ['5', '6', '8']; // Veo 2
  };

  // Handle image selection from picker (library or upload)
  const handleImageSelect = (
    target: 'start' | 'end',
    image: { base64: string; mimeType: string; name: string }
  ) => {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;

    if (target === 'start') {
      setStartFramePreview(dataUrl);
      onOptionsChange({
        ...options,
        startFrameBase64: image.base64,
        startFrameMimeType: image.mimeType,
        startFrameName: image.name,
      });
    } else {
      setEndFramePreview(dataUrl);
      onOptionsChange({
        ...options,
        endFrameBase64: image.base64,
        endFrameMimeType: image.mimeType,
        endFrameName: image.name,
      });
    }
    setShowImagePicker(null);
  };

  const clearFrame = (target: 'start' | 'end') => {
    if (target === 'start') {
      setStartFramePreview(null);
      onOptionsChange({
        ...options,
        startFrameBase64: undefined,
        startFrameMimeType: undefined,
        startFrameName: undefined,
        imageMode: 'none',
      });
    } else {
      setEndFramePreview(null);
      onOptionsChange({
        ...options,
        endFrameBase64: undefined,
        endFrameMimeType: undefined,
        endFrameName: undefined,
        imageMode: options.startFrameBase64 ? 'start-frame' : 'none',
      });
    }
  };

  // Update image mode when frames change
  useEffect(() => {
    if (options.imageMode === 'loop') return; // Don't auto-change loop mode

    if (options.startFrameBase64 && options.endFrameBase64) {
      onOptionsChange({ ...options, imageMode: 'start-end-frame' });
    } else if (options.startFrameBase64) {
      onOptionsChange({ ...options, imageMode: 'start-frame' });
    } else {
      onOptionsChange({ ...options, imageMode: 'none' });
    }
  }, [options.startFrameBase64, options.endFrameBase64]);

  return (
    <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <rux-icon icon="videocam" size="small" className="text-purple-400"></rux-icon>
          <span className="text-sm font-bold text-purple-300 uppercase tracking-wider">
            Veo Video Options
          </span>
          <span className="text-xs text-purple-400/70 bg-purple-800/50 px-2 py-0.5 rounded">
            {modelName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-purple-400 hover:text-white transition-colors"
          title="Close options panel"
        >
          <rux-icon icon="close" size="small"></rux-icon>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Image Mode Section */}
        <div className="col-span-2">
          <label className="block text-xs text-purple-300 mb-2 font-medium">
            Image Input Mode
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onOptionsChange({ ...options, imageMode: 'none' })}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                options.imageMode === 'none'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              Text Only
            </button>
            <button
              onClick={() => onOptionsChange({ ...options, imageMode: 'start-frame' })}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                options.imageMode === 'start-frame'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              Start Frame
            </button>
            {supportsInterpolation && (
              <>
                <button
                  onClick={() => onOptionsChange({ ...options, imageMode: 'start-end-frame' })}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    options.imageMode === 'start-end-frame'
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
                  }`}
                >
                  Start + End Frame
                </button>
                <button
                  onClick={() => onOptionsChange({ ...options, imageMode: 'loop' })}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    options.imageMode === 'loop'
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
                  }`}
                  title="Uses same image for start and end to create a seamless loop"
                >
                  <rux-icon icon="loop" size="extra-small"></rux-icon>
                  Loop
                </button>
              </>
            )}
          </div>
          <p className="text-[10px] text-purple-400/60 mt-1">
            {options.imageMode === 'none' && 'Generate video from text prompt only'}
            {options.imageMode === 'start-frame' && 'Use an image as the first frame'}
            {options.imageMode === 'start-end-frame' && 'Interpolate between two images (Veo 3.1 only)'}
            {options.imageMode === 'loop' && 'Start and end on the same frame for seamless looping'}
          </p>
        </div>

        {/* Frame Selection Section */}
        {options.imageMode !== 'none' && (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            {/* Start Frame */}
            <div className="border border-dashed border-purple-500/30 rounded-lg p-3 bg-purple-900/20">
              <label className="block text-xs text-purple-300 mb-2">
                Start Frame {options.imageMode === 'loop' && '(will also be end frame)'}
              </label>
              {startFramePreview || options.startFrameBase64 ? (
                <div className="relative group">
                  <img
                    src={startFramePreview || `data:${options.startFrameMimeType};base64,${options.startFrameBase64}`}
                    alt="Start frame"
                    className="w-full h-24 object-cover rounded border border-purple-500/30"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setShowImagePicker('start')}
                      className="bg-purple-500/90 text-white rounded p-1.5 hover:bg-purple-400 transition-colors"
                      title="Change image"
                    >
                      <rux-icon icon="swap-horiz" size="extra-small"></rux-icon>
                    </button>
                    <button
                      onClick={() => clearFrame('start')}
                      className="bg-red-500/90 text-white rounded p-1.5 hover:bg-red-400 transition-colors"
                      title="Remove frame"
                    >
                      <rux-icon icon="close" size="extra-small"></rux-icon>
                    </button>
                  </div>
                  {options.startFrameName && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <p className="text-[10px] text-white truncate">{options.startFrameName}</p>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowImagePicker('start')}
                  className="flex flex-col items-center justify-center w-full h-24 cursor-pointer hover:bg-purple-800/20 rounded transition-colors border border-transparent hover:border-purple-500/30"
                >
                  <rux-icon icon="folder-open" size="small" className="text-purple-400"></rux-icon>
                  <span className="text-xs text-purple-400 mt-1">Select from Library</span>
                  <span className="text-[10px] text-purple-400/50">or upload new</span>
                </button>
              )}
            </div>

            {/* End Frame (only for start-end-frame mode) */}
            {options.imageMode === 'start-end-frame' && (
              <div className="border border-dashed border-purple-500/30 rounded-lg p-3 bg-purple-900/20">
                <label className="block text-xs text-purple-300 mb-2">End Frame</label>
                {endFramePreview || options.endFrameBase64 ? (
                  <div className="relative group">
                    <img
                      src={endFramePreview || `data:${options.endFrameMimeType};base64,${options.endFrameBase64}`}
                      alt="End frame"
                      className="w-full h-24 object-cover rounded border border-purple-500/30"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowImagePicker('end')}
                        className="bg-purple-500/90 text-white rounded p-1.5 hover:bg-purple-400 transition-colors"
                        title="Change image"
                      >
                        <rux-icon icon="swap-horiz" size="extra-small"></rux-icon>
                      </button>
                      <button
                        onClick={() => clearFrame('end')}
                        className="bg-red-500/90 text-white rounded p-1.5 hover:bg-red-400 transition-colors"
                        title="Remove frame"
                      >
                        <rux-icon icon="close" size="extra-small"></rux-icon>
                      </button>
                    </div>
                    {options.endFrameName && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                        <p className="text-[10px] text-white truncate">{options.endFrameName}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowImagePicker('end')}
                    className="flex flex-col items-center justify-center w-full h-24 cursor-pointer hover:bg-purple-800/20 rounded transition-colors border border-transparent hover:border-purple-500/30"
                  >
                    <rux-icon icon="folder-open" size="small" className="text-purple-400"></rux-icon>
                    <span className="text-xs text-purple-400 mt-1">Select from Library</span>
                    <span className="text-[10px] text-purple-400/50">or upload new</span>
                  </button>
                )}
              </div>
            )}

            {options.imageMode === 'loop' && (
              <div className="flex items-center justify-center border border-dashed border-purple-500/30 rounded-lg p-3 bg-purple-900/10">
                <div className="text-center">
                  <rux-icon icon="loop" size="small" className="text-purple-400"></rux-icon>
                  <p className="text-xs text-purple-400/70 mt-1">
                    End frame = Start frame
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Card Picker Modal */}
        {showImagePicker && (
          <ImageCardPicker
            title={showImagePicker === 'start' ? 'Select Start Frame' : 'Select End Frame'}
            onSelect={(img) => handleImageSelect(showImagePicker, img)}
            onCancel={() => setShowImagePicker(null)}
          />
        )}

        {/* Aspect Ratio */}
        <div>
          <label className="block text-xs text-purple-300 mb-1 font-medium">
            Aspect Ratio
          </label>
          <select
            value={options.aspectRatio}
            onChange={(e) => onOptionsChange({ ...options, aspectRatio: e.target.value as any })}
            className="w-full bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400"
            title="Video aspect ratio"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
          </select>
        </div>

        {/* Resolution */}
        <div>
          <label className="block text-xs text-purple-300 mb-1 font-medium">
            Resolution
          </label>
          <select
            value={options.resolution}
            onChange={(e) => onOptionsChange({ ...options, resolution: e.target.value as any })}
            className="w-full bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400"
            title="Video resolution"
            disabled={!supports1080p && options.resolution === '1080p'}
          >
            <option value="720p">720p</option>
            {supports1080p && <option value="1080p">1080p</option>}
          </select>
          {!supports1080p && (
            <p className="text-[10px] text-purple-400/50 mt-0.5">1080p only available on Veo 3.1</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs text-purple-300 mb-1 font-medium">
            Duration
          </label>
          <select
            value={options.durationSeconds}
            onChange={(e) => onOptionsChange({ ...options, durationSeconds: e.target.value as any })}
            className="w-full bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400"
            title="Video duration in seconds"
          >
            {getDurationOptions().map((d) => (
              <option key={d} value={d}>{d} seconds</option>
            ))}
          </select>
        </div>

        {/* Person Generation */}
        <div>
          <label className="block text-xs text-purple-300 mb-1 font-medium">
            People in Video
          </label>
          <select
            value={options.personGeneration}
            onChange={(e) => onOptionsChange({ ...options, personGeneration: e.target.value as any })}
            className="w-full bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400"
            title="Person generation settings"
          >
            <option value="allow_adult">Allow Adults</option>
            <option value="allow_all">Allow All</option>
            <option value="dont_allow">Don't Allow</option>
          </select>
        </div>

        {/* Negative Prompt */}
        <div className="col-span-2">
          <label className="block text-xs text-purple-300 mb-1 font-medium">
            Negative Prompt (things to avoid)
          </label>
          <input
            type="text"
            value={options.negativePrompt}
            onChange={(e) => onOptionsChange({ ...options, negativePrompt: e.target.value })}
            placeholder="e.g., blurry, low quality, cartoon"
            className="w-full bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1.5 text-sm text-white placeholder:text-purple-400/50 focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>
    </div>
  );
};

export default VeoOptionsPanel;
export type { VeoOptionsPanelProps };
