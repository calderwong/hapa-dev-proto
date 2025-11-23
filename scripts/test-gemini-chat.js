/*
 * Simple Gemini Chat smoke test for Hapa AG.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/test-gemini-chat.js
 *
 * This does NOT use the Electron store; it talks directly to Gemini using
 * the API key from the environment. It is intended as a quick connectivity
 * check and reference for payload shape.
 */

/* eslint-disable no-console */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY environment variable.');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = 'Hello from Hapa AG gemini-integration smoke test.';

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text?.() ?? '';

  console.log('Gemini response:\n');
  console.log(String(text).trim());
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
