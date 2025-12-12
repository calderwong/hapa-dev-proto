/**
 * AIMLAPI Video Generation Test Script
 * 
 * Self-contained test to validate video generation with different image formats.
 * Run with: node scripts/test_aimlapi_video.js
 * 
 * Requires AIMLAPI_KEY environment variable or will read from electron-store.
 */

const fs = require('fs');
const path = require('path');

// Try to get API key from electron-store config
function getApiKey() {
  // First check environment variable
  if (process.env.AIMLAPI_KEY) {
    return process.env.AIMLAPI_KEY;
  }
  
  // Try to read from electron-store config file
  const configPaths = [
    path.join(process.env.APPDATA || '', 'hapa-ag', 'config.json'),
    path.join(process.env.HOME || '', '.config', 'hapa-ag', 'config.json'),
  ];
  
  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.settings?.aimlapiKey) {
          return config.settings.aimlapiKey;
        }
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  return null;
}

const API_KEY = getApiKey();
const BASE_URL = 'https://api.aimlapi.com/v2';

// Test image - small 100x100 red square PNG
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AwMFAoqKQMvNwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAPklEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYMsAAB/TmPdwAAAABJRU5ErkJggg==';

async function testTextToVideo() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: Text-to-Video (no image)`);
  console.log(`${'='.repeat(60)}`);
  
  const body = {
    model: 'google/veo-3.0-generate',  // Text-to-video model
    prompt: 'A red square slowly rotating in space with soft lighting',
    aspect_ratio: '16:9',
    duration: 4,  // Shortest duration to test faster
    resolution: '720P',
    generate_audio: false,
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ FAILED (${response.status}):`, JSON.stringify(data, null, 2));
      return { success: false, error: data };
    }
    
    console.log(`✅ SUCCESS - Generation ID: ${data.id}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    return { success: true, generationId: data.id, data };
    
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testVideoGeneration(imageFormat, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${description}`);
  console.log(`${'='.repeat(60)}`);
  
  const body = {
    model: 'google/veo-3.0-i2v',
    prompt: 'A gentle camera zoom on a red square',
    aspect_ratio: '16:9',
    duration: 8,  // Must be 4, 6, or 8
    resolution: '720P',
    generate_audio: false,
    image_url: imageFormat,
  };
  
  console.log('Request body:', JSON.stringify({ ...body, image_url: body.image_url.substring(0, 50) + '...' }, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ FAILED (${response.status}):`, JSON.stringify(data, null, 2));
      return { success: false, error: data };
    }
    
    console.log(`✅ SUCCESS - Generation ID: ${data.id}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    return { success: true, generationId: data.id, data };
    
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
    return { success: false, error: error.message };
  }
}

async function pollForCompletion(generationId, maxAttempts = 30) {
  console.log(`\nPolling for completion (ID: ${generationId})...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/video/generations?generation_id=${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': '*/*',
        },
      });
      
      const data = await response.json();
      console.log(`  Attempt ${attempt}/${maxAttempts}: status="${data.status}"`);
      
      if (data.status === 'completed' || data.status === 'complete') {
        console.log(`\n🎉 VIDEO COMPLETE!`);
        console.log(`   URL: ${data.video?.url || data.url}`);
        return { success: true, data };
      }
      
      if (data.status === 'failed' || data.error) {
        console.log(`\n❌ GENERATION FAILED:`, data.error || data);
        return { success: false, data };
      }
      
      // Wait 10 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      console.log(`  Attempt ${attempt} error:`, error.message);
    }
  }
  
  console.log(`\n⏰ TIMEOUT after ${maxAttempts} attempts`);
  return { success: false, timeout: true };
}

async function main() {
  console.log('AIMLAPI Video Generation Test');
  console.log('==============================\n');
  
  if (!API_KEY) {
    console.error('ERROR: No API key found!');
    console.error('Set AIMLAPI_KEY environment variable or configure in app settings.');
    process.exit(1);
  }
  
  console.log(`API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);
  
  // Test text-to-video first (no image) to verify API is working
  console.log('\n--- Testing TEXT-TO-VIDEO first (no image) ---');
  const t2vResult = await testTextToVideo();
  if (t2vResult.success && t2vResult.generationId) {
    const pollResult = await pollForCompletion(t2vResult.generationId, 20);
    if (pollResult.success) {
      console.log('\n✅ Text-to-video works! Now testing image formats...');
    }
  }
  
  // Test different image formats
  const formats = [
    {
      description: 'Data URI with image/png',
      format: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
    },
    {
      description: 'Public URL (Mona Lisa)',
      format: 'https://s2-111386.kwimgs.com/bs2/mmu-aiplatform-temp/kling/20240620/1.jpeg',
    },
  ];
  
  const results = [];
  
  for (const { description, format } of formats) {
    const result = await testVideoGeneration(format, description);
    results.push({ description, ...result });
    
    // If successful, try polling for completion
    if (result.success && result.generationId) {
      const pollResult = await pollForCompletion(result.generationId);
      results[results.length - 1].pollResult = pollResult;
      
      // If we got a working format, stop testing
      if (pollResult.success) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('FOUND WORKING FORMAT!');
        console.log(`Format: ${description}`);
        console.log(`${'='.repeat(60)}`);
        break;
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  for (const r of results) {
    const status = r.success ? (r.pollResult?.success ? '✅ COMPLETE' : '⏳ QUEUED') : '❌ FAILED';
    console.log(`${status} - ${r.description}`);
  }
}

main().catch(console.error);
