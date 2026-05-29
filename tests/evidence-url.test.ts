import { describe, expect, it } from 'vitest';
import { evidencePublicUrl, normalizeEvidenceUrl } from '@/lib/storage/evidence-url';

describe('evidencePublicUrl', () => {
  it('builds app proxy path', () => {
    expect(evidencePublicUrl('evidence/v1/doc.pdf')).toBe(
      'http://localhost:3000/api/files/evidence/v1/doc.pdf',
    );
  });
});

describe('normalizeEvidenceUrl', () => {
  it('rewrites MinIO path-style URLs', () => {
    const raw =
      'http://localhost:9010/vendor-pass-evidence/evidence/v1/abc-doc.pdf';
    expect(normalizeEvidenceUrl(raw)).toBe(
      'http://localhost:3000/api/files/evidence/v1/abc-doc.pdf',
    );
  });

  it('leaves external URLs unchanged', () => {
    const external = 'https://example.com/files/doc.pdf';
    expect(normalizeEvidenceUrl(external)).toBe(external);
  });
});
