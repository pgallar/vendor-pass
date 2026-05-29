import { describe, it, expect } from 'vitest';
import {
  renderPortalInvite,
  renderDocumentSubmitted,
  renderDocumentApproved,
  renderDocumentRejected,
  renderDocumentAnchored,
} from '@/lib/email/templates/portal';

describe('renderPortalInvite', () => {
  it('uses branded layout with invite data and CTA', () => {
    const { subject, text, html } = renderPortalInvite({
      vendorName: 'Catering Gourmet Express',
      token: 'vpi_test_token',
    });

    expect(subject).toBe('Te invitaron al portal de proveedores de VendorPass');
    expect(text).toContain('Catering Gourmet Express');
    expect(text).toContain('Aceptar invitación:');
    expect(text).toContain('/portal/accept?token=vpi_test_token');
    expect(html).toContain('lang="es"');
    expect(html).toContain('VendorPass');
    expect(html).toContain('Cumplimiento de proveedores');
    expect(html).toContain('Catering Gourmet Express');
    expect(html).toContain('Aceptar invitación');
    expect(html).toContain('#4f46e5');
    expect(html).toContain('/portal/accept?token=vpi_test_token');
  });
});

describe('renderDocumentSubmitted', () => {
  it('includes review link in branded HTML', () => {
    const { html } = renderDocumentSubmitted({
      vendorName: 'Proveedor A',
      documentName: 'ART 2026',
      vendorId: 'vendor-1',
    });

    expect(html).toContain('Nuevo documento pendiente de revisión');
    expect(html).toContain('/vendors/vendor-1/reviews');
    expect(html).toContain('VendorPass');
  });
});

describe('renderDocumentApproved', () => {
  it('includes portal link', () => {
    const { html } = renderDocumentApproved({
      documentName: 'Seguro',
      vendorId: 'vendor-2',
    });

    expect(html).toContain('/portal/vendors/vendor-2');
    expect(html).toContain('Ver en el portal');
  });
});

describe('renderDocumentRejected', () => {
  it('includes rejection reason and correction link', () => {
    const { text, html } = renderDocumentRejected({
      documentName: 'Póliza',
      reason: 'Fecha ilegible',
      vendorId: 'vendor-3',
    });

    expect(text).toContain('Fecha ilegible');
    expect(html).toContain('Corregir documento');
    expect(html).toContain('/portal/vendors/vendor-3');
  });
});

describe('renderDocumentAnchored', () => {
  it('includes verification URL', () => {
    const { html } = renderDocumentAnchored({
      documentName: 'ART',
      verifyUrl: 'https://example.com/verify/doc-1',
    });

    expect(html).toContain('https://example.com/verify/doc-1');
    expect(html).toContain('Ver verificación');
  });
});
