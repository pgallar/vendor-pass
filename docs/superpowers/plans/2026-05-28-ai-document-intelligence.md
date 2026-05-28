# AI Document Intelligence — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que VendorPass lea automáticamente los documentos de compliance — al subir un PDF o foto de un seguro/certificado, Claude (visión) extrae tipo, fechas, póliza y cobertura, precarga el formulario marcando cada campo con un sello "✨ IA", y el humano confirma antes de anclar en Arkiv.

**Architecture:** Un módulo `lib/ai/` envuelve el SDK `openai` apuntado a OpenRouter (API compatible con OpenAI), usando *function calling* forzado (`tool_choice`) para obtener salida estructurada vía JSON Schema. Un endpoint `POST /api/documents/extract` recibe el archivo, llama al modelo y devuelve campos normalizados con un nivel de confianza. `DocumentForm` llama a ese endpoint en paralelo a la subida a S3 y precarga el formulario. La lógica de normalización (mapeo de tipo a enum, validación de fechas, recorte de confianza) vive en funciones puras testeables sin red. La degradación es elegante: sin `OPENROUTER_API_KEY` el endpoint responde 503 y el formulario sigue funcionando manualmente.

**Tech Stack:** Next.js 16.2.6 (App Router), SDK `openai` vía OpenRouter, modelo `google/gemini-2.0-flash-001` (visión + PDF nativo, ~20-30× más barato que Sonnet), TypeScript, Vitest, Supabase (RLS), Arkiv SDK (ya integrado).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/documents.ts` (crear) | Lista canónica `DOCUMENT_TYPES` compartida entre form, prompt y normalizador (DRY) |
| `lib/ai/client.ts` (crear) | Factory del cliente OpenRouter (SDK `openai`) + `isAiConfigured()` |
| `lib/ai/extract.ts` (crear) | System prompt, tool schema (formato OpenAI), `extractDocumentFields()` (llamada al modelo, con cliente inyectable) y `normalizeExtraction()` (funciones puras) |
| `lib/types.ts` (modificar) | Tipos `RawExtraction` y `ExtractedDocument` |
| `app/api/documents/extract/route.ts` (crear) | Endpoint: auth, validación de archivo, base64, extracción, JSON normalizado |
| `components/vendor-pass/document-form.tsx` (modificar) | Auto-extracción al subir, precarga, sellos "✨ IA", banner de confianza |
| `tests/ai-extract.test.ts` (crear) | Tests de `normalizeExtraction`, `mapDocumentType`, `normalizeDate`, `extractDocumentFields` (cliente mockeado) |
| `.env.example` (modificar) | Documentar `OPENROUTER_API_KEY` y `AI_EXTRACTION_MODEL` |

---

## Task 1: Lista canónica de tipos de documento (compartida)

Mover `DOCUMENT_TYPES` fuera del componente cliente para que el prompt y el normalizador la reutilicen sin importar código `'use client'`.

**Files:**
- Create: `lib/documents.ts`
- Modify: `components/vendor-pass/document-form.tsx:9-16`

- [ ] **Step 1: Crear el módulo compartido**

Create `lib/documents.ts`:

```typescript
export interface DocumentTypeOption {
  value: string;
  label: string;
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'poliza_art', label: 'Póliza ART' },
  { value: 'habilitacion', label: 'Habilitación' },
  { value: 'constancia_fiscal', label: 'Constancia fiscal' },
  { value: 'seguro_rc', label: 'Seguro RC' },
  { value: 'certificado_iso', label: 'Certificado ISO' },
  { value: 'otro', label: 'Otro' },
];

export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map(t => t.value);
```

- [ ] **Step 2: Reapuntar el componente a la lista compartida**

In `components/vendor-pass/document-form.tsx`, replace lines 9-16 (the inline `export const DOCUMENT_TYPES = [...]`) with a re-export from the shared module:

```typescript
export { DOCUMENT_TYPES } from '@/lib/documents';
```

Add the import at the top of the file (after line 7, the lucide-react import):

```typescript
import { DOCUMENT_TYPES } from '@/lib/documents';
```

(The re-export keeps existing `import { DOCUMENT_TYPES } from '.../document-form'` callers working; the local import lets the component body keep using the constant.)

- [ ] **Step 3: Verificar que compila y los tests siguen verdes**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (sin errores nuevos de tipo; suite existente sigue en verde).

- [ ] **Step 4: Commit**

```bash
git add lib/documents.ts components/vendor-pass/document-form.tsx
git commit -m "refactor(documents): extraer DOCUMENT_TYPES a módulo compartido"
```

---

## Task 2: Tipos de extracción

**Files:**
- Modify: `lib/types.ts` (append al final, después de la línea 36)

- [ ] **Step 1: Añadir los tipos**

Append to `lib/types.ts`:

```typescript
/** Salida cruda del modelo (forced tool use) — todos los campos opcionales. */
export interface RawExtraction {
  document_type?: string;
  document_name?: string;
  issued_at?: string;
  expires_at?: string;
  criticality?: string;
  issuer?: string;
  policy_number?: string;
  coverage?: string;
  summary?: string;
  confidence?: number;
}

/** Resultado normalizado y validado, listo para precargar el formulario. */
export interface ExtractedDocument {
  document_type: string;          // valor de enum DOCUMENT_TYPES, o '' si no se reconoce
  document_name: string;
  issued_at: string;              // 'YYYY-MM-DD' o ''
  expires_at: string;             // 'YYYY-MM-DD' o ''
  criticality: Criticality;
  issuer: string;
  policy_number: string;
  coverage: string;
  summary: string;
  confidence: number;             // 0..1
  fields_found: string[];         // claves con valor — para los sellos "✨ IA"
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): tipos RawExtraction y ExtractedDocument"
```

---

## Task 3: Normalización (funciones puras, TDD)

La lógica que no toca la red: mapear el tipo de documento al enum, validar fechas ISO, recortar confianza y armar `fields_found`. Se testea sin API.

**Files:**
- Create: `lib/ai/extract.ts` (parcial — solo las funciones puras en esta task)
- Test: `tests/ai-extract.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/ai-extract.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapDocumentType, normalizeDate, normalizeExtraction } from '@/lib/ai/extract';

describe('mapDocumentType', () => {
  it('mantiene un valor de enum válido', () => {
    expect(mapDocumentType('seguro_rc')).toBe('seguro_rc');
  });

  it('mapea por etiqueta legible', () => {
    expect(mapDocumentType('Póliza ART')).toBe('poliza_art');
  });

  it('cae a "otro" cuando no reconoce', () => {
    expect(mapDocumentType('factura random')).toBe('otro');
  });

  it('cae a "otro" con entrada vacía o undefined', () => {
    expect(mapDocumentType('')).toBe('otro');
    expect(mapDocumentType(undefined)).toBe('otro');
  });
});

describe('normalizeDate', () => {
  it('acepta una fecha ISO válida', () => {
    expect(normalizeDate('2026-12-31')).toBe('2026-12-31');
  });

  it('rechaza fechas mal formadas devolviendo ""', () => {
    expect(normalizeDate('31/12/2026')).toBe('');
    expect(normalizeDate('no es fecha')).toBe('');
    expect(normalizeDate(undefined)).toBe('');
  });

  it('rechaza fechas calendario imposibles', () => {
    expect(normalizeDate('2026-13-40')).toBe('');
  });
});

describe('normalizeExtraction', () => {
  it('normaliza una extracción completa', () => {
    const result = normalizeExtraction({
      document_type: 'Seguro RC',
      document_name: 'Póliza RC 2026',
      issued_at: '2026-01-15',
      expires_at: '2026-12-31',
      criticality: 'critical',
      issuer: 'Aseguradora SA',
      policy_number: 'POL-123',
      coverage: 'USD 1.000.000',
      summary: 'Seguro de responsabilidad civil',
      confidence: 0.92,
    });
    expect(result.document_type).toBe('seguro_rc');
    expect(result.expires_at).toBe('2026-12-31');
    expect(result.criticality).toBe('critical');
    expect(result.confidence).toBe(0.92);
    expect(result.fields_found).toContain('expires_at');
    expect(result.fields_found).toContain('policy_number');
  });

  it('aplica defaults seguros ante campos faltantes', () => {
    const result = normalizeExtraction({});
    expect(result.document_type).toBe('otro');
    expect(result.issued_at).toBe('');
    expect(result.expires_at).toBe('');
    expect(result.criticality).toBe('critical');
    expect(result.confidence).toBe(0);
    expect(result.fields_found).toEqual([]);
  });

  it('recorta la confianza al rango 0..1', () => {
    expect(normalizeExtraction({ confidence: 1.7 }).confidence).toBe(1);
    expect(normalizeExtraction({ confidence: -3 }).confidence).toBe(0);
  });

  it('normaliza una criticidad inválida a "critical"', () => {
    expect(normalizeExtraction({ criticality: 'altísima' }).criticality).toBe('critical');
    expect(normalizeExtraction({ criticality: 'normal' }).criticality).toBe('normal');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/ai-extract.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/ai/extract'" (el módulo aún no existe).

- [ ] **Step 3: Implementar las funciones puras**

Create `lib/ai/extract.ts`:

```typescript
import { DOCUMENT_TYPES, DOCUMENT_TYPE_VALUES } from '@/lib/documents';
import type { Criticality, ExtractedDocument, RawExtraction } from '@/lib/types';

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
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/ai-extract.test.ts`
Expected: PASS (todos los tests de `mapDocumentType`, `normalizeDate`, `normalizeExtraction`).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/extract.ts tests/ai-extract.test.ts
git commit -m "feat(ai): normalización pura de extracción con tests"
```

---

## Task 4: Cliente OpenRouter + detección de configuración

OpenRouter expone una API compatible con OpenAI, así que se usa el SDK `openai` con `baseURL` apuntado a OpenRouter.

**Files:**
- Create: `lib/ai/client.ts`
- Modify: `.env.example` (después de la línea 25)
- Bash: instalar SDK

- [ ] **Step 1: Instalar el SDK**

Run: `npm install openai`
Expected: añade `openai` a `dependencies` en `package.json`.

- [ ] **Step 2: Crear el cliente**

Create `lib/ai/client.ts`:

```typescript
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
```

- [ ] **Step 3: Documentar las variables de entorno**

In `.env.example`, append after line 25 (`NEXT_PUBLIC_APP_URL=...`):

```bash
# IA — extracción automática de documentos vía OpenRouter. Sin esta clave, el formulario sigue funcionando manual.
# Conseguí la clave en https://openrouter.ai/keys
OPENROUTER_API_KEY=
# Verificá IDs y precios en https://openrouter.ai/models
AI_EXTRACTION_MODEL=google/gemini-2.0-flash-001
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai/client.ts .env.example package.json package-lock.json
git commit -m "feat(ai): cliente OpenRouter (SDK openai) y detección de configuración"
```

---

## Task 5: Llamada de extracción al modelo (forced tool use, cliente inyectable)

Añade a `lib/ai/extract.ts` el prompt, el tool schema y `extractDocumentFields()`. El cliente se inyecta para poder mockearlo en tests sin red.

**Files:**
- Modify: `lib/ai/extract.ts`
- Test: `tests/ai-extract.test.ts`

- [ ] **Step 1: Escribir el test que falla (cliente mockeado)**

Append to `tests/ai-extract.test.ts`:

```typescript
import type OpenAI from 'openai';
import { extractDocumentFields, EXTRACTION_TOOL } from '@/lib/ai/extract';

function fakeClient(toolInput: Record<string, unknown>) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: EXTRACTION_TOOL.function.name,
                      arguments: JSON.stringify(toolInput),
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe('extractDocumentFields', () => {
  it('extrae y normaliza usando la respuesta de tool_calls', async () => {
    const client = fakeClient({
      document_type: 'Póliza ART',
      document_name: 'ART 2026',
      issued_at: '2026-02-01',
      expires_at: '2027-02-01',
      criticality: 'critical',
      confidence: 0.88,
    });
    const result = await extractDocumentFields(
      Buffer.from('x'),
      'application/pdf',
      { client },
    );
    expect(result.document_type).toBe('poliza_art');
    expect(result.expires_at).toBe('2027-02-01');
    expect(result.confidence).toBe(0.88);
  });

  it('devuelve un resultado vacío normalizado si no hay tool_calls', async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: 'no pude leerlo' } }] }),
        },
      },
    } as unknown as OpenAI;
    const result = await extractDocumentFields(Buffer.from('x'), 'image/png', { client });
    expect(result.document_type).toBe('otro');
    expect(result.confidence).toBe(0);
    expect(result.fields_found).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/ai-extract.test.ts`
Expected: FAIL con "extractDocumentFields is not a function" / "EXTRACTION_TOOL is not exported".

- [ ] **Step 3: Implementar prompt, tool schema y la llamada**

Append to `lib/ai/extract.ts` (añadir imports en la cabecera y el resto al final):

Add to the top of the file (after the existing imports):

```typescript
import type OpenAI from 'openai';
import { AI_EXTRACTION_MODEL, getOpenRouterClient } from '@/lib/ai/client';
```

Append at the end of the file:

```typescript
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
  return normalizeExtraction(raw);
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/ai-extract.test.ts`
Expected: PASS (incluye los dos nuevos casos de `extractDocumentFields`).

- [ ] **Step 5: Verificar tipos y commit**

Run: `npx tsc --noEmit`
Expected: PASS

```bash
git add lib/ai/extract.ts tests/ai-extract.test.ts
git commit -m "feat(ai): extracción de documentos con OpenRouter y function calling forzado"
```

---

## Task 6: Endpoint POST /api/documents/extract

Reutiliza la validación de S3 (mime/tamaño) y `requireUser`. Degrada elegante (503) sin clave de IA.

**Files:**
- Create: `app/api/documents/extract/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/documents/extract/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { isAllowedMime, MAX_BYTES } from '@/lib/storage/s3';
import { isAiConfigured } from '@/lib/ai/client';
import { extractDocumentFields } from '@/lib/ai/extract';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Extracción por IA no configurada' }, { status: 503 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractDocumentFields(buffer, file.type);
    return NextResponse.json({ extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error extrayendo datos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Smoke test manual del 503 (sin clave)**

Run (con el dev server corriendo y sin `OPENROUTER_API_KEY`):
`curl -i -X POST http://localhost:3000/api/documents/extract -F file=@README.md`
Expected: `HTTP/1.1 503` con `{"error":"Extracción por IA no configurada"}` (o 401 si no hay sesión — ambos confirman que el guard corre antes de tocar la IA).

- [ ] **Step 4: Commit**

```bash
git add app/api/documents/extract/route.ts
git commit -m "feat(api): endpoint de extracción de documentos por IA"
```

---

## Task 7: Integración en DocumentForm — auto-extracción y precarga

Al subir un archivo, además de subirlo a S3, llamar a `/api/documents/extract` y precargar los campos vacíos, marcando con un sello "✨ IA" cada campo que la IA completó.

**Files:**
- Modify: `components/vendor-pass/document-form.tsx`

- [ ] **Step 1: Añadir imports e iconos de IA**

In `components/vendor-pass/document-form.tsx` line 7, extend the lucide-react import to add `Sparkles`:

```typescript
import { Calendar, FileText, Link as LinkIcon, Upload, Hash, Sparkles } from 'lucide-react';
```

Add after the existing `import { DOCUMENT_TYPES } from '@/lib/documents';` (added in Task 1):

```typescript
import type { ExtractedDocument } from '@/lib/types';
```

- [ ] **Step 2: Añadir estado de IA**

In the component body, after line 45 (`const [form, setForm] = useState<DocumentFormState>(initial);`), add:

```typescript
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
```

- [ ] **Step 3: Añadir el helper que precarga sólo campos vacíos**

Add this function inside the component, right before `handleFileChange` (line 61):

```typescript
  function applyExtraction(ex: ExtractedDocument) {
    const filled = new Set<string>();
    setForm(prev => {
      const next = { ...prev };
      const maybe = (key: keyof DocumentFormState, value: string) => {
        if (value && !prev[key]) {
          next[key] = value;
          filled.add(key);
        }
      };
      maybe('document_type', ex.document_type !== 'otro' ? ex.document_type : '');
      maybe('document_name', ex.document_name);
      maybe('issued_at', ex.issued_at);
      maybe('expires_at', ex.expires_at);
      if (ex.criticality && !filled.has('criticality')) {
        next.criticality = ex.criticality;
        filled.add('criticality');
      }
      // Volcar metadatos extra en notas si están vacías
      if (!prev.notes) {
        const meta = [
          ex.issuer && `Emisor: ${ex.issuer}`,
          ex.policy_number && `N°: ${ex.policy_number}`,
          ex.coverage && `Cobertura: ${ex.coverage}`,
        ].filter(Boolean);
        if (meta.length) {
          next.notes = meta.join(' · ');
          filled.add('notes');
        }
      }
      return next;
    });
    setAiFields(filled);
    setAiConfidence(ex.confidence);
    setAiSummary(ex.summary);
  }
```

- [ ] **Step 4: Disparar la extracción en paralelo a la subida**

Replace the body of `handleFileChange` (lines 61-78) with:

```typescript
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    setAiExtracting(true);

    const uploadBody = new FormData();
    uploadBody.append('file', file);
    uploadBody.append('vendorId', vendorId);

    const extractBody = new FormData();
    extractBody.append('file', file);

    const [uploadRes, extractRes] = await Promise.allSettled([
      fetch('/api/upload', { method: 'POST', body: uploadBody }),
      fetch('/api/documents/extract', { method: 'POST', body: extractBody }),
    ]);

    setUploading(false);
    setAiExtracting(false);

    if (uploadRes.status === 'fulfilled' && uploadRes.value.ok) {
      const { fileUrl, fileHash } = await uploadRes.value.json();
      setForm(prev => ({ ...prev, file_url: fileUrl, file_hash: fileHash }));
    } else {
      const data =
        uploadRes.status === 'fulfilled' ? await uploadRes.value.json().catch(() => ({})) : {};
      setUploadError(data.error ?? 'Error subiendo archivo');
    }

    if (extractRes.status === 'fulfilled' && extractRes.value.ok) {
      const { extracted } = await extractRes.value.json();
      applyExtraction(extracted as ExtractedDocument);
    }
    // Si la extracción falla o no está configurada, se ignora en silencio: el form sigue manual.
  }
```

- [ ] **Step 5: Añadir el badge reutilizable y el banner de confianza**

Add this small component just above the `export function DocumentForm` declaration (after line 35):

```typescript
function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
      <Sparkles size={10} aria-hidden="true" /> IA
    </span>
  );
}
```

Inside the form, immediately after the opening `<form ...>` tag (line 113), add the extraction state banner:

```typescript
      {aiExtracting && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
          <Sparkles size={15} className="animate-pulse" aria-hidden="true" />
          Analizando documento con IA…
        </div>
      )}
      {!aiExtracting && aiConfidence !== null && (
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-primary">
            <Sparkles size={15} aria-hidden="true" />
            Campos precargados por IA · confianza {Math.round(aiConfidence * 100)}%
          </span>
          {aiSummary && <span className="text-xs text-muted-foreground">{aiSummary}</span>}
          <span className="text-xs text-muted-foreground">Revisá y corregí antes de guardar.</span>
        </div>
      )}
```

- [ ] **Step 6: Mostrar el badge en las etiquetas de los campos precargados**

For each AI-fillable field, append `{aiFields.has('<key>') && <AiBadge />}` to its `<FormField label=...>`. The `FormField` label accepts a string; to render the badge we pass a node. Update these labels:

- Line 119 `document_type`: change `label="Tipo de documento"` to
  ```typescript
  label={<>Tipo de documento {aiFields.has('document_type') && <AiBadge />}</>}
  ```
- Line 131 `document_name`: change `label="Nombre del documento"` to
  ```typescript
  label={<>Nombre del documento {aiFields.has('document_name') && <AiBadge />}</>}
  ```
- Line 144 `issued_at`: change `label="Fecha de emisión"` to
  ```typescript
  label={<>Fecha de emisión {aiFields.has('issued_at') && <AiBadge />}</>}
  ```
- Line 156 `expires_at`: change `label="Fecha de vencimiento"` to
  ```typescript
  label={<>Fecha de vencimiento {aiFields.has('expires_at') && <AiBadge />}</>}
  ```
- Line 169 `criticality`: change `label="Criticidad"` to
  ```typescript
  label={<>Criticidad {aiFields.has('criticality') && <AiBadge />}</>}
  ```

> **Nota de compatibilidad:** verificar que `FormField` (en `components/vendor-pass/form-field.tsx`) acepte `label: React.ReactNode`. Si su prop está tipada como `string`, ampliarla a `React.ReactNode` (cambio de una línea en la interfaz de props). Leer ese archivo antes de editar y ajustar el tipo si hace falta.

- [ ] **Step 7: Verificar tipos y arranque**

Run: `npx tsc --noEmit`
Expected: PASS (si falla por el tipo de `label`, ampliarlo a `React.ReactNode` según la nota del Step 6, luego volver a correr).

- [ ] **Step 8: Commit**

```bash
git add components/vendor-pass/document-form.tsx components/vendor-pass/form-field.tsx
git commit -m "feat(ui): autocompletado de documentos con IA y sellos de confianza"
```

---

## Task 8: Verificación de la demo end-to-end

Confirmar el flujo completo con un documento real antes de la presentación.

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Configurar la clave**

In `.env`, set a real key (obtenela en https://openrouter.ai/keys):
```bash
OPENROUTER_API_KEY=sk-or-...
AI_EXTRACTION_MODEL=google/gemini-2.0-flash-001
```

- [ ] **Step 2: Levantar la app y la suite**

Run: `npm test && npm run dev`
Expected: tests en verde; dev server en `http://localhost:3000`.

- [ ] **Step 3: Probar el flujo**

1. Login → entrar a un proveedor → "Agregar documento".
2. Subir un PDF/foto de un seguro o certificado real.
3. Verificar: aparece "Analizando documento con IA…", luego el banner de confianza y los campos `tipo`, `nombre`, `emisión`, `vencimiento`, `criticidad` precargados con el sello "✨ IA".
4. Corregir si hace falta, guardar.
5. Confirmar que el documento queda creado y que su validación se ancla en Arkiv (verificar en `/verify/[documentId]` o en el panel `/admin/arkiv`).

Expected: la fecha de vencimiento extraída por IA coincide con el documento y dispara correctamente el estado (`vigente`/`por_vencer`/`vencido`).

- [ ] **Step 4: Probar la degradación elegante**

Quitar `OPENROUTER_API_KEY` de `.env`, reiniciar, subir un archivo.
Expected: la subida a S3 funciona, no aparece banner de IA, el formulario se completa manualmente sin errores en consola.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(ai): ajustes finales tras verificación de demo"
```

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Leer documentos automáticamente → Task 5 (`extractDocumentFields` con visión/PDF).
- ✅ Extraer tipo, fechas, póliza, cobertura → Task 5 (tool schema) + Task 3 (normalización).
- ✅ Precargar el formulario con sellos "✨ IA" → Task 7.
- ✅ Confianza visible + revisión humana → Task 7 (banner).
- ✅ Confirmar y anclar en Arkiv → flujo existente intacto (POST /api/documents ya ancla); verificado en Task 8.
- ✅ Degradación sin clave → Tasks 4/6/7 (503 + ignora en silencio).

**2. Placeholders:** sin TODOs ni "manejar errores apropiadamente"; todo el código está completo. La única indicación condicional (tipo de `label` en `FormField`) incluye instrucción exacta de qué cambiar y cómo verificarlo.

**3. Consistencia de tipos:** `RawExtraction` y `ExtractedDocument` (Task 2) se usan idénticos en `normalizeExtraction`/`extractDocumentFields` (Tasks 3/5), en el endpoint (Task 6) y en `applyExtraction` (Task 7). `EXTRACTION_TOOL.function.name = 'registrar_documento'` es el mismo en el schema, el `tool_choice` y la lectura de `tool_calls`. `DOCUMENT_TYPES`/`DOCUMENT_TYPE_VALUES` provienen del módulo único `lib/documents.ts`.

---

## Guion de 60 segundos para el jurado

> "Hoy, una persona de compliance recibe cientos de pólizas en PDF y transcribe fechas a mano — un error y un proveedor crítico queda habilitado por error. **Miren esto.** Subo el certificado… *(sparkle)* …VendorPass lo leyó: tipo, vencimiento, cobertura, todo precargado con su nivel de confianza. Confirmo, y el dato queda **anclado en blockchain (Arkiv), verificable públicamente por cualquiera, sin login.** De papel a prueba inmutable en diez segundos. Eso es lo que ninguna planilla puede hacer."
