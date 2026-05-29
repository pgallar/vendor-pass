import { buildPlainText, wrapEmailLayout } from '@/lib/email/templates/layout';
import { EMAIL_BRAND } from '@/lib/email/brand';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

type Rendered = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPortalEmail(input: {
  subject: string;
  title: string;
  preheader: string;
  bodyLines: string[];
  cta?: { label: string; url: string };
}): Rendered {
  const bodyHtml = input.bodyLines
    .map(line => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
    .join('');

  const text = buildPlainText({
    paragraphs: [input.title, '', ...input.bodyLines],
    cta: input.cta,
  });

  const html = wrapEmailLayout({
    preheader: input.preheader,
    title: input.title,
    bodyHtml,
    cta: input.cta,
  });

  return { subject: input.subject, text, html };
}

/** Invitación al portal (incluye el token mágico en la URL pública). */
export function renderPortalInvite(input: { vendorName: string; token: string }): Rendered {
  const url = `${appUrl()}/portal/accept?token=${encodeURIComponent(input.token)}`;
  const title = 'Te invitaron al portal de proveedores de VendorPass';
  return renderPortalEmail({
    subject: title,
    title: 'Invitación al portal',
    preheader: `Cargá documentación para ${input.vendorName}`,
    bodyLines: [
      `Fuiste invitado a cargar documentación para "${input.vendorName}".`,
      'El enlace es de un solo uso y vence en 7 días.',
    ],
    cta: { label: 'Aceptar invitación', url },
  });
}

export function renderDocumentSubmitted(input: {
  vendorName: string;
  documentName: string;
  vendorId: string;
}): Rendered {
  const url = `${appUrl()}/vendors/${input.vendorId}/reviews`;
  const title = 'Nuevo documento pendiente de revisión';
  return renderPortalEmail({
    subject: title,
    title,
    preheader: `${input.vendorName} envió ${input.documentName} para revisión`,
    bodyLines: [`"${input.vendorName}" envió "${input.documentName}" para tu aprobación.`],
    cta: { label: 'Revisar', url },
  });
}

export function renderDocumentApproved(input: { documentName: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  const title = 'Tu documento fue aprobado';
  return renderPortalEmail({
    subject: title,
    title,
    preheader: `${input.documentName} fue aprobado`,
    bodyLines: [`"${input.documentName}" fue aprobado por la empresa.`],
    cta: { label: 'Ver en el portal', url },
  });
}

export function renderDocumentRejected(input: {
  documentName: string;
  reason: string;
  vendorId: string;
}): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  const title = 'Tu documento necesita correcciones';
  return renderPortalEmail({
    subject: title,
    title,
    preheader: `${input.documentName} necesita correcciones`,
    bodyLines: [
      `"${input.documentName}" fue rechazado.`,
      `Motivo: ${input.reason}`,
      'Corregilo y volvé a enviarlo.',
    ],
    cta: { label: 'Corregir documento', url },
  });
}

export function renderDocumentAnchored(input: { documentName: string; verifyUrl: string }): Rendered {
  const title = 'Documento anclado en blockchain';
  return renderPortalEmail({
    subject: title,
    title,
    preheader: `${input.documentName} fue anclado y es verificable`,
    bodyLines: [`"${input.documentName}" fue anclado y ya es verificable públicamente.`],
    cta: { label: 'Ver verificación', url: input.verifyUrl },
  });
}
