export function mapCapabilityToChatSelection(capability) {
  const provider = capability?.provider;
  const modelId = capability?.modelId;

  if (!provider || !modelId) return null;

  if (provider === 'openai') return { provider: 'openai', modelId };
  if (provider === 'aimlapi') return { provider: 'aimlapi', modelId };
  if (provider === 'llama') return { provider: 'llama', modelId };
  if (provider === 'vertex') return { provider: 'gemini', modelId };
  if (provider === 'gemini') return { provider: 'gemini', modelId };

  return { provider: 'gemini', modelId };
}
