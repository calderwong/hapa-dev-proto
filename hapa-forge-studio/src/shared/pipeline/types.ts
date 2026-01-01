export type StepStatus = 'idle' | 'running' | 'success' | 'error';

export type StepRunRecord = {
  id: string;
  name: string;
  status: StepStatus;
  startedAt?: number;
  endedAt?: number;
  output?: any;
  error?: string;
  model?: string;
  prompt?: string;
};

export type PipelineContext = {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  runsById: Record<string, StepRunRecord>;
};

export type PipelineStep = {
  id: string;
  name: string;
  description?: string;
  run: (ctx: PipelineContext) => Promise<{ output: any; model?: string; prompt?: string }>;
};
