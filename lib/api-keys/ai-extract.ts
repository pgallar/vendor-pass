import { isAiConfigured } from '@/lib/ai/client';
import { extractDocumentFields } from '@/lib/ai/extract';
import type { ExtractedDocument } from '@/lib/types';
import { parseBase64File, type Base64FileInput } from '@/lib/api-keys/file-bytes';

export function assertAiExtractionAvailable(): void {
  if (!isAiConfigured()) {
    throw new Error(
      'Extracción por IA no configurada en el servidor (falta OPENROUTER_API_KEY). ' +
        'Podés crear el documento con create_document y metadatos manuales.',
    );
  }
}

/** Extrae campos de compliance desde un archivo en base64 (OpenRouter / Gemini). */
export async function extractDocumentFromBase64(
  file: Base64FileInput,
): Promise<ExtractedDocument> {
  assertAiExtractionAvailable();
  const buffer = parseBase64File(file);
  return extractDocumentFields(buffer, file.mime_type);
}
