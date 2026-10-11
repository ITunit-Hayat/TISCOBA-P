import { GoogleGenAI } from '@google/genai';

// Nom de modèle configurable. Corrige l'ancienne valeur invalide "gemini-3.8-flash".
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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
