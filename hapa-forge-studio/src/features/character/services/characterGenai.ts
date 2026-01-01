import { Type } from '@google/genai';
import { createGenAI } from '@/shared/genai/client';
import { getModelSettings } from '@/shared/genai/settings';
import { parseJsonFromText } from '@/shared/genai/parse';
import { CharacterAnalysis } from '../types';

const splitDataUrl = (dataUrl: string): { mimeType: string; base64: string } | null => {
  if (!dataUrl.startsWith('data:')) return null;
  const [head, b64] = dataUrl.split(',');
  const m = head.match(/data:(.*?);base64/);
  const mimeType = m?.[1] || 'image/png';
  if (!b64) return null;
  return { mimeType, base64: b64 };
};

export const analyzeCharacterFromText = async (args: {
  profileText: string;
  skillsText?: string;
}): Promise<{ analysis: CharacterAnalysis; model: string; prompt: string }> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const prompt = `You are an RPG systems designer. Convert the following character source text into a structured RPG character profile.

SOURCE (biography / notes):
${args.profileText}

OPTIONAL SKILLS DOC:
${args.skillsText || '(none)'}

Return JSON that matches the schema. Be grounded in the text: infer, but don't hallucinate specific employers/awards unless present.
Rules:
- level: integer 1-99
- stats STR/DEX/CON/INT/WIS/CHA: integers 1-20
- keySkills: 4-10 skills, each with rank 1-5 and a short explanation (1 sentence)
- tags: 3-10 short tags
`; 

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          title: { type: Type.STRING },
          className: { type: Type.STRING },
          archetype: { type: Type.STRING },
          level: { type: Type.NUMBER },
          stats: {
            type: Type.OBJECT,
            properties: {
              STR: { type: Type.NUMBER },
              DEX: { type: Type.NUMBER },
              CON: { type: Type.NUMBER },
              INT: { type: Type.NUMBER },
              WIS: { type: Type.NUMBER },
              CHA: { type: Type.NUMBER },
            },
            required: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
          },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          keySkills: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                rank: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
              },
              required: ['name', 'rank', 'explanation'],
            },
          },
          quote: { type: Type.STRING },
        },
        required: ['name', 'title', 'className', 'archetype', 'level', 'stats', 'tags', 'keySkills'],
      },
    },
  });

  const analysis = parseJsonFromText(response.text) as CharacterAnalysis;
  return { analysis, model: textModel, prompt };
};

export const generateLore = async (args: {
  profileText: string;
  analysis: CharacterAnalysis;
}): Promise<{ lore: string; model: string; prompt: string }> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const prompt = `Write a short RPG lore blurb (120-220 words) for the character below.

STRUCTURED PROFILE:
${JSON.stringify(args.analysis, null, 2)}

SOURCE TEXT:
${args.profileText}

Tone: cinematic, sci-fi, a bit mythic. Avoid real-world sensitive claims not in the source. End with a single-sentence "quest hook".
`;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
  });

  return { lore: response.text || '', model: textModel, prompt };
};

export const generatePortraitPrompt = async (args: {
  profileText: string;
  analysis: CharacterAnalysis;
  avatarDataUrl?: string;
}): Promise<{ portraitPrompt: string; model: string; prompt: string }> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const prompt = `Create a single prompt for a generative image model to create a character portrait.

Constraints:
- 1 subject, centered, chest-up portrait
- rich lighting + cinematic background, but keep focus on face
- include style tags and rendering notes
- no trademarked characters
- output ONLY the prompt text (no markdown)

STRUCTURED PROFILE:
${JSON.stringify(args.analysis, null, 2)}

SOURCE TEXT:
${args.profileText}
`;

  const parts: any[] = [{ text: prompt }];
  const img = args.avatarDataUrl ? splitDataUrl(args.avatarDataUrl) : null;
  if (img) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
  }

  const response = await ai.models.generateContent({
    model: textModel,
    contents: [{ role: 'user', parts }],
  });

  return { portraitPrompt: response.text || '', model: textModel, prompt };
};

export const generatePortraitImage = async (args: {
  portraitPrompt: string;
}): Promise<{ dataUrl: string; model: string; prompt: string }> => {
  const ai = createGenAI();
  const { imageModel } = getModelSettings();

  const prompt = args.portraitPrompt;
  const response = await ai.models.generateContent({
    model: imageModel,
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: '1:1',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if ((part as any).inlineData) {
      const inline = (part as any).inlineData;
      return {
        dataUrl: `data:${inline.mimeType || 'image/png'};base64,${inline.data}`,
        model: imageModel,
        prompt,
      };
    }
  }

  throw new Error('No image generated');
};

export const generateAnimatedCardPrompt = async (args: {
  analysis: CharacterAnalysis;
  lore?: string;
  portraitPrompt?: string;
}): Promise<{ animatedPrompt: string; model: string; prompt: string }> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const prompt = `You are a prompt engineer for Veo (video generation).

Goal: Write ONE concise, Veo-ready video prompt to animate an RPG trading card portrait.

Hard constraints:
- Duration: 5–10 seconds
- Subtle motion only: slow push-in / slight parallax / gentle breathing motion
- Add holographic UI shimmer, scanlines, floating stat glyphs (generic), soft glow
- DO NOT change the character identity, face, age, ethnicity, or wardrobe. Keep the portrait consistent.
- Avoid adding specific readable text that could contradict the profile. If you include text overlays, keep them generic and minimal (e.g., “SYSTEM ONLINE”, “DATA SYNC”).
- No new characters, no scene change, no dramatic morphing.

Inputs:
STRUCTURED PROFILE (JSON):
${JSON.stringify(args.analysis, null, 2)}

LORE (optional):
${args.lore || '(none)'}

PORTRAIT PROMPT (optional):
${args.portraitPrompt || '(none)'}

Output format:
- Output ONLY the final video prompt as plain text. No markdown, no bullet list.
`;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
  });

  return {
    animatedPrompt: response.text || '',
    model: textModel,
    prompt,
  };
};
