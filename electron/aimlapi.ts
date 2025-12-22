import Store from 'electron-store';

// @ts-ignore
const store = new Store();

export interface AimlApiSettings {
  apiKey: string;
  baseUrl: string;
}

export const DEFAULT_AIMLAPI_SETTINGS: AimlApiSettings = {
  apiKey: '',
  baseUrl: 'https://api.aimlapi.com/v1',
};

// ============================================================================
// AIMLAPI Model Mappings for Hell Week Pipeline
// ============================================================================

/**
 * Maps our internal shorthand names to AIMLAPI model IDs
 * AIMLAPI uses "provider/model" format for most models
 */
export const AIMLAPI_MODEL_MAP: Record<string, string> = {
  // LLM Models
  'smart-llm': 'google/gemini-3-pro-preview',    // Gemini 3 Pro via AIMLAPI
  'fast-llm': 'google/gemini-2.5-flash',         // Gemini 2.5 Flash via AIMLAPI
  
  // Fallbacks / Alternatives
  'gpt-4o': 'openai/gpt-4o',
  'claude-sonnet': 'anthropic/claude-sonnet-4',
};

/**
 * Check if AIMLAPI is configured with a valid API key
 */
export function isAimlApiConfigured(): boolean {
  // @ts-ignore
  const settings = store.get('settings') as any || {};
  return !!settings.aimlapiKey && settings.aimlapiKey.length > 0;
}

/**
 * Get the AIMLAPI key from settings
 */
export function getAimlApiKey(): string {
  // @ts-ignore
  const settings = store.get('settings') as any || {};
  return settings.aimlapiKey || '';
}

export class AimlApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = getAimlApiKey();
    this.baseUrl = 'https://api.aimlapi.com/v1';
  }

  /**
   * Refresh the API key from settings (call if settings may have changed)
   */
  refreshApiKey(): void {
    this.apiKey = getAimlApiKey();
  }

  /**
   * Check if the client has a valid API key
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Resolve a shorthand model name to AIMLAPI model ID
   */
  resolveModelName(shorthandOrModelId: string): string {
    if (AIMLAPI_MODEL_MAP[shorthandOrModelId]) {
      return AIMLAPI_MODEL_MAP[shorthandOrModelId];
    }
    // If it already looks like a full model ID (contains /), use as-is
    if (shorthandOrModelId.includes('/')) {
      return shorthandOrModelId;
    }
    // Otherwise prefix with google/ as a reasonable default
    return `google/${shorthandOrModelId}`;
  }

  /**
   * List available models from AIMLAPI.com
   */
  async listModels(): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[AIMLAPI] Error listing models:', error);
      return [];
    }
  }

  /**
   * Chat Completion (OpenAI Compatible)
   */
  async chatCompletion(
    messages: Array<{ role: string; content: any }>,
    model: string,
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
    } = {}
  ): Promise<{ content: string; raw: any }> {
    if (!this.apiKey) {
      throw new Error('AIMLAPI Key not configured');
    }

    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AIMLAPI Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      raw: data,
    };
  }

  // ============================================================================
  // Video Generation (Veo 3.1 via AIMLAPI)
  // ============================================================================

  /**
   * Generate a video using Veo 3.1 with first/last frame images for seamless loops
   * @param prompt Text description of the video to generate
   * @param options Video generation options
   * @returns Generation ID for polling
   */
  async generateVideo(
    prompt: string,
    options: {
      imageUrl?: string;           // URL or base64 data URI for first frame
      lastImageUrl?: string;       // URL or base64 data URI for last frame (for loops)
      aspectRatio?: '16:9' | '9:16';
      duration?: number;           // 5 or 8 seconds
      resolution?: '720P' | '1080P';  // Must be uppercase per AIMLAPI API
      generateAudio?: boolean;
    } = {}
  ): Promise<{ generationId: string; raw: any }> {
    if (!this.apiKey) {
      throw new Error('AIMLAPI Key not configured');
    }

    // Use Veo 3.0 image-to-video when image provided, otherwise text-to-video
    const model = options.imageUrl ? 'google/veo-3.0-i2v' : 'google/veo-3.0-generate';

    const body: any = {
      model,
      prompt,
      aspect_ratio: options.aspectRatio || '16:9',
      duration: options.duration || 8,
      resolution: (options.resolution || '720P').toUpperCase() as '720P' | '1080P',
      generate_audio: options.generateAudio ?? true,
    };

    // AIMLAPI accepts base64 images - format varies by whether it's a data URI or raw
    if (options.imageUrl) {
      body.image_url = options.imageUrl;
    }
    if (options.lastImageUrl) {
      body.last_image_url = options.lastImageUrl;
    }

    console.log(`[AIMLAPI] Starting video generation with model: ${model}`);

    const response = await fetch(`${this.baseUrl.replace('/v1', '/v2')}/video/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AIMLAPI Video Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log(`[AIMLAPI] Video generation response:`, JSON.stringify(data, null, 2));
    
    if (!data.id) {
      throw new Error(`AIMLAPI Video generation failed - no ID returned: ${JSON.stringify(data)}`);
    }
    
    console.log(`[AIMLAPI] Video generation started, ID: ${data.id}`);
    
    return {
      generationId: data.id,
      raw: data,
    };
  }

  /**
   * Poll for video generation completion
   * @param generationId The generation ID from generateVideo
   * @param maxAttempts Maximum polling attempts (default 60)
   * @param intervalMs Polling interval in ms (default 10000 = 10s)
   * @returns Video URL and metadata when complete
   */
  async pollVideoGeneration(
    generationId: string,
    maxAttempts: number = 60,
    intervalMs: number = 10000
  ): Promise<{ videoUrl: string; duration: number; raw: any }> {
    if (!this.apiKey) {
      throw new Error('AIMLAPI Key not configured');
    }

    const pollUrl = `${this.baseUrl.replace('/v1', '/v2')}/video/generations?generation_id=${generationId}`;
    console.log(`[AIMLAPI] Poll URL: ${pollUrl}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`[AIMLAPI] Polling video generation (attempt ${attempt + 1}/${maxAttempts})...`);

      const response = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': '*/*',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AIMLAPI Poll Error (${response.status}): ${errText}`);
      }

      const data = await response.json();

      // Debug: Log the actual response status
      console.log(`[AIMLAPI] Poll response - status: "${data.status}", keys: ${Object.keys(data).join(', ')}`);

      // Check for completion - AIMLAPI uses "completed" or "complete"
      if (data.status === 'completed' || data.status === 'complete') {
        console.log(`[AIMLAPI] Video generation complete!`);
        return {
          videoUrl: data.video?.url || data.url,
          duration: data.video?.duration || data.duration || 8,
          raw: data,
        };
      }

      // Check for failure
      if (data.status === 'failed' || data.status === 'error' || data.error) {
        throw new Error(`AIMLAPI Video generation failed: ${data.error || data.message || JSON.stringify(data)}`);
      }

      // These are valid "in progress" statuses per AIMLAPI docs
      const inProgressStatuses = ['waiting', 'active', 'queued', 'generating', 'pending', 'processing'];
      if (!inProgressStatuses.includes(data.status)) {
        // Unknown status - log it but continue polling
        console.warn(`[AIMLAPI] Unknown status: "${data.status}" - continuing to poll`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`AIMLAPI Video generation timed out after ${maxAttempts} attempts`);
  }

  /**
   * Generate video and wait for completion (convenience method)
   */
  async generateVideoAndWait(
    prompt: string,
    options: {
      imageUrl?: string;
      lastImageUrl?: string;
      aspectRatio?: '16:9' | '9:16';
      duration?: number;
      resolution?: '720P' | '1080P';  // Must be uppercase per AIMLAPI API
      generateAudio?: boolean;
      maxAttempts?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<{ videoUrl: string; duration: number; generationId: string; raw: any }> {
    const { generationId, raw: startRaw } = await this.generateVideo(prompt, options);
    const { videoUrl, duration, raw: pollRaw } = await this.pollVideoGeneration(
      generationId,
      options.maxAttempts || 60,
      options.pollIntervalMs || 10000
    );
    return { videoUrl, duration, generationId, raw: { start: startRaw, poll: pollRaw } };
  }
}

export const aimlApiClient = new AimlApiClient();
