import { describe, it, expect } from 'vitest';
import type OpenAI from 'openai';
import {
  mapDocumentType,
  normalizeDate,
  normalizeExtraction,
  extractDocumentFields,
  EXTRACTION_TOOL,
} from '@/lib/ai/extract';

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
