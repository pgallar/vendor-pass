import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractDocumentFromBase64, assertAiExtractionAvailable } from '@/lib/api-keys/ai-extract';
import { createDocumentFromFileWithAi } from '@/lib/api-keys/mutations';

vi.mock('@/lib/ai/client', () => ({
  isAiConfigured: vi.fn(() => true),
}));

vi.mock('@/lib/ai/extract', () => ({
  extractDocumentFields: vi.fn(async () => ({
    document_type: 'seguro_rc',
    document_name: 'Póliza RC demo',
    issued_at: '2025-01-01',
    expires_at: '2026-12-31',
    criticality: 'critical' as const,
    issuer: 'Zurich',
    policy_number: 'Z-1',
    coverage: '',
    summary: 'Resumen IA',
    confidence: 0.88,
    fields_found: ['document_type', 'expires_at'],
  })),
}));

vi.mock('@/lib/storage/s3', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/storage/s3')>();
  return {
    ...actual,
    uploadEvidence: vi.fn(async () => ({ url: 'http://storage/test.pdf' })),
  };
});

vi.mock('@/lib/arkiv/validations', () => ({
  getStore: () => ({ upsert: vi.fn(), remove: vi.fn() }),
}));

const USER = 'user-1';
const VENDOR = 'vendor-1';
const PDF_B64 = Buffer.from('%PDF-1.4 test').toString('base64');

describe('MCP AI extract pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.S3_ENDPOINT = 'http://minio:9000';
  });

  it('extractDocumentFromBase64 devuelve campos normalizados', async () => {
    const extracted = await extractDocumentFromBase64({
      content_base64: PDF_B64,
      mime_type: 'application/pdf',
    });
    expect(extracted.document_type).toBe('seguro_rc');
    expect(extracted.expires_at).toBe('2026-12-31');
  });

  it('assertAiExtractionAvailable lanza si no hay clave', async () => {
    const { isAiConfigured } = await import('@/lib/ai/client');
    vi.mocked(isAiConfigured).mockReturnValueOnce(false);
    expect(() => assertAiExtractionAvailable()).toThrow(/OPENROUTER_API_KEY/);
  });

  it('createDocumentFromFileWithAi sube, extrae y crea documento', async () => {
    const insertRow = {
      id: 'doc-new',
      vendor_id: VENDOR,
      document_type: 'seguro_rc',
      document_name: 'Póliza RC demo',
      issued_at: '2025-01-01',
      expires_at: '2026-12-31',
      criticality: 'critical',
      file_url: 'http://storage/test.pdf',
      file_hash: 'hash',
      notes: 'Resumen IA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sb = {
      from: vi.fn((table: string) => {
        if (table === 'vendors') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string) => {
                if (col === 'user_id') {
                  return {
                    maybeSingle: vi.fn(() =>
                      Promise.resolve({ data: { id: VENDOR }, error: null }),
                    ),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() =>
                      Promise.resolve({ data: { id: VENDOR }, error: null }),
                    ),
                  })),
                  maybeSingle: vi.fn(() =>
                    Promise.resolve({
                      data: { name: 'V', owner_email: 'a@b.com', owner_name: 'N' },
                      error: null,
                    }),
                  ),
                };
              }),
            })),
          };
        }
        if (table === 'documents') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: insertRow, error: null })),
              })),
            })),
          };
        }
        throw new Error(`tabla inesperada: ${table}`);
      }),
    };

    const result = await createDocumentFromFileWithAi(sb as never, USER, {
      vendor_id: VENDOR,
      filename: 'poliza.pdf',
      mime_type: 'application/pdf',
      content_base64: PDF_B64,
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error('expected result');
    expect(result.extracted?.document_type).toBe('seguro_rc');
    expect(result.document).not.toBeNull();
    if (!result.document) throw new Error('expected document');
    expect(result.document.id).toBe('doc-new');
    expect(result.upload.fileUrl).toContain('test.pdf');
  });
});
