import { useCallback, useMemo, useRef, useState } from 'react';
import { PipelineContext, PipelineStep, StepRunRecord } from './types';

export const usePipelineRunner = (steps: PipelineStep[], initial?: Partial<PipelineContext>) => {
  const [inputs, setInputsState] = useState<Record<string, any>>(initial?.inputs || {});
  const [outputs, setOutputsState] = useState<Record<string, any>>(initial?.outputs || {});

  // Refs ensure step-to-step dependencies work even before React commits state updates
  const inputsRef = useRef<Record<string, any>>(inputs);
  const outputsRef = useRef<Record<string, any>>(outputs);

  const [runs, setRunsState] = useState<Record<string, StepRunRecord>>(() => {
    const m: Record<string, StepRunRecord> = {};
    steps.forEach((s) => {
      m[s.id] = { id: s.id, name: s.name, status: 'idle' };
    });
    return m;
  });

  const runsRef = useRef<Record<string, StepRunRecord>>(runs);

  const ctx = useCallback((): PipelineContext => {
    return {
      inputs: inputsRef.current,
      outputs: outputsRef.current,
      runsById: runsRef.current,
    };
  }, []);

  const setInput = useCallback((key: string, value: any) => {
    inputsRef.current = { ...inputsRef.current, [key]: value };
    setInputsState(inputsRef.current);
  }, []);

  const setOutput = useCallback((key: string, value: any) => {
    outputsRef.current = { ...outputsRef.current, [key]: value };
    setOutputsState(outputsRef.current);
  }, []);

  const setRun = useCallback((id: string, record: StepRunRecord) => {
    runsRef.current = { ...runsRef.current, [id]: record };
    setRunsState(runsRef.current);
  }, []);

  const runStep = useCallback(
    async (id: string) => {
      const step = steps.find((s) => s.id === id);
      if (!step) throw new Error(`Unknown step: ${id}`);

      const startedAt = Date.now();
      setRun(id, {
        ...runsRef.current[id],
        id,
        name: step.name,
        status: 'running',
        startedAt,
        endedAt: undefined,
        error: undefined,
      });

      try {
        const { output, model, prompt } = await step.run(ctx());
        const endedAt = Date.now();

        // Persist output into outputs map at the step id
        outputsRef.current = { ...outputsRef.current, [id]: output };
        setOutputsState(outputsRef.current);

        setRun(id, {
          ...runsRef.current[id],
          id,
          name: step.name,
          status: 'success',
          startedAt,
          endedAt,
          output,
          model,
          prompt,
        });

        return output;
      } catch (e: any) {
        const endedAt = Date.now();
        const msg = e?.message || String(e);
        setRun(id, {
          ...runsRef.current[id],
          id,
          name: step.name,
          status: 'error',
          startedAt,
          endedAt,
          error: msg,
        });
        throw e;
      }
    },
    [steps, ctx, setRun]
  );

  const runAll = useCallback(async () => {
    for (const s of steps) {
      await runStep(s.id);
    }
  }, [steps, runStep]);

  const runsById = runs;

  const allStepsDone = useMemo(() => Object.values(runs).every((r) => r.status === 'success'), [runs]);

  return {
    inputs,
    outputs,
    runsById,
    allStepsDone,
    setInput,
    setOutput,
    runStep,
    runAll,
  };
};
