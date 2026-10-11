import { GoogleGenAI } from '@google/genai';

// Use a currently available model by default; override with GEMINI_MODEL in Vercel if needed.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
