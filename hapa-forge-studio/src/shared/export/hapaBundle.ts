export type HapaAsset = {
  id: string;
  type: 'image' | 'video' | 'json' | '3d';
  mimeType?: string;
  dataUrl?: string;
  url?: string;
  name?: string;
  /**
   * Optional portable reference for exported zips.
   * A relative path to the asset file (e.g. items/<kind>/<slug>__<id>/assets/images/<assetId>.png)
   */
  path?: string;
};

export type HapaBundleStep = {
  id: string;
  name: string;
  model?: string;
  prompt?: string;
  status: 'success' | 'error';
  startedAt?: number;
  endedAt?: number;
  output?: any;
};

export type HapaBundle = {
  version: '1.0';
  kind: 'character' | 'ship' | 'media';
  createdAt: number;
  inputs: Record<string, any>;
  steps: HapaBundleStep[];
  assets: HapaAsset[];
  outputs: Record<string, any>;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const downloadJson = (obj: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, filename);
};

export const downloadDataUrl = async (dataUrl: string, filename: string) => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  downloadBlob(blob, filename);
};

export const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text);
};
