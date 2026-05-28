import type { Criticality, DocumentStatus } from '@/lib/types';

export type ExpirationAlertItem = {
  vendorName: string;
  documentName: string;
  documentType: string;
  expiresAt: string;
  status: DocumentStatus;
  criticality: Criticality;
};

const STATUS_ORDER: Record<DocumentStatus, number> = {
  vencido: 0,
  por_vencer: 1,
  vigente: 2,
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  vencido: 'Vencido',
  por_vencer: 'Por vencer',
  vigente: 'Vigente',
};

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function sortAlerts(alerts: ExpirationAlertItem[]): ExpirationAlertItem[] {
  return [...alerts].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.expiresAt.localeCompare(b.expiresAt);
  });
}

function formatAlertLine(item: ExpirationAlertItem): string {
  const crit = item.criticality === 'critical' ? 'Crítico' : 'Normal';
  return `- ${item.vendorName}: ${item.documentName} (${item.documentType}) — vence ${item.expiresAt} — ${STATUS_LABEL[item.status]} — ${crit}`;
}

export function renderExpirationDigest(input: {
  recipientName: string | null;
  alerts: ExpirationAlertItem[];
}): { subject: string; text: string; html: string } {
  const sorted = sortAlerts(input.alerts);
  const count = sorted.length;
  const subject = `VendorPass: ${count} documento(s) requieren atención`;
  const greeting = input.recipientName ? `Hola ${input.recipientName},` : 'Hola,';
  const lines = sorted.map(formatAlertLine);
  const expirationsUrl = `${appUrl()}/expirations`;

  const text = [
    greeting,
    '',
    `Tienes ${count} documento(s) de proveedores que requieren atención:`,
    '',
    ...lines,
    '',
    `Ver detalle: ${expirationsUrl}`,
    '',
    '— VendorPass',
  ].join('\n');

  const listItems = sorted
    .map(
      item => `<li><strong>${item.vendorName}</strong>: ${item.documentName} (${item.documentType}) — vence ${item.expiresAt} — ${STATUS_LABEL[item.status]} — ${item.criticality === 'critical' ? 'Crítico' : 'Normal'}</li>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;line-height:1.5;color:#111">
  <p>${greeting}</p>
  <p>Tienes <strong>${count}</strong> documento(s) de proveedores que requieren atención:</p>
  <ul>${listItems}</ul>
  <p><a href="${expirationsUrl}">Ver vencimientos en VendorPass</a></p>
  <p style="color:#666;font-size:12px">— VendorPass</p>
</body>
</html>`;

  return { subject, text, html };
}
