/**
 * Test Kling AI video model on AIMLAPI - might have faster queue than Veo
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

// Test with Kling AI model
async function testKlingVideo() {
  console.log('Testing Kling AI video generation...\n');
  
  const body = {
    model: 'kling-video/v1/standard/image-to-video',
    prompt: 'A gentle camera zoom with soft lighting',
    image_url: 'https://s2-111386.kwimgs.com/bs2/mmu-aiplatform-temp/kling/20240620/1.jpeg',
    duration: '5',
    aspect_ratio: '16:9',
  };
  
  console.log('Request:', JSON.stringify(body, null, 2));
  
  const response = await fetch(`${BASE_URL}/video/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  console.log(`\nResponse (${response.status}):`, JSON.stringify(data, null, 2));
  
  if (data.id) {
    console.log('\nPolling for completion...');
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const pollResp = await fetch(`${BASE_URL}/video/generations?generation_id=${data.id}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });
      const pollData = await pollResp.json();
      console.log(`  Attempt ${i+1}: status="${pollData.status}"`);
      if (pollData.status === 'completed') {
        console.log(`\n🎉 VIDEO COMPLETE: ${pollData.video?.url}`);
        return;
      }
      if (pollData.status === 'failed') {
        console.log(`\n❌ FAILED: ${pollData.error}`);
        return;
      }
    }
  }
}

testKlingVideo().catch(console.error);
