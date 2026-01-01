import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export interface GenerationConfig {
  prompt: string;
  aspectRatio: AspectRatio;
}

export interface VideoState {
  isGenerating: boolean;
  progressMessage: string;
  videoUrl: string | null;
  error: string | null;
}
