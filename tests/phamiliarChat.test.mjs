import test from 'node:test';
import assert from 'node:assert/strict';

import { mapCapabilityToChatSelection } from '../src/utils/phamiliarChat.mjs';

test('mapCapabilityToChatSelection returns null when capability is missing provider/modelId', () => {
  assert.equal(mapCapabilityToChatSelection(null), null);
  assert.equal(mapCapabilityToChatSelection(undefined), null);
  assert.equal(mapCapabilityToChatSelection({ provider: 'openai' }), null);
  assert.equal(mapCapabilityToChatSelection({ modelId: 'gpt-4.1-mini' }), null);
});

test('mapCapabilityToChatSelection maps known providers correctly', () => {
  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'openai', modelId: 'gpt-4.1-mini' }),
    { provider: 'openai', modelId: 'gpt-4.1-mini' },
  );

  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'aimlapi', modelId: 'gpt-5.1' }),
    { provider: 'aimlapi', modelId: 'gpt-5.1' },
  );

  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'llama', modelId: 'qwen2.5:latest' }),
    { provider: 'llama', modelId: 'qwen2.5:latest' },
  );

  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'vertex', modelId: 'gemini-2.5-flash' }),
    { provider: 'gemini', modelId: 'gemini-2.5-flash' },
  );

  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'gemini', modelId: 'gemini-2.5-pro' }),
    { provider: 'gemini', modelId: 'gemini-2.5-pro' },
  );
});

test('mapCapabilityToChatSelection defaults unknown providers to gemini', () => {
  assert.deepEqual(
    mapCapabilityToChatSelection({ provider: 'unknown', modelId: 'some-model' }),
    { provider: 'gemini', modelId: 'some-model' },
  );
});
