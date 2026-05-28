import { describe, it, expect } from 'vitest';
import { renderExpirationDigest } from '@/lib/email/templates/expiration-digest';

describe('renderExpirationDigest', () => {
  it('includes vendor, document and expiry in body', () => {
    const { subject, text, html } = renderExpirationDigest({
      recipientName: 'Ana Pérez',
      alerts: [
        {
          vendorName: 'Constructora Sur S.A.',
          documentName: 'Póliza ART 2026',
          documentType: 'poliza_art',
          expiresAt: '2026-06-15',
          status: 'por_vencer',
          criticality: 'critical',
        },
      ],
    });

    expect(subject).toBe('VendorPass: 1 documento(s) requieren atención');
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Constructora Sur S.A.');
    expect(text).toContain('Póliza ART 2026');
    expect(text).toContain('2026-06-15');
    expect(html).toContain('Constructora Sur S.A.');
    expect(html).toContain('/expirations');
  });

  it('subject reflects alert count', () => {
    const { subject } = renderExpirationDigest({
      recipientName: null,
      alerts: [
        {
          vendorName: 'A',
          documentName: 'Doc 1',
          documentType: 't1',
          expiresAt: '2026-06-01',
          status: 'vencido',
          criticality: 'critical',
        },
        {
          vendorName: 'B',
          documentName: 'Doc 2',
          documentType: 't2',
          expiresAt: '2026-06-10',
          status: 'por_vencer',
          criticality: 'normal',
        },
      ],
    });

    expect(subject).toBe('VendorPass: 2 documento(s) requieren atención');
  });
});
