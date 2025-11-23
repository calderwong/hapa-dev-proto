/*
 * Simple OpenAI Chat Completions smoke test for Hapa AG.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/test-openai-chat.js
 *
 * This does NOT use the Electron store; it talks directly to OpenAI using
 * the API key from the environment. It is intended as a quick connectivity
 * check and reference for payload shape.
 */

/* eslint-disable no-console */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  const payload = {
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello from Hapa AG openai-integration smoke test.' },
    ],
    temperature: 0.3,
    max_tokens: 64,
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('OpenAI error:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  console.log('OpenAI response:\n');
  console.log(text.trim());
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
