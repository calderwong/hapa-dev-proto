// @ts-nocheck
import React, { useState, useEffect } from 'react';

export interface ImagenOptions {
  // Number of images to generate (1-4)
  numberOfImages: 1 | 2 | 3 | 4;
  // Output size (Standard/Ultra only)
  imageSize: '1K' | '2K';
  // Aspect ratio
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  // Person generation policy
  personGeneration: 'dont_allow' | 'allow_adult' | 'allow_all';
  // Negative prompt (what to avoid)
  negativePrompt: string;
  // Output format
  outputMimeType: 'image/png' | 'image/jpeg';
  // Style reference image (optional)
  styleReferenceBase64?: string;
  styleReferenceMimeType?: string;
  // Prompt template (optional, for templates)
  promptTemplate?: string;
}

// Card types for saved configs
export interface NegativePromptCard {
  cardId: string;
  coreName: string;
  content: string;
  name?: string;
  createdAt: string;
}

export interface ImagenTemplateCard {
  cardId: string;
  coreName: string;
  name: string;
  config: ImagenOptions;
  createdAt: string;
}

interface ImagenOptionsPanelProps {
  modelName: string;
  options: ImagenOptions;
  onOptionsChange: (options: ImagenOptions) => void;
  onClose: () => void;
}

const CARD_LIBRARY_CORE_NAME = 'card-library';

const ImagenOptionsPanel: React.FC<ImagenOptionsPanelProps> = ({
  modelName,
  options,
  onOptionsChange,
  onClose,
}) => {
  const [stylePreview, setStylePreview] = useState<string | null>(null);
  const [savedNegativePrompts, setSavedNegativePrompts] = useState<NegativePromptCard[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<ImagenTemplateCard[]>([]);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplateNameInput, setShowTemplateNameInput] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load saved prompts and templates from card library
  useEffect(() => {
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = async () => {
    if (!window.electronAPI?.p2pRead) return;
    
    try {
      const entries = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
      const negativePrompts: NegativePromptCard[] = [];
      const templates: ImagenTemplateCard[] = [];
      
      for (const entry of entries) {
        try {
          const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
          if (parsed.type === 'config' && parsed.subType === 'negative-prompt') {
            negativePrompts.push({
              cardId: parsed.cardId || parsed.id,
              coreName: parsed.coreName || CARD_LIBRARY_CORE_NAME,
              content: parsed.content,
              name: parsed.name,
              createdAt: parsed.createdAt,
            });
          } else if (parsed.type === 'config' && parsed.subType === 'imagen-template') {
            templates.push({
              cardId: parsed.cardId || parsed.id,
              coreName: parsed.coreName || CARD_LIBRARY_CORE_NAME,
              name: parsed.name,
              config: parsed.config,
              createdAt: parsed.createdAt,
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
      
      // Sort by creation date (newest first)
      negativePrompts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setSavedNegativePrompts(negativePrompts);
      setSavedTemplates(templates);
    } catch (e) {
      console.error('Failed to load saved configs:', e);
    }
  };

  const saveNegativePrompt = async () => {
    if (!options.negativePrompt.trim() || !window.electronAPI?.p2pCreateCore || !window.electronAPI?.p2pAppend) {
      return;
    }
    
    setIsSavingPrompt(true);
    try {
      const cardId = `neg-prompt-${Date.now()}`;
      const coreName = `card-${cardId}`;
      
      // Create the card core
      await window.electronAPI.p2pCreateCore(coreName);
      
      // Create card record
      const cardRecord = {
        type: 'config',
        subType: 'negative-prompt',
        cardId,
        coreName,
        content: options.negativePrompt.trim(),
        name: options.negativePrompt.trim().slice(0, 30) + (options.negativePrompt.length > 30 ? '...' : ''),
        createdAt: new Date().toISOString(),
      };
      
      // Save to card core
      await window.electronAPI.p2pAppend(coreName, JSON.stringify(cardRecord));
      
      // Index in card library
      const indexEntry = {
        cardId,
        coreName,
        type: 'config',
        subType: 'negative-prompt',
        name: cardRecord.name,
        createdAt: cardRecord.createdAt,
      };
      await window.electronAPI.p2pAppend(CARD_LIBRARY_CORE_NAME, JSON.stringify(indexEntry));
      
      // Reload saved prompts
      await loadSavedConfigs();
      setSelectedPromptId(cardId);
    } catch (e) {
      console.error('Failed to save negative prompt:', e);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !window.electronAPI?.p2pCreateCore || !window.electronAPI?.p2pAppend) {
      return;
    }
    
    setIsSavingTemplate(true);
    try {
      const cardId = `imagen-template-${Date.now()}`;
      const coreName = `card-${cardId}`;
      
      // Create the card core
      await window.electronAPI.p2pCreateCore(coreName);
      
      // Create template record (copy current options)
      const templateConfig: ImagenOptions = { ...options };
      
      const cardRecord = {
        type: 'config',
        subType: 'imagen-template',
        cardId,
        coreName,
        name: templateName.trim(),
        config: templateConfig,
        createdAt: new Date().toISOString(),
      };
      
      // Save to card core
      await window.electronAPI.p2pAppend(coreName, JSON.stringify(cardRecord));
      
      // Index in card library
      const indexEntry = {
        cardId,
        coreName,
        type: 'config',
        subType: 'imagen-template',
        name: cardRecord.name,
        createdAt: cardRecord.createdAt,
      };
      await window.electronAPI.p2pAppend(CARD_LIBRARY_CORE_NAME, JSON.stringify(indexEntry));
      
      // Reload templates
      await loadSavedConfigs();
      setSelectedTemplateId(cardId);
      setShowTemplateNameInput(false);
      setTemplateName('');
    } catch (e) {
      console.error('Failed to save template:', e);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const loadNegativePrompt = (prompt: NegativePromptCard) => {
    setSelectedPromptId(prompt.cardId);
    onOptionsChange({ ...options, negativePrompt: prompt.content });
  };

  const loadTemplate = (template: ImagenTemplateCard) => {
    setSelectedTemplateId(template.cardId);
    onOptionsChange({ ...template.config });
    // Also update the selected negative prompt if it matches
    const matchingPrompt = savedNegativePrompts.find(p => p.content === template.config.negativePrompt);
    if (matchingPrompt) {
      setSelectedPromptId(matchingPrompt.cardId);
    } else {
      setSelectedPromptId(null);
    }
  };

  // Determine model capabilities
  const isUltra = modelName.toLowerCase().includes('ultra');
  const isFast = modelName.toLowerCase().includes('fast');
  const supports2K = isUltra || modelName.toLowerCase().includes('4.0');

  // Get model tier display name
  const getModelTier = () => {
    if (isFast) return { name: 'Fast', icon: 'flash-on', color: 'text-yellow-400' };
    if (isUltra) return { name: 'Ultra', icon: 'stars', color: 'text-purple-400' };
    return { name: 'Standard', icon: 'tune', color: 'text-cyan-400' };
  };

  const tier = getModelTier();

  // Aspect ratio visual representations
  const aspectRatios = [
    { value: '1:1', label: 'Square', width: 32, height: 32 },
    { value: '3:4', label: 'Portrait', width: 24, height: 32 },
    { value: '4:3', label: 'Landscape', width: 32, height: 24 },
    { value: '9:16', label: 'Tall', width: 18, height: 32 },
    { value: '16:9', label: 'Wide', width: 32, height: 18 },
  ];

  const handleStyleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const base64 = result.split(',')[1];
      const mimeType = file.type || 'image/png';

      setStylePreview(result);
      onOptionsChange({
        ...options,
        styleReferenceBase64: base64,
        styleReferenceMimeType: mimeType,
      });
    };
    reader.readAsDataURL(file);
  };

  const clearStyleImage = () => {
    setStylePreview(null);
    onOptionsChange({
      ...options,
      styleReferenceBase64: undefined,
      styleReferenceMimeType: undefined,
    });
  };

  return (
    <div className="bg-[#172635] border border-[#2b4a63] rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#1b2d3e] border-b border-[#2b4a63] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <rux-icon icon="palette" size="small" className="text-purple-400"></rux-icon>
          <div>
            <h3 className="text-white font-bold text-sm">Image Generation Options</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <rux-icon icon={tier.icon} size="extra-small" className={tier.color}></rux-icon>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${tier.color}`}>
                {tier.name} Tier
              </span>
              <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                {modelName}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          title="Close"
        >
          <rux-icon icon="close" size="small"></rux-icon>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Aspect Ratio Selection */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            <rux-icon icon="aspect-ratio" size="extra-small"></rux-icon>
            Aspect Ratio
          </label>
          <div className="flex gap-2 flex-wrap">
            {aspectRatios.map((ar) => (
              <button
                key={ar.value}
                onClick={() => onOptionsChange({ ...options, aspectRatio: ar.value as any })}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                  options.aspectRatio === ar.value
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-[#2b4a63] hover:border-purple-500/50 hover:bg-[#1b2d3e]'
                }`}
                title={ar.label}
              >
                <div
                  className={`bg-gray-600 rounded transition-colors ${
                    options.aspectRatio === ar.value ? 'bg-purple-400' : 'group-hover:bg-gray-500'
                  }`}
                  style={{ width: ar.width, height: ar.height }}
                />
                <span className={`text-[9px] font-mono ${
                  options.aspectRatio === ar.value ? 'text-purple-300' : 'text-gray-500'
                }`}>
                  {ar.value}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Output Settings Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Resolution */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <rux-icon icon="hd" size="extra-small"></rux-icon>
              Resolution
            </label>
            <select
              value={options.imageSize}
              onChange={(e) => onOptionsChange({ ...options, imageSize: e.target.value as any })}
              className="w-full bg-[#101923] border border-[#2b4a63] rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              title="Image resolution"
            >
              <option value="1K">1K (1024px)</option>
              {supports2K && <option value="2K">2K (2048px)</option>}
            </select>
          </div>

          {/* Count */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <rux-icon icon="collections" size="extra-small"></rux-icon>
              Count
            </label>
            <select
              value={options.numberOfImages}
              onChange={(e) => onOptionsChange({ ...options, numberOfImages: parseInt(e.target.value) as any })}
              className="w-full bg-[#101923] border border-[#2b4a63] rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              title="Number of images"
            >
              <option value="1">1 Image</option>
              <option value="2">2 Images</option>
              <option value="3">3 Images</option>
              <option value="4">4 Images</option>
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <rux-icon icon="image" size="extra-small"></rux-icon>
              Format
            </label>
            <select
              value={options.outputMimeType}
              onChange={(e) => onOptionsChange({ ...options, outputMimeType: e.target.value as any })}
              className="w-full bg-[#101923] border border-[#2b4a63] rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              title="Output format"
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
            </select>
          </div>
        </div>

        {/* Person Generation */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <rux-icon icon="person" size="extra-small"></rux-icon>
            Person Generation
          </label>
          <div className="flex gap-2">
            {[
              { value: 'dont_allow', label: "Don't Allow", icon: 'block' },
              { value: 'allow_adult', label: 'Adults Only', icon: 'person' },
              { value: 'allow_all', label: 'Allow All', icon: 'people' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onOptionsChange({ ...options, personGeneration: opt.value as any })}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-all ${
                  options.personGeneration === opt.value
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-[#2b4a63] text-gray-400 hover:border-purple-500/50 hover:text-gray-300'
                }`}
              >
                <rux-icon icon={opt.icon} size="extra-small"></rux-icon>
                {opt.label}
              </button>
            ))}
          </div>
          {options.personGeneration === 'allow_all' && (
            <p className="text-[10px] text-yellow-500/80 mt-1.5 flex items-center gap-1">
              <rux-icon icon="warning" size="10px"></rux-icon>
              Not available in EU, UK, CH, or MENA regions
            </p>
          )}
        </div>

        {/* Negative Prompt with Save & Saved Prompts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <rux-icon icon="do-not-disturb" size="extra-small"></rux-icon>
              Negative Prompt
              <span className="text-[9px] font-normal normal-case text-gray-500">(things to avoid)</span>
            </label>
            <button
              onClick={saveNegativePrompt}
              disabled={!options.negativePrompt.trim() || isSavingPrompt}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                options.negativePrompt.trim() && !isSavingPrompt
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title="Save to Library"
            >
              <rux-icon icon={isSavingPrompt ? 'refresh' : 'save'} size="12px" className={isSavingPrompt ? 'animate-spin' : ''}></rux-icon>
              {isSavingPrompt ? 'Saving...' : 'Save'}
            </button>
          </div>
          
          <textarea
            value={options.negativePrompt}
            onChange={(e) => {
              setSelectedPromptId(null); // Clear selection when manually editing
              onOptionsChange({ ...options, negativePrompt: e.target.value });
            }}
            placeholder="blurry, low quality, distorted, watermark, text..."
            className="w-full bg-[#101923] border border-[#2b4a63] rounded px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-purple-500 focus:outline-none resize-none h-16"
          />
          
          {/* Saved Negative Prompts */}
          {savedNegativePrompts.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <rux-icon icon="bookmark" size="extra-small" className="text-gray-500"></rux-icon>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Saved Prompts</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
                {savedNegativePrompts.slice(0, 8).map((prompt) => (
                  <button
                    key={prompt.cardId}
                    onClick={() => loadNegativePrompt(prompt)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-[11px] transition-all max-w-[140px] truncate ${
                      selectedPromptId === prompt.cardId
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                        : 'border-[#2b4a63] text-gray-400 hover:border-cyan-500/50 hover:text-gray-300 hover:bg-[#1b2d3e]'
                    }`}
                    title={prompt.content}
                  >
                    {prompt.name || prompt.content.slice(0, 20)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Style Reference Image (Optional) */}
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <rux-icon icon="style" size="extra-small"></rux-icon>
            Style Reference
            <span className="text-[9px] font-normal normal-case text-gray-500">(optional)</span>
          </label>
          {stylePreview || options.styleReferenceBase64 ? (
            <div className="relative inline-block">
              <img
                src={stylePreview || `data:${options.styleReferenceMimeType};base64,${options.styleReferenceBase64}`}
                alt="Style reference"
                className="h-20 w-auto rounded border border-purple-500/50"
              />
              <button
                onClick={clearStyleImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-400 transition-colors"
                title="Remove style reference"
              >
                <rux-icon icon="close" size="extra-small"></rux-icon>
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#2b4a63] rounded-lg cursor-pointer hover:border-purple-500/50 hover:bg-[#1b2d3e] transition-all text-gray-500 hover:text-gray-400">
              <rux-icon icon="add-photo-alternate" size="small"></rux-icon>
              <span className="text-xs">Drop or click to add style reference</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleStyleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Saved Templates Section */}
      {savedTemplates.length > 0 && (
        <div className="px-4 py-3 border-t border-[#2b4a63] bg-[#101923]/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <rux-icon icon="dashboard" size="extra-small" className="text-purple-400"></rux-icon>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Saved Templates</span>
            </div>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {showTemplates ? 'Hide' : `Show (${savedTemplates.length})`}
            </button>
          </div>
          {showTemplates && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
              {savedTemplates.map((template) => (
                <button
                  key={template.cardId}
                  onClick={() => loadTemplate(template)}
                  className={`flex-shrink-0 flex flex-col items-start px-3 py-2 rounded-lg border transition-all min-w-[120px] ${
                    selectedTemplateId === template.cardId
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-[#2b4a63] hover:border-purple-500/50 hover:bg-[#1b2d3e]'
                  }`}
                  title={`Load template: ${template.name}`}
                >
                  <span className={`text-[11px] font-medium truncate w-full ${
                    selectedTemplateId === template.cardId ? 'text-purple-300' : 'text-white'
                  }`}>
                    {template.name}
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 rounded text-purple-400">
                      {template.config.aspectRatio}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 bg-cyan-500/20 rounded text-cyan-400">
                      {template.config.imageSize}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-[#101923] border-t border-[#2b4a63]">
        {/* Template Name Input (when saving) */}
        {showTemplateNameInput ? (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 bg-[#172635] border border-[#2b4a63] rounded px-3 py-1.5 text-white text-sm placeholder-gray-600 focus:border-purple-500 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim()) saveTemplate();
                if (e.key === 'Escape') setShowTemplateNameInput(false);
              }}
            />
            <button
              onClick={saveTemplate}
              disabled={!templateName.trim() || isSavingTemplate}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                templateName.trim() && !isSavingTemplate
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSavingTemplate ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowTemplateNameInput(false);
                setTemplateName('');
              }}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"
              title="Cancel"
            >
              <rux-icon icon="close" size="extra-small"></rux-icon>
            </button>
          </div>
        ) : null}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplateNameInput(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#172635] border border-[#2b4a63] rounded text-[11px] text-gray-400 hover:text-white hover:border-purple-500/50 transition-all"
              title="Save current settings as a reusable template"
            >
              <rux-icon icon="bookmark-add" size="extra-small"></rux-icon>
              Save as Template
            </button>
            <div className="text-[10px] text-gray-600 flex items-center gap-1">
              <rux-icon icon="info" size="10px"></rux-icon>
              Settings apply to next generation
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImagenOptionsPanel;
