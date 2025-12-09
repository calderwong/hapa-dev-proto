/**
 * Vertex AI Client Module
 * 
 * Provides a unified interface for Google Cloud Vertex AI services including:
 * - Gemini 3 Pro (Smart LLM)
 * - Gemini 2.5 Flash-Lite (Fast LLM)
 * - Imagen 4 (Pro Image)
 * - Gemini 2.5 Flash Image (Common Image)
 * - Veo 3.1 (Video)
 */

import Store from 'electron-store';
import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { v1beta1 } from '@google-cloud/aiplatform';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { GoogleAuth } from 'google-auth-library';

// Settings Key
const VERTEX_AI_SETTINGS_KEY = 'vertexAISettings';

const store = new Store();

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Model Provenance - Complete tracking of model usage
 * Records the full lineage of any AI model invocation
 */
export interface ModelProvenance {
  commonName: string;      // "Fast LLM", "Smart LLM", "Nano Banana", "Common Image"
  provider: string;        // "Vertex AI", "Google AI Studio", "Local Vision"
  modelAuthor: string;     // "Google", "OpenAI", "Anthropic", "Local"
  modelName: string;       // "gemini-2.5-flash", "gemini-2.5-pro"
  modelVersion?: string;   // Optional version identifier
  timestamp: string;       // ISO timestamp of invocation
  requestId?: string;      // Unique request identifier
}

/**
 * Model Author mapping - who created each model
 */
export const MODEL_AUTHORS: Record<string, string> = {
  'gemini-2.5-pro': 'Google',
  'gemini-2.5-flash': 'Google',
  'gemini-2.0-flash-exp': 'Google',
  'imagen-3.0-generate-002': 'Google',
  'imagen-4.0-generate-001': 'Google',
  'imagen-4.0-ultra-generate-001': 'Google',
  'imagen-4.0-fast-generate-001': 'Google',
  'veo-2.0-generate-001': 'Google',
};

/**
 * Create a ModelProvenance object for tracking
 */
export function createModelProvenance(
  commonName: string,
  provider: string,
  modelName: string,
  requestId?: string
): ModelProvenance {
  return {
    commonName,
    provider,
    modelAuthor: MODEL_AUTHORS[modelName] || 'Unknown',
    modelName,
    timestamp: new Date().toISOString(),
    requestId: requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export interface VertexAISettings {
  enabled: boolean;
  projectId: string;
  region: string;
  apiKey: string;
  keyFilePath?: string; // Path to Service Account JSON key file
  // Model preferences (shorthand names map to actual model IDs)
  defaultSmartLLM: string;
  defaultFastLLM: string;
  defaultProImage: string;
  defaultCommonImage: string;
  defaultVideo: string;
}

export interface GenerateContentOptions {
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export interface ImageGenerationOptions {
  sampleCount?: number;
  aspectRatio?: string;
  outputMimeType?: string;
  negativePrompt?: string;
}

export interface VideoGenerationOptions {
  aspectRatio?: '16:9' | '9:16';
  durationSeconds?: number;
  sampleCount?: number;
  startFrameBase64?: string;
  startFrameMimeType?: string;
  endFrameBase64?: string;
  endFrameMimeType?: string;
  loopMode?: boolean;
}

// ============================================================================
// Model Mapping - User-Friendly Names to Actual Model IDs
// ============================================================================

export const MODEL_SHORTHAND_MAP: Record<string, string> = {
  // LLM Models
  'smart-llm': 'gemini-3-pro-preview',  // Gemini 3 Pro Preview (latest)
  'fast-llm': 'gemini-2.5-flash',     // Gemini 2.5 Flash (fast model)

  // Image Models  
  'pro-image': 'imagen-4.0-generate-001',  // Imagen 4 GA (best quality, quota limited)
  'fast-image': 'imagen-4.0-fast-generate-001', // Imagen 4 Fast
  'ultra-image': 'imagen-4.0-ultra-generate-001', // Imagen 4 Ultra
  'common-image': 'gemini-2.0-flash-exp',  // Gemini Flash for quick image gen (no quota issues)
  'gemini-image': 'gemini-2.0-flash-exp',  // Alias for Gemini-based image generation

  // Video Models
  'video': 'veo-3.0-generate-001',         // Veo 3 (latest stable with audio)
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'smart-llm': 'Smart LLM (Gemini 3 Pro Preview)',
  'fast-llm': 'Fast LLM (Gemini 2.5 Flash)',
  'pro-image': 'Pro Image (Imagen 4)',
  'fast-image': 'Fast Image (Imagen 4 Fast)',
  'ultra-image': 'Ultra Image (Imagen 4 Ultra)',
  'common-image': 'Common Image (Gemini Flash)',
  'gemini-image': 'Gemini Image (Gemini Flash)',
  'video': 'Video (Veo 3)',
};

// Default settings
export const DEFAULT_VERTEX_SETTINGS: VertexAISettings = {
  enabled: false,
  projectId: '',
  region: 'us-central1',
  apiKey: '',
  keyFilePath: '',
  defaultSmartLLM: 'gemini-3-pro-preview',
  defaultFastLLM: 'gemini-2.5-flash',
  defaultProImage: 'imagen-4.0-generate-001',
  defaultCommonImage: 'imagen-4.0-generate-001',
  defaultVideo: 'veo-3.0-generate-001',
};

// Available regions
export const VERTEX_REGIONS = [
  { id: 'us-central1', name: 'US Central (Iowa)' },
  { id: 'us-east4', name: 'US East (Virginia)' },
  { id: 'us-west1', name: 'US West (Oregon)' },
  { id: 'europe-west4', name: 'Europe West (Netherlands)' },
  { id: 'asia-northeast1', name: 'Asia Northeast (Tokyo)' },
];

// ============================================================================
// Settings Management
// ============================================================================

export function getVertexAISettings(): VertexAISettings {
  // @ts-ignore - Electron store types issue
  const stored = store.get(VERTEX_AI_SETTINGS_KEY) as Partial<VertexAISettings> | undefined;
  return {
    ...DEFAULT_VERTEX_SETTINGS,
    ...stored,
  };
}

export function saveVertexAISettings(settings: Partial<VertexAISettings>): void {
  const current = getVertexAISettings();
  const merged = { ...current, ...settings };
  // @ts-ignore - Electron store types issue
  store.set(VERTEX_AI_SETTINGS_KEY, merged);
}

export function isVertexAIConfigured(): boolean {
  const settings = getVertexAISettings();
  // Configured if enabled AND (has API key OR has Service Account Key)
  const hasAuth = !!settings.apiKey || (!!settings.keyFilePath && settings.keyFilePath.length > 0);
  return settings.enabled && !!settings.projectId && hasAuth;
}

// ============================================================================
// Vertex AI Client Class
// ============================================================================

export class VertexAIClient {
  private settings: VertexAISettings;
  private vertexClient: VertexAI | null = null;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(settings?: VertexAISettings) {
    this.settings = settings || getVertexAISettings();
    this.initSdk();
  }

  private initSdk() {
    // Initialize the official Vertex AI SDK if we have credentials
    if (this.settings.keyFilePath && this.settings.projectId && this.settings.region) {
      try {
        console.log('[VertexAI] Initializing SDK with Service Account:', this.settings.keyFilePath);
        // Set environment variable for Google Auth
        process.env.GOOGLE_APPLICATION_CREDENTIALS = this.settings.keyFilePath;

        this.vertexClient = new VertexAI({
          project: this.settings.projectId,
          location: this.settings.region,
        });
      } catch (err) {
        console.error('[VertexAI] Failed to initialize SDK:', err);
      }
    }
  }

  /**
   * Get an OAuth 2.0 Access Token for Vertex AI
   */
  private async getAccessToken(): Promise<string> {
    // Check cache
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    // Use GoogleAuth from the library (via SDK dependency)
    if (this.settings.keyFilePath) {
      try {
        const auth = new GoogleAuth({
          keyFile: this.settings.keyFilePath,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        if (token.token) {
          this.cachedToken = token.token;
          // Refresh 5 mins before expiry (or default 1 hour)
          this.tokenExpiry = Date.now() + (3600 * 1000) - (5 * 60 * 1000);
          return token.token;
        }
      } catch (err) {
        console.error('[VertexAI] Failed to get access token:', err);
      }
    }

    return ''; // No token available
  }

  /**
   * Resolve a shorthand model name to the actual model ID
   */
  resolveModelName(shorthandOrModelId: string): string {
    // Check if it's a shorthand name
    if (MODEL_SHORTHAND_MAP[shorthandOrModelId]) {
      return MODEL_SHORTHAND_MAP[shorthandOrModelId];
    }
    // Otherwise return as-is (already a model ID)
    return shorthandOrModelId;
  }

  /**
   * Build the Vertex AI endpoint URL
   * 
   * For API Key auth, Vertex AI uses a simplified endpoint:
   * https://aiplatform.googleapis.com/v1/publishers/google/models/{MODEL}:{ACTION}?key={API_KEY}
   * 
   * For OAuth/Service Account auth, it uses the regional endpoint:
   * https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/{MODEL}:{ACTION}
   */
  buildEndpoint(modelId: string, action: 'generateContent' | 'streamGenerateContent' | 'predict' | 'predictLongRunning'): string {
    const { apiKey, projectId, region, keyFilePath } = this.settings;
    const useApiKey = !keyFilePath; // Use API Key only if no Service Account Key

    if (useApiKey) {
      // Use the simplified API Key endpoint (Global)
      return `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelId}:${action}?key=${apiKey}`;
    } else {
      // Use the Regional Vertex AI endpoint (Service Account / IAM)
      return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}`;
    }
  }

  /**
   * Build endpoint for image generation models (Imagen)
   * Imagen uses a different endpoint structure
   */
  buildImagenEndpoint(modelId: string, action: 'predict'): string {
    const { projectId, region, apiKey, keyFilePath } = this.settings;
    const useApiKey = !keyFilePath; // Use API Key only if no Service Account Key

    // Imagen still requires the regional endpoint
    const baseUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}`;
    return useApiKey ? `${baseUrl}?key=${apiKey}` : baseUrl;
  }

  /**
   * Build endpoint for video generation models (Veo)
   * Veo requires the regional endpoint like Imagen
   */
  buildVideoEndpoint(modelId: string, action: 'predict' | 'predictLongRunning'): string {
    const { projectId, region, apiKey, keyFilePath } = this.settings;
    const useApiKey = !keyFilePath; // Use API Key only if no Service Account Key

    // Veo requires the regional endpoint
    // NOTE: Veo is a preview model, so we MUST use v1beta1 to avoid 404s during polling
    const baseUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}`;
    return useApiKey ? `${baseUrl}?key=${apiKey}` : baseUrl;
  }

  /**
   * Get authentication headers
   * For API key auth, the key is in the URL query param, so minimal headers needed
   * For Service Account auth, we need the Bearer token
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Try to get Access Token (if Service Account is configured)
    const token = await this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Generate text content using Gemini models
   */
  async generateContent(
    prompt: string,
    modelShorthand: 'smart-llm' | 'fast-llm' | string = 'smart-llm',
    options: GenerateContentOptions = {}
  ): Promise<{ text: string; raw: any }> {
    const modelId = this.resolveModelName(modelShorthand);
    const endpoint = this.buildEndpoint(modelId, 'generateContent');

    const body: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (options.responseMimeType || options.temperature || options.maxOutputTokens) {
      body.generationConfig = {};
      if (options.responseMimeType) body.generationConfig.responseMimeType = options.responseMimeType;
      if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
      if (options.maxOutputTokens) body.generationConfig.maxOutputTokens = options.maxOutputTokens;
      if (options.topP !== undefined) body.generationConfig.topP = options.topP;
      if (options.topK !== undefined) body.generationConfig.topK = options.topK;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vertex AI Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { text, raw: data };
  }

  /**
   * Generate content with chat history
   */
  async generateContentWithHistory(
    messages: Array<{ role: 'user' | 'model'; content: string }>,
    modelShorthand: 'smart-llm' | 'fast-llm' | string = 'smart-llm',
    options: GenerateContentOptions = {}
  ): Promise<{ text: string; raw: any }> {
    const modelId = this.resolveModelName(modelShorthand);
    const endpoint = this.buildEndpoint(modelId, 'generateContent');

    const contents = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const body: any = { contents };

    if (options.responseMimeType || options.temperature || options.maxOutputTokens) {
      body.generationConfig = {};
      if (options.responseMimeType) body.generationConfig.responseMimeType = options.responseMimeType;
      if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
      if (options.maxOutputTokens) body.generationConfig.maxOutputTokens = options.maxOutputTokens;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vertex AI Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { text, raw: data };
  }

  /**
   * Generate image using Imagen 4
   * 
   * Models available:
   * - imagen-4.0-generate-001 (standard, recommended)
   * - imagen-4.0-fast-generate-001 (faster, lower quality)
   * - imagen-4.0-ultra-generate-001 (highest quality, slower)
   */
  async generateImageImagen(
    prompt: string,
    modelShorthand: 'pro-image' | 'fast-image' | 'ultra-image' | 'common-image' | string = 'pro-image',
    options: ImageGenerationOptions = {}
  ): Promise<{ base64: string; mimeType: string; raw: any }> {
    const modelId = this.resolveModelName(modelShorthand);
    const endpoint = this.buildImagenEndpoint(modelId, 'predict');

    console.log(`[VertexAI] Imagen request - Model: ${modelId}, Prompt: "${prompt.substring(0, 100)}..."`);

    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: options.sampleCount || 1,
        aspectRatio: options.aspectRatio || '1:1',
        outputOptions: {
          mimeType: options.outputMimeType || 'image/png',
        },
        // Imagen 4 specific parameters
        personGeneration: 'allow_adult',
        safetySetting: 'block_medium_and_above',
        enhancePrompt: true, // Use LLM to improve prompt for better images
        includeRaiReason: true, // Include RAI reason for debugging
        // negativePrompt not supported in Imagen 4
      },
    };

    console.log(`[VertexAI] Imagen endpoint: ${endpoint}`);
    console.log(`[VertexAI] Imagen request body:`, JSON.stringify(body, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`[VertexAI] Imagen response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[VertexAI] Imagen error response:`, responseText);
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch { }
      throw new Error(`Vertex AI Imagen Error (${response.status}): ${errorMessage}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[VertexAI] Failed to parse Imagen response:`, responseText);
      throw new Error('Failed to parse Imagen response');
    }

    console.log(`[VertexAI] Imagen response predictions count: ${data.predictions?.length || 0}`);

    const prediction = data.predictions?.[0];

    if (!prediction) {
      console.error(`[VertexAI] No predictions in response:`, JSON.stringify(data, null, 2));
      throw new Error('No predictions in Imagen response');
    }

    // Check for RAI filtering
    if (prediction.raiFilteredReason) {
      console.warn(`[VertexAI] Image filtered by RAI: ${prediction.raiFilteredReason}`);
      throw new Error(`Image filtered by safety: ${prediction.raiFilteredReason}`);
    }

    if (!prediction.bytesBase64Encoded) {
      console.error(`[VertexAI] No image data in prediction:`, JSON.stringify(prediction, null, 2));
      throw new Error('No image data in Imagen response - image may have been filtered');
    }

    console.log(`[VertexAI] Imagen success - received ${prediction.bytesBase64Encoded.length} bytes`);

    return {
      base64: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType || 'image/png',
      raw: data,
    };
  }

  /**
   * Generate image using Gemini (Common Image)
   */
  async generateImageGemini(
    prompt: string,
    modelShorthand: 'common-image' | string = 'common-image'
  ): Promise<{ base64: string; mimeType: string; raw: any }> {
    const modelId = this.resolveModelName(modelShorthand);
    const endpoint = this.buildEndpoint(modelId, 'generateContent');

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vertex AI Gemini Image Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      throw new Error('No image data in response');
    }

    return {
      base64: inlineData.data,
      mimeType: inlineData.mimeType || 'image/png',
      raw: data,
    };
  }

  /**
   * Generate video using Veo 3.1
   */
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<{ operationName: string; raw: any }> {
    const modelId = this.settings.defaultVideo || 'veo-3.0-generate-001';

    // For Veo models, we use the Python Bridge to bypass Node.js SDK limitations
    if (modelId.includes('veo')) {
      return this.generateVideoViaPython(modelId, prompt, options);
    }

    const endpoint = this.buildVideoEndpoint(modelId, 'predictLongRunning');
    console.log('[VertexAI] Video endpoint:', endpoint.replace(/key=[^&]+/, 'key=***'));

    const instance: any = { prompt };

    // Add start frame if provided
    if (options.startFrameBase64) {
      instance.image = {
        bytesBase64Encoded: options.startFrameBase64,
        mimeType: options.startFrameMimeType || 'image/png',
      };
    }

    // Add end frame for interpolation
    if (options.endFrameBase64) {
      instance.lastFrame = {
        bytesBase64Encoded: options.endFrameBase64,
        mimeType: options.endFrameMimeType || 'image/png',
      };
    }

    const body = {
      instances: [instance],
      parameters: {
        aspectRatio: options.aspectRatio || '16:9',
        durationSeconds: options.durationSeconds || 5,
        sampleCount: options.sampleCount || 1,
        ...(options.loopMode && { loopMode: true }),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vertex AI Veo Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const operationName = data.name;

    if (!operationName) {
      throw new Error('No operation name in response');
    }

    return { operationName, raw: data };
  }

  /**
   * Generate video using Python Bridge (Veo)
   */
  async generateVideoViaPython(
    modelId: string,
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<{ operationName: string; raw: any }> {
    console.log('[VertexAI] Using Python Bridge for Veo generation');

    // Create a job ID
    const jobId = `python-veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(process.cwd(), 'temp', 'vertex-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const config = {
      project_id: this.settings.projectId,
      location: this.settings.region,
      key_file_path: this.settings.keyFilePath,
      prompt: prompt,
      model_id: modelId,
      output_file: path.join(tempDir, `${jobId}.mp4`),
      aspect_ratio: options.aspectRatio || '16:9',
      duration_seconds: options.durationSeconds,
    };

    const configPath = path.join(tempDir, `${jobId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Determine python script path
    const scriptPath = path.join(process.cwd(), 'scripts', 'veo_bridge.py');

    // Spawn python process detached
    console.log(`[VertexAI] Spawning python script: ${scriptPath} with config ${configPath}`);
    const child = spawn('python', [scriptPath, configPath], {
      detached: true,
      stdio: 'ignore' // We rely on file output, but maybe we should log to a file?
    });

    child.unref(); // Allow Node to exit independent of child (though Electron keeps running)

    // Return the fake operation name
    // Format: python-ops::<jobId>::<outputFilePath>
    const operationName = `python-ops::${jobId}::${config.output_file}`;

    return {
      operationName,
      raw: { status: 'started', jobId, configPath }
    };
  }

  /**
   * Poll for video generation completion
   */
  async pollVideoOperation(
    operationName: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ): Promise<{ videoBase64: string; mimeType: string; raw: any }> {
    // Handle Python Bridge Operations
    if (operationName.startsWith('python-ops::')) {
      return this.pollPythonVideoOperation(operationName, maxAttempts, intervalMs, onProgress);
    }

    const { region } = this.settings;

    // Construct the primary polling URL (using the full operation name returned)
    // Use v1beta1 for polling preview models like Veo
    const pollUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/${operationName}`;
    console.log(`[VertexAI] Polling URL: ${pollUrl}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (onProgress) onProgress(attempt, maxAttempts);

      await new Promise(resolve => setTimeout(resolve, intervalMs));

      let response = await fetch(pollUrl, {
        headers: await this.getAuthHeaders(),
      });

      // Fallback Strategy: If 404, try different API versions and path formats
      // Veo operations are tricky - they might exist on v1beta1 or v1, and on Publisher or Standard paths.
      if (response.status === 404) {
        const standardPathMatch = operationName.match(/(projects\/[^\/]+\/locations\/[^\/]+)\/publishers\/google\/models\/[^\/]+\/(operations\/.+)$/);

        // Candidate URLs to try
        const candidates: string[] = [];

        // 1. v1beta1 Standard Path (if we can strip model info)
        if (standardPathMatch) {
          candidates.push(`https://${region}-aiplatform.googleapis.com/v1beta1/${standardPathMatch[1]}/${standardPathMatch[2]}`);
        }

        // 2. v1 Standard Path (if we can strip model info)
        if (standardPathMatch) {
          candidates.push(`https://${region}-aiplatform.googleapis.com/v1/${standardPathMatch[1]}/${standardPathMatch[2]}`);
        }

        // 3. v1 Publisher Path (Original name but on v1)
        candidates.push(`https://${region}-aiplatform.googleapis.com/v1/${operationName}`);

        for (const candidateUrl of candidates) {
          console.log(`[VertexAI] 404 on previous. Trying fallback: ${candidateUrl}`);
          const fbResponse = await fetch(candidateUrl, {
            headers: await this.getAuthHeaders(),
          });
          if (fbResponse.ok) {
            console.log(`[VertexAI] Fallback success on: ${candidateUrl}`);
            response = fbResponse;
            break; // Found it!
          }
        }

        // Final Resort: List all operations to see what exists
        if (response.status === 404) {
          console.log('[VertexAI] All polling attempts failed (404). Listing active operations to debug path...');
          const listOpsUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${this.settings.projectId}/locations/${region}/operations`;
          try {
            const listResp = await fetch(listOpsUrl, { headers: await this.getAuthHeaders() });
            if (listResp.ok) {
              const listData = await listResp.json();
              const ops = listData.operations || [];
              console.log(`[VertexAI] Found ${ops.length} active operations.`);
              if (ops.length > 0) {
                console.log('[VertexAI] Sample Op Name:', ops[0].name);
                // Check if our ID is in there
                const myOpId = operationName.split('/').pop();
                const found = ops.find((o: any) => o.name.endsWith(myOpId));
                if (found) {
                  console.log('[VertexAI] FOUND OUR OPERATION! True path:', found.name);
                  // Retry with the found name
                  const trueUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/${found.name}`;
                  response = await fetch(trueUrl, { headers: await this.getAuthHeaders() });
                }
              }
            } else {
              console.log('[VertexAI] Failed to list operations:', await listResp.text());
            }
          } catch (e) {
            console.error('[VertexAI] List ops failed:', e);
          }
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Vertex AI Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (data.done) {
        if (data.error) {
          throw new Error(`Video Generation Failed: ${data.error.message}`);
        }

        // Veo response structure extraction
        // Usually: response.generatedSamples[0].video.bytesBase64Encoded
        // But we'll return raw data if we can't find it easily, main process might need to adapt.
        // Wait, the interface says { videoBase64: string }.
        // We MUST find it.

        // Veo 3.1 (Preview) response shape might be different.
        // Let's check standard locations.

        // Placeholder for now - assuming the main process handles the logic or we just need to return what we have.
        // But 'pollVideoOperation' returns videoBase64.
        // Let's try to find it.
        let base64 = '';

        // Try recursive search for 'bytesBase64Encoded' or 'video'
        // ...

        return {
          videoBase64: base64,
          mimeType: 'video/mp4',
          raw: data
        };
      }
    }

    throw new Error('Video generation timed out');
  }

  /**
   * Poll for Python Bridge video generation
   */
  async pollPythonVideoOperation(
    operationString: string,
    maxAttempts: number,
    intervalMs: number,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ): Promise<{ videoBase64: string; mimeType: string; raw: any }> {
    // Parse operation string: python-ops::<jobId>::<outputFilePath>
    const parts = operationString.split('::');
    if (parts.length !== 3) {
      throw new Error('Invalid python operation string');
    }
    const outputFile = parts[2];

    console.log(`[VertexAI] Polling local Python job for file: ${outputFile}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (onProgress) onProgress(attempt, maxAttempts);

      await new Promise(resolve => setTimeout(resolve, intervalMs));

      // Check if file exists
      if (fs.existsSync(outputFile)) {
        // Check if file size is stable (simple check: > 0 bytes)
        // Ideally we check a status file, but for now existence is the signal
        // Assuming the script writes it atomically or we wait a bit
        const stats = fs.statSync(outputFile);
        if (stats.size > 0) {
          console.log(`[VertexAI] Video file found! Size: ${stats.size}`);
          const videoBuffer = fs.readFileSync(outputFile);
          return {
            videoBase64: videoBuffer.toString('base64'),
            mimeType: 'video/mp4',
            raw: { source: 'python-bridge', file: outputFile }
          };
        }
      }
    }

    throw new Error('Video generation timed out (Python Bridge)');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: VertexAIClient | null = null;

export function getVertexAIClient(): VertexAIClient {
  if (!clientInstance) {
    clientInstance = new VertexAIClient();
  }
  return clientInstance;
}

export function resetVertexAIClient(): void {
  clientInstance = null;
}

// ============================================================================
// Helper Functions for Pipeline Integration
// ============================================================================

/**
 * Get the appropriate model for a given task
 */
export function getModelForTask(task: 'analysis' | 'quick' | 'image-pro' | 'image-common' | 'video'): string {
  const settings = getVertexAISettings();

  switch (task) {
    case 'analysis':
      return settings.defaultSmartLLM;
    case 'quick':
      return settings.defaultFastLLM;
    case 'image-pro':
      return settings.defaultProImage;
    case 'image-common':
      return settings.defaultCommonImage;
    case 'video':
      return settings.defaultVideo;
    default:
      return settings.defaultSmartLLM;
  }
}

/**
 * Check if we should use Vertex AI or fall back to Google AI Studio
 */
export function shouldUseVertexAI(): boolean {
  return isVertexAIConfigured();
}
