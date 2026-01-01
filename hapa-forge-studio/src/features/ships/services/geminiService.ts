import { Type } from '@google/genai';
import { createGenAI } from '@/shared/genai/client';
import { getApiKey, getModelSettings } from '@/shared/genai/settings';
import { parseJsonFromText } from '@/shared/genai/parse';
import {
  PlacedPart,
  ShipStats,
  AIAnalysis,
  Part,
  HullVisuals,
  ForgeConfig,
} from '../types';

const appendKeyIfMissing = (uri: string): string => {
  const key = getApiKey();
  if (!key) return uri;
  if (uri.includes('key=')) return uri;
  const joiner = uri.includes('?') ? '&' : '?';
  return `${uri}${joiner}key=${encodeURIComponent(key)}`;
};

export const analyzeShip = async (
  shipName: string,
  parts: PlacedPart[],
  stats: ShipStats
): Promise<AIAnalysis> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const manifest = parts.map((p) => `${p.name} (Type: ${p.type})`).join(', ');
  const prompt = `
    Analyze the spaceship design: "${shipName}".
    Manifest: ${manifest}
    Stats: Mass ${stats.totalMass}t, Power ${stats.totalPowerGen}/${stats.totalPowerDraw}MW, Crew ${stats.totalCrewCapacity}.
    Provide a professional naval architect's strategic analysis, efficiency score (0-100), military/civilian classification, and rich sci-fi lore.
  `;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          efficiencyScore: { type: Type.NUMBER },
          role: { type: Type.STRING },
          lore: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['efficiencyScore', 'role', 'lore', 'strengths', 'weaknesses'],
      },
    },
  });

  return (parseJsonFromText(response.text) || {}) as AIAnalysis;
};

export const generateShip = async (
  config: ForgeConfig,
  availableParts: Part[]
): Promise<Partial<PlacedPart>[]> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const partIds = availableParts
    .map((p) => `${p.id} (${p.type}, Size: ${p.size})`)
    .join(', ');

  const sizeMap: Record<string, string> = {
    COMPACT: '6-10',
    STANDARD: '12-20',
    COLOSSAL: '25-40',
  };

  const focusMap: Record<string, string> = {
    MOBILITY: 'Prioritize multiple engines and low mass.',
    DEFENSE: 'Prioritize heavy hull plates and shield generators.',
    ORDNANCE: 'Prioritize weapon systems and high-output reactors.',
    UTILITY: 'Prioritize cargo bays, comms dishes, and crew quarters.',
  };

  const prompt = `
    Architectural Directive: "${config.directive}".
    Target Strategic Role: ${config.role}.
    Vessel Magnitude: ${config.magnitude} (Target Part Count: ${sizeMap[config.magnitude]}).
    Core Focus: ${config.focus}. ${focusMap[config.focus]}

    Available Part IDs: ${partIds}.

    Architectural Rules:
    1. Grid: Y=Up. Center (0,0,0). Parts must be snapped to integers.
    2. Logic: Engines must be at Z < 0. Cockpits at Z > 0. Heavy reactors at Y=0 (the core).
    3. Structural: Symmetry is mandatory. Ensure engines balance mass.
    4. Connectivity: Every part must be adjacent to at least one other part to form a single manifold.
    5. Output: JSON array of {id, position: [x, y, z], rotation: (0, 90, 180, 270)}.
  `;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            position: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              minItems: 3,
              maxItems: 3,
            },
            rotation: { type: Type.NUMBER },
          },
          required: ['id', 'position', 'rotation'],
        },
      },
    },
  });

  return (parseJsonFromText(response.text) || []) as Partial<PlacedPart>[];
};

export const synthesizeHullVisuals = async (
  shipName: string,
  parts: PlacedPart[]
): Promise<HullVisuals> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const manifest = parts.map((p) => `${p.type}`).join(', ');

  const prompt = `
    Design the aesthetic DNA for starship "${shipName}".
    Component Density: ${manifest}.
    Determine the optimal color scheme, material finish, and hull geometry adjustments.

    CRITICAL: You MUST return colors (primaryColor, accentColor, emissiveColor) as valid 6-digit Hex codes (e.g., "#38BDF8").
    Do NOT use descriptive names.

    Advanced Visualization Parameters:
    - emissivePattern: [STREAKS, PULSE, STASIS, FLOW, GLITCH]
    - panelingType: [PLATE, WELDED, OVERLAP, INTEGRATED, SCALED]
    - accentPattern: [NONE, STRIPES, HAZARD, CHECKER, CIRCUIT]
    - structuralFin: [NONE, STABILIZER, SPIKE, WINGLET]
    - detailDensity: 0.0 to 1.0 (complexity of external greebles).
    - glowIntensity: 0.5 to 5.0.
  `;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryColor: { type: Type.STRING, description: 'Hex code e.g. #2D2D2D' },
          accentColor: { type: Type.STRING, description: 'Hex code e.g. #FFCC00' },
          emissiveColor: { type: Type.STRING, description: 'Hex code e.g. #00F2FF' },
          finish: {
            type: Type.STRING,
            enum: ['MATTE', 'GLOSSY', 'BRUSHED_METAL', 'CARBON_FIBER'],
          },
          platingPattern: { type: Type.STRING, enum: ['GRID', 'HEX', 'DIAMOND', 'SEAMLESS'] },
          weathering: { type: Type.NUMBER },
          reflectivity: { type: Type.NUMBER },
          hullTaper: { type: Type.NUMBER },
          emissivePattern: {
            type: Type.STRING,
            enum: ['STREAKS', 'PULSE', 'STASIS', 'FLOW', 'GLITCH'],
          },
          panelingType: {
            type: Type.STRING,
            enum: ['PLATE', 'WELDED', 'OVERLAP', 'INTEGRATED', 'SCALED'],
          },
          accentPattern: {
            type: Type.STRING,
            enum: ['NONE', 'STRIPES', 'HAZARD', 'CHECKER', 'CIRCUIT'],
          },
          structuralFin: {
            type: Type.STRING,
            enum: ['NONE', 'STABILIZER', 'SPIKE', 'WINGLET'],
          },
          glowIntensity: { type: Type.NUMBER },
          detailDensity: { type: Type.NUMBER },
        },
        required: [
          'primaryColor',
          'accentColor',
          'emissiveColor',
          'finish',
          'platingPattern',
          'weathering',
          'reflectivity',
          'hullTaper',
          'emissivePattern',
          'panelingType',
          'accentPattern',
          'structuralFin',
          'glowIntensity',
          'detailDensity',
        ],
      },
    },
  });

  return (parseJsonFromText(response.text) || {}) as HullVisuals;
};

export const generateConceptArt = async (
  shipName: string,
  visuals: HullVisuals,
  parts: PlacedPart[]
): Promise<string> => {
  const ai = createGenAI();
  const { imageModel } = getModelSettings();

  const manifest = Array.from(new Set(parts.map((p) => p.name))).join(', ');
  const prompt = `Cinematic 8k sci-fi concept art of the ship "${shipName}" in a vibrant stellar nebula.
  Exterior: ${visuals.finish} ${visuals.primaryColor} plating, ${visuals.accentColor} detailing with ${visuals.accentPattern} patterns, glowing ${visuals.emissiveColor} ports with ${visuals.emissivePattern} patterns.
  Features: ${manifest}, ${visuals.structuralFin} structural fins.
  Style: Epic sci-fi film still, photorealistic textures, massive scale.`;

  const response = await ai.models.generateContent({
    model: imageModel,
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: '16:9',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if ((part as any).inlineData) {
      const inline = (part as any).inlineData;
      return `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
    }
  }

  throw new Error('No image generated');
};

export const generateShipVideo = async (
  shipName: string,
  visuals: HullVisuals,
  parts: PlacedPart[],
  onStatusUpdate?: (status: string) => void
): Promise<string> => {
  const ai = createGenAI();
  const { videoModel } = getModelSettings();

  const manifest = Array.from(new Set(parts.map((p) => p.name))).join(', ');

  const prompt = `Spaceship "${shipName}" perform a slow majestic flyby through an asteroid belt.
  Hull: ${visuals.primaryColor} with ${visuals.accentColor} ${visuals.accentPattern} trim.
  Visible Systems: ${manifest}.
  Lighting: Harsh sunlight glinting off the ${visuals.finish} hull.
  Thrusters: Bright ${visuals.emissiveColor} particles.
  Quality: 1080p cinematic IMAX resolution.`;

  onStatusUpdate?.('Temporal link established...');
  let operation = await ai.models.generateVideos({
    model: videoModel,
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9',
    },
  });

  onStatusUpdate?.('Decoding neural frame buffers...');
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
    onStatusUpdate?.('Finalizing cinematic synthesis...');
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error('Video generation failed');

  return appendKeyIfMissing(downloadLink);
};
