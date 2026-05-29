import type OpenAI from 'openai';
import { AI_EXTRACTION_MODEL, getOpenRouterClient } from '@/lib/ai/client';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_VALUES } from '@/lib/documents';
import type { Criticality, ExtractedDocument, RawExtraction } from '@/lib/types';
import { recordAiExtractionAudit } from '@/lib/arkiv/ai-audit';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mapea el tipo (valor de enum o etiqueta libre del modelo) al valor de enum, o 'otro'. */
export function mapDocumentType(raw: string | undefined): string {
  if (!raw) return 'otro';
  const trimmed = raw.trim();
  if (DOCUMENT_TYPE_VALUES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const byLabel = DOCUMENT_TYPES.find(t => t.label.toLowerCase() === lower);
  if (byLabel) return byLabel.value;
  const byPartial = DOCUMENT_TYPES.find(
    t => t.value !== 'otro' && (lower.includes(t.label.toLowerCase()) || t.label.toLowerCase().includes(lower)),
  );
  return byPartial ? byPartial.value : 'otro';
}

/** Devuelve la fecha si es 'YYYY-MM-DD' válida y real; si no, ''. */
export function normalizeDate(raw: string | undefined): string {
  if (!raw || !ISO_DATE.test(raw.trim())) return '';
  const value = raw.trim();
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  // Reconstruir para descartar overflow (ej. 2026-13-40 → otro mes)
  const iso = date.toISOString().slice(0, 10);
  return iso === value ? value : '';
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeCriticality(raw: string | undefined): Criticality {
  return raw === 'normal' ? 'normal' : 'critical';
}

/** Convierte la salida cruda del modelo en un ExtractedDocument validado. */
export function normalizeExtraction(raw: RawExtraction): ExtractedDocument {
  const result: ExtractedDocument = {
    document_type: mapDocumentType(raw.document_type),
    document_name: (raw.document_name ?? '').trim(),
    issued_at: normalizeDate(raw.issued_at),
    expires_at: normalizeDate(raw.expires_at),
    criticality: normalizeCriticality(raw.criticality),
    issuer: (raw.issuer ?? '').trim(),
    policy_number: (raw.policy_number ?? '').trim(),
    coverage: (raw.coverage ?? '').trim(),
    summary: (raw.summary ?? '').trim(),
    confidence: clamp01(raw.confidence),
    fields_found: [],
  };

  const found: string[] = [];
  if (raw.document_type && result.document_type !== 'otro') found.push('document_type');
  if (result.document_name) found.push('document_name');
  if (result.issued_at) found.push('issued_at');
  if (result.expires_at) found.push('expires_at');
  if (result.issuer) found.push('issuer');
  if (result.policy_number) found.push('policy_number');
  if (result.coverage) found.push('coverage');
  result.fields_found = found;

  return result;
}

// Tool en formato OpenAI/OpenRouter (function calling).
export const EXTRACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'registrar_documento',
    description:
      'Registra los datos extraídos de un documento de compliance de proveedor (seguro, certificado, habilitación, etc.).',
    parameters: {
      type: 'object' as const,
      properties: {
        document_type: {
          type: 'string',
          description: `Tipo de documento. Preferí uno de estos valores: ${DOCUMENT_TYPE_VALUES.join(', ')}. Si no encaja, describilo en texto libre.`,
        },
        document_name: { type: 'string', description: 'Nombre o título del documento tal como aparece.' },
        issued_at: { type: 'string', description: 'Fecha de emisión en formato YYYY-MM-DD. Vacío si no aparece.' },
        expires_at: { type: 'string', description: 'Fecha de vencimiento en formato YYYY-MM-DD. Vacío si no aparece.' },
        criticality: { type: 'string', enum: ['critical', 'normal'], description: 'Criticidad sugerida.' },
        issuer: { type: 'string', description: 'Entidad emisora (aseguradora, organismo, certificadora).' },
        policy_number: { type: 'string', description: 'Número de póliza, certificado o expediente.' },
        coverage: { type: 'string', description: 'Monto o alcance de cobertura, si aplica.' },
        summary: { type: 'string', description: 'Resumen de una frase del documento, en español.' },
        confidence: { type: 'number', description: 'Confianza global 0..1 sobre la exactitud de la extracción.' },
      },
      required: ['document_type', 'expires_at', 'confidence'],
    },
  },
};

const SYSTEM_PROMPT = `Sos un asistente de compliance que lee documentos de proveedores (pólizas de seguro, certificados ISO, habilitaciones, constancias fiscales, ART) en español.
Extraé los datos con precisión. Las fechas SIEMPRE en formato YYYY-MM-DD. Si un dato no aparece, dejalo vacío en lugar de inventarlo.
Marcá criticidad 'critical' para seguros y habilitaciones obligatorias; 'normal' para el resto.
Sé conservador con la confianza: bajala si la imagen es borrosa o las fechas son ambiguas.`;

// Bloque de contenido: imágenes como image_url (data URI); PDFs como file (parseados por OpenRouter).
function mediaBlock(buffer: Buffer, mime: string) {
  const data = buffer.toString('base64');
  if (mime === 'application/pdf') {
    return {
      type: 'file' as const,
      file: { filename: 'documento.pdf', file_data: `data:application/pdf;base64,${data}` },
    };
  }
  const mediaType = mime === 'image/jpg' ? 'image/jpeg' : mime;
  return {
    type: 'image_url' as const,
    image_url: { url: `data:${mediaType};base64,${data}` },
  };
}

export interface ExtractOptions {
  client?: OpenAI;
}

/** Llama al modelo con el archivo y devuelve los campos normalizados. */
export async function extractDocumentFields(
  buffer: Buffer,
  mime: string,
  options: ExtractOptions = {},
): Promise<ExtractedDocument> {
  const client = options.client ?? getOpenRouterClient();
  const isPdf = mime === 'application/pdf';

  const body = {
    model: AI_EXTRACTION_MODEL,
    max_tokens: 1024,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'function', function: { name: EXTRACTION_TOOL.function.name } },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          mediaBlock(buffer, mime),
          { type: 'text', text: 'Extraé los datos de este documento de compliance llamando a la herramienta.' },
        ],
      },
    ],
    // OpenRouter parsea PDFs con texto (engine gratuito). Para escaneos, cambiar a 'mistral-ocr' (pago).
    ...(isPdf ? { plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }] } : {}),
  };

  // Cast necesario: OpenRouter extiende el schema de OpenAI con content parts 'file' y 'plugins'.
  const completion = await client.chat.completions.create(
    body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  );

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  let raw: RawExtraction = {};
  if (toolCall && 'function' in toolCall) {
    try {
      raw = JSON.parse(toolCall.function.arguments) as RawExtraction;
    } catch {
      raw = {};
    }
  }
  const extracted = normalizeExtraction(raw);

  // Registrar auditoría en Arkiv de forma asíncrona (no bloquea)
  recordAiExtractionAudit({
    detectedType: extracted.document_type,
    confidence: extracted.confidence,
    model: AI_EXTRACTION_MODEL,
    summary: extracted.summary || 'Sin resumen',
  });

  return extracted;
}
