import OpenAI from 'openai';

/** Modelo por defecto: Gemini 2.0 Flash — visión + PDF nativo, económico, buena extracción de fechas. */
export const AI_EXTRACTION_MODEL = process.env.AI_EXTRACTION_MODEL ?? 'google/gemini-2.0-flash-001';

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    // Headers opcionales de OpenRouter para ranking/atribución.
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'VendorPass',
    },
  });
}
