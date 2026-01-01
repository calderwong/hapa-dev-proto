/**
 * Best-effort JSON extraction.
 * - Strips common markdown fences
 * - Attempts to locate the first JSON object/array in the string
 */
export const parseJsonFromText = (text: string | undefined): any => {
  if (!text) return null;
  let cleaned = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();

  // If the model replied with extra prose, attempt to slice to JSON
  const firstObj = cleaned.indexOf('{');
  const firstArr = cleaned.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start > 0) cleaned = cleaned.slice(start).trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON from model output:', e, { raw: text, cleaned });
    throw new Error('AI returned invalid JSON. Try again or adjust the prompt.');
  }
};
