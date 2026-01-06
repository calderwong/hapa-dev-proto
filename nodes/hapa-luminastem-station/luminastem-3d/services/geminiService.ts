
import { MATH_EXPLANATION_prompt } from "../constants";
import { FormationConfig, AudioStem, PromptPack, VibeVector, AIProposal, AI_VibeLabel, ShowScriptV1 } from "../types";
import { sessionService } from "./sessionService";
import { v4 as uuidv4 } from 'uuid';
import { audioService } from "./audioService";

class GeminiService {
  private async generateContent(args: { model: string; contents: any; config?: any }): Promise<{ text?: string }> {
    const res = await fetch('/__hapa/luminastem/v1/gemini/generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini proxy error (${res.status}): ${detail}`);
    }

    const data = await res.json().catch(() => ({}));
    return { text: data?.text };
  }

  private createPack(purpose: string, model: string, config: any, input: string, output: string): PromptPack {
      return {
          id: uuidv4(),
          created_at: Date.now(),
          model,
          config,
          input,
          output,
          purpose
      };
  }

  async getMathExplanation(context: string): Promise<string> {
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `Context: ${context}. Provide a short, fascinating mathematical or physics fact about this audio visualization process. Keep it under 40 words.`;
      const config = {
          systemInstruction: MATH_EXPLANATION_prompt,
          temperature: 0.7,
      };

      const response = await this.generateContent({
        model,
        contents: prompt,
        config
      });
      
      const text = response.text || "Calculating telemetry...";
      
      // Log PromptPack
      const pack = this.createPack("MATH_EXPLANATION", model, config, prompt, text);
      sessionService.addPromptPack(pack);
      sessionService.logEvent('AI_INSIGHT', { packId: pack.id }, 'AI');

      return text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Telemetry link offline. Check connection.";
    }
  }

  async generateFormation(stems: AudioStem[]): Promise<FormationConfig> {
    try {
      const stemSummary = stems.map(s => s.name).join(', ');
      const prompt = `
        I have an audio visualization app with these stems: ${stemSummary}.
        I want to arrange them in 3D space using parametric equations based on time 't' (seconds) and index 'i' (0 to count-1).
        
        Create a fascinating, looping 3D mathematical formation that reflects the potential vibe of these stems.
        Return a JSON object with:
        - name: A cool sci-fi name for the formation.
        - description: A short physics explanation of the shape.
        - code: { x, y, z } strings containing Javascript Math code.
        
        Available variables for code strings:
        - t: time in seconds
        - i: index of the stem
        - count: total number of stems
        - Math: The JS Math object (sin, cos, tan, PI, etc)
        
        Example code: "Math.sin(t + i) * 5"
        
        Ensure the formation stays roughly within -20 to 20 units on X/Y/Z.
      `;
      const model = "gemini-3-flash-preview";
      const config = { responseMimeType: "application/json" };

      const response = await this.generateContent({
        model,
        contents: prompt,
        config
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      // Log PromptPack
      const pack = this.createPack("FORMATION_GEN", model, config, prompt, text);
      sessionService.addPromptPack(pack);
      sessionService.logEvent('FORMATION_CHANGE', { packId: pack.id });
      
      return JSON.parse(text) as FormationConfig;

    } catch (error) {
      console.error("Formation Gen Error", error);
      return {
        name: "Emergency Fallback Helix",
        description: "AI Link Failed. Reverting to standard parametric helix.",
        code: {
          x: "Math.cos(t + i * 0.5) * 10",
          y: "(i - count/2) * 2",
          z: "Math.sin(t + i * 0.5) * 10"
        }
      };
    }
  }

  async analyzeVibeVector(vector: VibeVector, context: any): Promise<AIProposal> {
      try {
          const model = "gemini-3-flash-preview";
          const prompt = `
            Analyze this Audio Vibe Vector and Mixer Context.
            
            Vibe Vector (0-1 Normalized):
            Bass: ${vector.bass.toFixed(2)}
            Mid: ${vector.mid.toFixed(2)}
            High: ${vector.high.toFixed(2)}
            Dynamics: ${vector.dynamics.toFixed(2)}
            Brightness: ${vector.brightness.toFixed(2)}
            Flux: ${vector.flux.toFixed(2)}
            Sigil: ${vector.sigil}
            
            Context:
            Current Reverb: ${context.reverb}
            Current Delay: ${context.delay}
            Mixer A/B/C: ${context.mixer.a.toFixed(2)}/${context.mixer.b.toFixed(2)}/${context.mixer.c.toFixed(2)}
            
            Task:
            1. Create a creative 2-word name for this specific vibe (e.g. "Neon Glitch", "Void Step").
            2. Write a 1-sentence reasoning for your proposal based on the physics of the sound.
            3. Propose 1 or 2 specific actions to enhance this vibe using the available tools.
            
            Available Actions:
            - SET_REVERB (0.0 to 1.0)
            - SET_DELAY (0.0 to 1.0)
            - SET_MIXER (target: 'A'|'B'|'C', value: 0.0 to 1.0)
            - SET_SPEED (0.5 to 1.5)
            
            Return JSON only matching the AIProposal interface structure (excluding id and status).
          `;
          
          const config = { responseMimeType: "application/json" };
          
          const response = await this.generateContent({
              model,
              contents: prompt,
              config
          });
          
          const text = response.text;
          if (!text) throw new Error("No response from AI");
          
          const data = JSON.parse(text);
          
          const pack = this.createPack("VIBE_ANALYSIS", model, config, prompt, text);
          sessionService.addPromptPack(pack);
          sessionService.logEvent('AI_PROPOSAL_GEN', { packId: pack.id });

          return {
              id: uuidv4(),
              status: 'PENDING',
              ...data
          };

      } catch (error) {
          console.error("Vibe Gen Error", error);
          return {
              id: uuidv4(),
              vibeName: "Static Interference",
              reasoning: "AI Connection Unstable. Suggest manual override.",
              actions: [],
              status: 'REJECTED'
          };
      }
  }

  // --- AUDIO ANALYSIS (Vibe Labeling) ---
  
  async analyzeAudioVibeExcerpt(excerptBlob: Blob, stemName: string, meta: { excerptHash: string }): Promise<AI_VibeLabel | null> {
      try {
          const base64Audio = await this.blobToBase64(excerptBlob);
          const model = "gemini-3-flash-preview";
          const prompt = `
            Analyze this audio excerpt (from "${stemName}").
            Return structured JSON describing its musical characteristics.
            
            JSON Schema:
            {
                "moods": ["string"],
                "genres": ["string"],
                "instruments": ["string"],
                "energy_curve": "rising" | "falling" | "constant" | "volatile",
                "recommended_visual_presets": ["string"],
                "recommended_show_script_beats": [number],
                "text_summary": "string",
                "tags": ["string"]
            }
          `;
          
          const config = { responseMimeType: "application/json" };
          
          // Re-use existing pack if available (Replay logic)
          // Note: In a strict replay system we wouldn't call this at all, but read from cards.
          // This function implies a live request.
          
          const response = await this.generateContent({
              model,
              contents: {
                  parts: [
                      { inlineData: { mimeType: "audio/wav", data: base64Audio } },
                      { text: prompt }
                  ]
              },
              config
          });

          const text = response.text;
          if (!text) throw new Error("No response");
          
          const pack = this.createPack("AUDIO_LABEL", model, config, prompt, text);
          // Store hash reference in config for future lookups
          pack.config = { ...pack.config, ...meta }; 
          sessionService.addPromptPack(pack);
          
          return JSON.parse(text) as AI_VibeLabel;

      } catch (err) {
          console.error("Audio Vibe Analysis Failed", err);
          return null;
      }
  }
  
  // Legacy Wrapper
  async analyzeAudioVibe(buffer: AudioBuffer, stemName: string): Promise<AI_VibeLabel | null> {
      // Create a temporary WAV just for this legacy call
      const blob = audioService.encodeWAV(buffer); // Full buffer (might be too big)
      // Ideally we slice it first. But let's assume the legacy call handles small buffers or we accept the cost.
      // For compatibility with the new flow, let's just generate a random hash for meta
      return this.analyzeAudioVibeExcerpt(blob, stemName, { excerptHash: "legacy_direct_call" });
  }

  async generateShowScript(tags: string[], duration: number): Promise<ShowScriptV1> {
      const model = "gemini-3-flash-preview";
      const prompt = `
        Create a 'ShowScript' for a ${duration} second audio visualizer sequence based on these tags: ${tags.join(', ')}.
        Events should be timed to create a rhythm.
        
        Available Event Types:
        - SET_VISUAL (key: 'meshDistortion'|'chromaticAberration'|'particleDensity', value: number)
        - SET_FORMATION (value: 'SWARM'|'GRID'|'HELIX'|'ORBIT')
        - TRIGGER_FX (key: 'stutter', duration: number)
        
        Return JSON matching ShowScriptV1 interface:
        {
          schema_version: "showscript.v1",
          id: "UUID",
          seed: "RANDOM",
          name: "Creative Name",
          tempo_ref: 120,
          events: [ { t: number, type: string, key?: string, value?: any, duration?: number } ]
        }
      `;
      
      const config = { responseMimeType: "application/json" };
      const response = await this.generateContent({
          model,
          contents: prompt,
          config
      });
      
      const text = response.text || "{}";
      const pack = this.createPack("SHOW_SCRIPT_GEN", model, config, prompt, text);
      sessionService.addPromptPack(pack);
      sessionService.logEvent('SHOW_SCRIPT_GENERATED', { packId: pack.id });
      
      const script = JSON.parse(text);
      script.id = uuidv4();
      return script;
  }

  private blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }
}

export const geminiService = new GeminiService();
