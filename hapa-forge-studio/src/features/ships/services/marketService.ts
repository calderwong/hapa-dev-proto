import { createGenAI } from '@/shared/genai/client';
import { getModelSettings } from '@/shared/genai/settings';

export const getMarketIntelligence = async (
  partName: string
): Promise<{ text: string; links: { uri: string; title: string }[] }> => {
  const ai = createGenAI();
  const { textModel } = getModelSettings();

  const prompt = `Analyze current fictional and real-world aerospace trends for "${partName}". Provide a hypothetical galactic market valuation (in Credits) and explaining factors. Cite real-world inspirations if relevant.`;

  const response = await ai.models.generateContent({
    model: textModel,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const links =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || 'Reference Source',
      })) || [];

  return {
    text: response.text || 'Market link disrupted.',
    links,
  };
};
