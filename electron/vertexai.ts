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

const store: any = new Store();
const VERTEX_AI_SETTINGS_KEY = 'vertexAISettings';

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
  const stored = store.get(VERTEX_AI_SETTINGS_KEY) as Partial<VertexAISettings> | undefined;
  return {
    ...DEFAULT_VERTEX_SETTINGS,
    ...stored,
  };
}

export function saveVertexAISettings(settings: Partial<VertexAISettings>): void {
  const current = getVertexAISettings();
  const merged = { ...current, ...settings };
  store.set(VERTEX_AI_SETTINGS_KEY, merged);
}

export function isVertexAIConfigured(): boolean {
  const settings = getVertexAISettings();
  return settings.enabled && !!settings.projectId && !!settings.apiKey;
}

// ============================================================================
// Vertex AI Client Class
// ============================================================================

export class VertexAIClient {
  private settings: VertexAISettings;

  constructor(settings?: VertexAISettings) {
    this.settings = settings || getVertexAISettings();
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
    const { apiKey } = this.settings;
    
    // Use the simplified API Key endpoint (no region/project in URL)
    const baseUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelId}:${action}`;
    return `${baseUrl}?key=${apiKey}`;
  }

  /**
   * Build endpoint for image generation models (Imagen)
   * Imagen uses a different endpoint structure
   */
  buildImagenEndpoint(modelId: string, action: 'predict'): string {
    const { projectId, region, apiKey } = this.settings;
    // Imagen still requires the regional endpoint
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}?key=${apiKey}`;
  }

  /**
   * Build endpoint for video generation models (Veo)
   * Veo requires the regional endpoint like Imagen
   */
  buildVideoEndpoint(modelId: string, action: 'predict' | 'predictLongRunning'): string {
    const { projectId, region, apiKey } = this.settings;
    // Veo requires the regional endpoint
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}?key=${apiKey}`;
  }

  /**
   * Get authentication headers
   * For API key auth, the key is in the URL query param, so minimal headers needed
   */
  getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
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
      headers: this.getAuthHeaders(),
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
      headers: this.getAuthHeaders(),
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
    const endpoint = this.buildEndpoint(modelId, 'predict');

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
      headers: this.getAuthHeaders(),
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
      } catch {}
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
      headers: this.getAuthHeaders(),
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
    // Veo requires the regional endpoint, not the simplified one
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
      headers: this.getAuthHeaders(),
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
   * Poll for video generation completion
   */
  async pollVideoOperation(
    operationName: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ): Promise<{ videoBase64: string; mimeType: string; raw: any }> {
    const { region } = this.settings;
    const pollUrl = `https://${region}-aiplatform.googleapis.com/v1/${operationName}`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (onProgress) onProgress(attempt, maxAttempts);

      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const response = await fetch(pollUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        console.warn(`Poll attempt ${attempt + 1} failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.done) {
        if (data.error) {
          throw new Error(`Video generation failed: ${data.error.message}`);
        }

        const videoData = data.response?.predictions?.[0];
        if (!videoData?.bytesBase64Encoded) {
          throw new Error('No video data in completed response');
        }

        return {
          videoBase64: videoData.bytesBase64Encoded,
          mimeType: videoData.mimeType || 'video/mp4',
          raw: data,
        };
      }
    }

    throw new Error('Video generation timed out');
  }

  /**
   * Test connection to Vertex AI
   */
  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      // Try a simple generateContent call
      const result = await this.generateContent('Say "Hello from Vertex AI" in exactly those words.', 'fast-llm');
      
      return {
        success: true,
        message: `Connected successfully. Response: ${result.text.substring(0, 100)}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Unknown error',
      };
    }
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
