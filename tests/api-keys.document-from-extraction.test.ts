import { describe, it, expect } from 'vitest';
import { buildDocumentInputFromExtraction } from '@/lib/api-keys/document-from-extraction';
import type { ExtractedDocument } from '@/lib/types';

const extracted: ExtractedDocument = {
  document_type: 'poliza_art',
  document_name: 'Póliza ART 1234',
  issued_at: '2025-01-01',
  expires_at: '2026-12-31',
  criticality: 'critical',
  issuer: 'Galeno ART',
  policy_number: 'POL-99',
  coverage: '$ 5.000.000',
  summary: 'Cobertura de accidentes de trabajo.',
  confidence: 0.92,
  fields_found: ['document_type', 'expires_at'],
};

describe('buildDocumentInputFromExtraction', () => {
  it('usa campos de la IA cuando no hay overrides', () => {
    const input = buildDocumentInputFromExtraction(
      'vendor-1',
      { fileUrl: 'http://example.com/a.pdf', fileHash: 'abc' },
      extracted,
      {},
    );
    expect(input.document_type).toBe('poliza_art');
    expect(input.document_name).toBe('Póliza ART 1234');
    expect(input.issued_at).toBe('2025-01-01');
    expect(input.expires_at).toBe('2026-12-31');
    expect(input.notes).toContain('Galeno ART');
    expect(input.notes).toContain('POL-99');
  });

  it('los overrides explícitos tienen prioridad', () => {
    const input = buildDocumentInputFromExtraction(
      'vendor-1',
      { fileUrl: 'http://example.com/a.pdf', fileHash: 'abc' },
      extracted,
      { document_name: 'Nombre manual', expires_at: '2027-01-01' },
    );
    expect(input.document_name).toBe('Nombre manual');
    expect(input.expires_at).toBe('2027-01-01');
    expect(input.document_type).toBe('poliza_art');
  });

  it('falla sin IA ni overrides suficientes', () => {
    expect(() =>
      buildDocumentInputFromExtraction(
        'vendor-1',
        { fileUrl: 'http://example.com/a.pdf', fileHash: 'abc' },
        null,
        {},
      ),
    ).toThrow(/document_type requerido/);
  });
});
