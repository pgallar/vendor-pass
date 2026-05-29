function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

type Rendered = { subject: string; text: string; html: string };

function wrap(title: string, bodyLines: string[], cta?: { label: string; url: string }): Rendered {
  const text = [title, '', ...bodyLines, ...(cta ? ['', `${cta.label}: ${cta.url}`] : [])].join('\n');
  const html = [
    `<h2 style="font-family:sans-serif">${title}</h2>`,
    ...bodyLines.map(l => `<p style="font-family:sans-serif;color:#374151">${l}</p>`),
    cta
      ? `<p><a href="${cta.url}" style="font-family:sans-serif;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${cta.label}</a></p>`
      : '',
  ].join('\n');
  return { subject: title, text, html };
}

/** Invitación al portal (incluye el token mágico en la URL pública). */
export function renderPortalInvite(input: { vendorName: string; token: string }): Rendered {
  const url = `${appUrl()}/portal/accept?token=${encodeURIComponent(input.token)}`;
  return wrap(
    `Te invitaron al portal de proveedores de VendorPass`,
    [
      `Fuiste invitado a cargar documentación para "${input.vendorName}".`,
      `El enlace es de un solo uso y vence en 7 días.`,
    ],
    { label: 'Aceptar invitación', url },
  );
}

export function renderDocumentSubmitted(input: { vendorName: string; documentName: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/vendors/${input.vendorId}/reviews`;
  return wrap(
    `Nuevo documento pendiente de revisión`,
    [`"${input.vendorName}" envió "${input.documentName}" para tu aprobación.`],
    { label: 'Revisar', url },
  );
}

export function renderDocumentApproved(input: { documentName: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  return wrap(
    `Tu documento fue aprobado`,
    [`"${input.documentName}" fue aprobado por la empresa.`],
    { label: 'Ver en el portal', url },
  );
}

export function renderDocumentRejected(input: { documentName: string; reason: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  return wrap(
    `Tu documento necesita correcciones`,
    [`"${input.documentName}" fue rechazado.`, `Motivo: ${input.reason}`, `Corregilo y volvé a enviarlo.`],
    { label: 'Corregir documento', url },
  );
}

export function renderDocumentAnchored(input: { documentName: string; verifyUrl: string }): Rendered {
  return wrap(
    `Documento anclado en blockchain`,
    [`"${input.documentName}" fue anclado y ya es verificable públicamente.`],
    { label: 'Ver verificación', url: input.verifyUrl },
  );
}
