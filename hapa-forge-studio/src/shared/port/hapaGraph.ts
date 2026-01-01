import type { HapaBundle, HapaAsset } from '@/shared/export/hapaBundle';
import type { HapaForgeExportManifest, HapaForgeExportManifestItem } from '@/shared/export/hapaZip';

export type HapaValueRef = {
  bundlePath: string;
  /** JSON Pointer into bundle JSON (RFC 6901-ish). */
  jsonPointer: string;
};

export type HapaPromptRef = {
  bundlePath: string;
  jsonPointer?: string;
};

export type HapaGraphNodeInput = {
  key: string;
  sourceNodeId: string;
  sourceKey: string;
};

export type HapaGraphNodeOutput = {
  key: string;
  valueRef: HapaValueRef;
};

export type HapaGraphNodeAsset = {
  assetId: string;
  kind: 'image' | 'video';
  path?: string;
  url?: string;
  sha256?: string;
};

export type HapaGraphNode = {
  nodeId: string;
  type: string;
  label: string;
  stepId?: string;
  model?: string;
  promptRef?: HapaPromptRef;
  inputs?: HapaGraphNodeInput[];
  outputs?: HapaGraphNodeOutput[];
  assets?: HapaGraphNodeAsset[];
};

export type HapaGraphEdge = {
  from: { nodeId: string; key: string };
  to: { nodeId: string; key: string };
};

export type HapaImportManifestItem = {
  id: string;
  kind: 'character' | 'ship' | 'media';
  title: string;
  folder: string;
  portableBundlePath: string;
  nodes: HapaGraphNode[];
  edges: HapaGraphEdge[];
};

export type HapaImportManifest = {
  version: '1.0';
  createdAt: number;
  source: 'hapa_forge_studio';
  /** Folder name inside the embedded export (relative to the handoff root). */
  embeddedExportRoot: 'hapa_forge_export';
  items: HapaImportManifestItem[];
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Very small JSON pointer helper (RFC 6901-ish). */
const ptr = (...parts: Array<string | number>) =>
  '/' +
  parts
    .map(String)
    .map((p) => p.replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/');

const rootedBundlePath = (portableBundlePath: string) =>
  `hapa_forge_export/${portableBundlePath}`.replace(/\/+/g, '/');

const inferNodeType = (stepName: string, stepId?: string): string => {
  const s = `${stepName} ${stepId || ''}`.toLowerCase();

  if (s.includes('render')) return 'render';
  if (s.includes('video') || s.includes('flyby') || s.includes('veo')) return 'video';
  if (s.includes('image') || s.includes('portrait') || s.includes('concept')) return 'image';
  if (s.includes('prompt')) return 'text';
  if (s.includes('json') || s.includes('analy') || s.includes('stats') || s.includes('visual')) return 'json';
  return 'text';
};

const pickStepAssetAttachments = (bundle: HapaBundle, stepId?: string, nodeType?: string): HapaGraphNodeAsset[] => {
  const assets = Array.isArray(bundle.assets) ? bundle.assets : [];
  const byId = stepId ? assets.filter((a) => a?.id === stepId) : [];

  const attach = (a: HapaAsset): HapaGraphNodeAsset | null => {
    if (a.type === 'image') {
      return { assetId: a.id, kind: 'image', path: a.path };
    }
    if (a.type === 'video') {
      return { assetId: a.id, kind: 'video', url: a.url };
    }
    return null;
  };

  // 1) Prefer exact assetId match with the step.
  const matched = byId.map(attach).filter(Boolean) as HapaGraphNodeAsset[];
  if (matched.length) return matched;

  // 2) Heuristic: if node is image/video, attach the first asset of that type.
  if (nodeType === 'image') {
    const img = assets.find((a) => a?.type === 'image');
    return img ? ([attach(img)].filter(Boolean) as HapaGraphNodeAsset[]) : [];
  }
  if (nodeType === 'video') {
    const vid = assets.find((a) => a?.type === 'video');
    return vid ? ([attach(vid)].filter(Boolean) as HapaGraphNodeAsset[]) : [];
  }

  return [];
};

const buildItemGraph = (
  manifestItem: HapaForgeExportManifestItem,
  portableBundle: HapaBundle
): { nodes: HapaGraphNode[]; edges: HapaGraphEdge[] } => {
  const nodes: HapaGraphNode[] = [];
  const edges: HapaGraphEdge[] = [];

  const id = manifestItem.id;
  const portableBundlePath = manifestItem.portableBundlePath;
  const bundlePath = rootedBundlePath(portableBundlePath);

  // Input node
  const inputNodeId = `${id}::input`;
  const inputAssets: HapaGraphNodeAsset[] = [];
  const bestImg = Array.isArray(portableBundle.assets)
    ? portableBundle.assets.find((a) => a.type === 'image')
    : undefined;
  if (bestImg?.type === 'image') {
    inputAssets.push({ assetId: bestImg.id, kind: 'image', path: bestImg.path });
  }

  const inputOutputs: HapaGraphNodeOutput[] = [{ key: 'out', valueRef: { bundlePath: bundlePath, jsonPointer: ptr('inputs') } }];
  const knownTextKeys = ['profileText', 'rawText', 'text', 'sourceText', 'prompt'];
  for (const k of knownTextKeys) {
    if (isNonEmptyString((portableBundle.inputs as any)?.[k])) {
      inputOutputs.push({ key: k, valueRef: { bundlePath: bundlePath, jsonPointer: ptr('inputs', k) } });
    }
  }

  nodes.push({
    nodeId: inputNodeId,
    type: 'input',
    label: 'Input',
    outputs: inputOutputs,
    assets: inputAssets.length ? inputAssets : undefined,
  });

  const steps = Array.isArray(portableBundle.steps) ? portableBundle.steps : [];

  const stepNodes: HapaGraphNode[] = steps.map((step, idx) => {
    const nodeType = inferNodeType(step?.name || step?.id || `step-${idx}`, step?.id);
    const nodeId = `${id}::${step.id || `step_${idx}`}`;

    const outputs: HapaGraphNodeOutput[] = [];
    if (step?.output !== undefined) {
      outputs.push({
        key: 'out',
        valueRef: {
          bundlePath: bundlePath,
          jsonPointer: ptr('steps', idx, 'output'),
        },
      });
    }

    const promptRef = isNonEmptyString(step?.prompt)
      ? ({ bundlePath: bundlePath, jsonPointer: ptr('steps', idx, 'prompt') } as HapaPromptRef)
      : undefined;

    const assets = pickStepAssetAttachments(portableBundle, step?.id, nodeType);

    return {
      nodeId,
      type: nodeType,
      label: step?.name || step?.id || `Step ${idx + 1}`,
      stepId: step?.id,
      model: step?.model,
      promptRef,
      outputs: outputs.length ? outputs : undefined,
      assets: assets.length ? assets : undefined,
    };
  });

  nodes.push(...stepNodes);

  // Sequential edges: input -> first step -> next step ...
  const allNodeIds = [inputNodeId, ...stepNodes.map((n) => n.nodeId)];
  for (let i = 0; i < allNodeIds.length - 1; i++) {
    edges.push({
      from: { nodeId: allNodeIds[i], key: 'out' },
      to: { nodeId: allNodeIds[i + 1], key: 'in' },
    });
  }

  // Also include inputs wiring on each step node (helps consumers)
  for (let i = 1; i < nodes.length; i++) {
    const cur = nodes[i];
    const prev = nodes[i - 1];
    if (!cur || !prev) continue;
    if (cur.nodeId === inputNodeId) continue;
    cur.inputs = [{ key: 'in', sourceNodeId: prev.nodeId, sourceKey: 'out' }];
  }

  return { nodes, edges };
};

export const buildHapaImportManifest = (args: {
  exportManifest: HapaForgeExportManifest;
  portableBundlesById: Record<string, HapaBundle | undefined>;
}): HapaImportManifest => {
  const createdAt = Date.now();
  const items: HapaImportManifestItem[] = [];

  for (const mi of args.exportManifest.items || []) {
    const portable = args.portableBundlesById[mi.id];
    if (!portable) continue;

    const { nodes, edges } = buildItemGraph(mi, portable);
    items.push({
      id: mi.id,
      kind: mi.kind,
      title: mi.title,
      folder: mi.folder,
      portableBundlePath: mi.portableBundlePath,
      nodes,
      edges,
    });
  }

  return {
    version: '1.0',
    createdAt,
    source: 'hapa_forge_studio',
    embeddedExportRoot: 'hapa_forge_export',
    items,
  };
};
