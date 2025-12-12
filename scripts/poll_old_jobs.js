/**
 * Poll old AIMLAPI job IDs to check their status
 */

const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (process.env.AIMLAPI_KEY) return process.env.AIMLAPI_KEY;
  const configPath = path.join(process.env.APPDATA || '', 'hapa-ag', 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.settings?.aimlapiKey;
  } catch (e) { return null; }
}

const API_KEY = getApiKey();
const BASE_URL = 'https://api.aimlapi.com/v2';

// Old job IDs from previous tests
const OLD_JOB_IDS = [
  '-zRTrWQv3DLce5qKCWP87',  // From earlier app test (Veo 3.1)
  'SgkcNlTYHlovI2o9eIjKt',  // From test script (Veo 3.0 data URI)
  'pyDpP6yRxw-8y01wPPUqW',  // From test script (Veo 3.0 public URL)
  '4Gk9cyv486kGfjPmpxhu_',  // Test script (Veo 3.0 data URI)
  'xKodSgWx-SMzAHAh0GxTe',  // Kling AI test
];

async function pollJob(generationId) {
  const response = await fetch(`${BASE_URL}/video/generations?generation_id=${generationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': '*/*',
    },
  });
  return response.json();
}

async function main() {
  console.log('Polling old AIMLAPI job IDs...\n');
  
  for (const jobId of OLD_JOB_IDS) {
    console.log(`Job ID: ${jobId}`);
    try {
      const data = await pollJob(jobId);
      console.log(`  Status: ${data.status}`);
      if (data.video?.url) {
        console.log(`  ✅ VIDEO URL: ${data.video.url}`);
      }
      if (data.error) {
        console.log(`  ❌ Error: ${data.error}`);
      }
      console.log(`  Full response: ${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      console.log(`  Error polling: ${e.message}`);
    }
    console.log('');
  }
}

main();
