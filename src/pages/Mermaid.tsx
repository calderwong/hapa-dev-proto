// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageContainer from '../components/PageContainer';
import mermaid from 'mermaid';
import { toPng, toJpeg } from 'html-to-image';
import {
  Download,
  Copy,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Palette,
  Code,
  Eye,
  FileText,
  Trash2,
  Save,
  FolderOpen,
} from 'lucide-react';

// Sample diagrams
const SAMPLE_DIAGRAMS = {
  flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[Deploy]`,
  sequence: `sequenceDiagram
    participant User
    participant App
    participant API
    User->>App: Click button
    App->>API: Send request
    API-->>App: Return data
    App-->>User: Display result`,
  class: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    class Cat {
        +String color
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Success : Complete
    Processing --> Error : Fail
    Success --> [*]
    Error --> Idle : Retry`,
  er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : includes
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int orderNumber
        date created
    }`,
  gantt: `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Research       :a1, 2024-01-01, 7d
    Design         :a2, after a1, 5d
    section Development
    Implementation :a3, after a2, 14d
    Testing        :a4, after a3, 7d`,
  mindmap: `mindmap
  root((Hapa Node))
    Cards
      Card Library
      Hell Week Pipeline
      Crafting
    P2P
      Hypercore
      Hyperswarm
      Replication
    AI
      Chat
      Vision
      Local LLM`,
  pie: `pie showData
    title Tech Stack
    "React" : 40
    "TypeScript" : 25
    "Electron" : 20
    "Tailwind" : 15`,
};

// Mermaid themes
const MERMAID_THEMES = [
  { id: 'default', name: 'Default', bg: 'bg-white' },
  { id: 'dark', name: 'Dark', bg: 'bg-gray-900' },
  { id: 'forest', name: 'Forest', bg: 'bg-green-50' },
  { id: 'neutral', name: 'Neutral', bg: 'bg-gray-100' },
  { id: 'base', name: 'Base', bg: 'bg-blue-50' },
];

const Mermaid: React.FC = () => {
  const [code, setCode] = useState(SAMPLE_DIAGRAMS.flowchart);
  const [theme, setTheme] = useState('dark');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSampleMenu, setShowSampleMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const diagramId = useRef(`mermaid-${Date.now()}`);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'loose',
      fontFamily: 'JetBrains Mono, monospace',
    });
  }, [theme]);

  // Render diagram
  const renderDiagram = useCallback(async () => {
    if (!previewRef.current) return;

    try {
      // Clear previous content
      previewRef.current.innerHTML = '';
      
      // Generate new ID for each render
      diagramId.current = `mermaid-${Date.now()}`;
      
      // Validate and render
      const { svg } = await mermaid.render(diagramId.current, code);
      previewRef.current.innerHTML = svg;
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Invalid diagram syntax');
      // Keep previous diagram visible
    }
  }, [code, theme]);

  // Debounced render
  useEffect(() => {
    const timeout = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeout);
  }, [renderDiagram]);

  // Export as PNG
  const exportPNG = async () => {
    if (!previewRef.current) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
        pixelRatio: 3,
      });
      const link = document.createElement('a');
      link.download = `diagram-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!previewRef.current) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
        pixelRatio: 3,
      });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Load sample diagram
  const loadSample = (key: string) => {
    setCode(SAMPLE_DIAGRAMS[key as keyof typeof SAMPLE_DIAGRAMS]);
    setShowSampleMenu(false);
  };

  return (
    <PageContainer title="Diagrams" icon="schema">
      <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            {/* Sample Diagrams */}
            <div className="relative">
              <button
                onClick={() => setShowSampleMenu(!showSampleMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                <FileText size={16} />
                <span>Templates</span>
              </button>
              {showSampleMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-48">
                  {Object.keys(SAMPLE_DIAGRAMS).map((key) => (
                    <button
                      key={key}
                      onClick={() => loadSample(key)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg capitalize"
                    >
                      {key.replace(/-/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Selector */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                <Palette size={16} />
                <span>Theme</span>
              </button>
              {showThemeMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-36">
                  {MERMAID_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${
                        theme === t.id ? 'text-cyan-400' : ''
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${t.bg} border border-gray-600`}></span>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={renderDiagram}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="Refresh diagram"
            >
              <RefreshCw size={18} />
            </button>

            {/* Clear */}
            <button
              onClick={() => setCode('')}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-red-400"
              title="Clear editor"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy */}
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                copySuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Copy to clipboard"
            >
              <Copy size={16} />
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Export */}
            <button
              onClick={exportPNG}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-sm transition-colors"
              title="Export as PNG"
            >
              <Download size={16} />
              <span>Export PNG</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Panel */}
          <div className="w-1/2 flex flex-col border-r border-gray-700">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/30 border-b border-gray-700">
              <Code size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-gray-400">Mermaid Code</span>
            </div>
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
              placeholder="Enter Mermaid diagram code..."
              spellCheck={false}
            />
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800/30 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-emerald-400" />
                <span className="text-sm font-medium text-gray-400">Preview</span>
              </div>
              {error && (
                <span className="text-xs text-red-400 truncate max-w-64" title={error}>
                  ⚠ {error.split('\n')[0]}
                </span>
              )}
            </div>
            <div
              className={`flex-1 overflow-auto p-4 ${
                theme === 'dark' ? 'bg-gray-950' : 'bg-white'
              }`}
            >
              <div
                ref={previewRef}
                className="min-h-full flex items-center justify-center"
              />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 border-t border-gray-700 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Lines: {code.split('\n').length}</span>
            <span>Characters: {code.length}</span>
            <span>Theme: {MERMAID_THEMES.find((t) => t.id === theme)?.name}</span>
          </div>
          <div>
            <a
              href="https://mermaid.js.org/syntax/flowchart.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Mermaid Docs ↗
            </a>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Mermaid;
