import {
  BRAND_NAME,
  BRAND_TAGLINE,
  EMAIL_BRAND,
  EMAIL_MAX_WIDTH,
  FONT_STACK,
} from '@/lib/email/brand';
import type { Criticality, DocumentStatus } from '@/lib/types';

export type EmailCta = { label: string; url: string };

export type WrapEmailLayoutInput = {
  preheader?: string;
  title?: string;
  bodyHtml: string;
  cta?: EmailCta;
  footerNote?: string;
};

export type PlainTextInput = {
  greeting?: string;
  paragraphs: string[];
  cta?: EmailCta;
  footer?: string;
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  vencido: 'Vencido',
  por_vencer: 'Por vencer',
  vigente: 'Vigente',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderCtaButton(cta: EmailCta): string {
  const label = escapeHtml(cta.label);
  const url = escapeHtml(cta.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
  <tr>
    <td align="center" style="border-radius:8px;background-color:${EMAIL_BRAND.primary}">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${EMAIL_BRAND.primaryForeground};text-decoration:none;border-radius:8px">${label}</a>
    </td>
  </tr>
</table>`;
}

export function renderStatusBadge(status: DocumentStatus): string {
  const colors = EMAIL_BRAND.status[status];
  const label = STATUS_LABEL[status];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-family:${FONT_STACK};font-size:12px;font-weight:600;background-color:${colors.bg};color:${colors.text}">${label}</span>`;
}

export function renderCriticalityBadge(criticality: Criticality): string {
  if (criticality !== 'critical') {
    return `<span style="font-family:${FONT_STACK};font-size:13px;color:${EMAIL_BRAND.muted}">Normal</span>`;
  }
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-family:${FONT_STACK};font-size:12px;font-weight:600;background-color:${EMAIL_BRAND.critical.bg};color:${EMAIL_BRAND.critical.text}">Crítico</span>`;
}

export type AlertTableRow = {
  vendorName: string;
  documentName: string;
  documentType: string;
  expiresAt: string;
  status: DocumentStatus;
  criticality: Criticality;
};

export function renderAlertTable(rows: AlertTableRow[]): string {
  const header = `<tr>
    <th align="left" style="padding:10px 12px;font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};border-bottom:1px solid ${EMAIL_BRAND.border}">Proveedor</th>
    <th align="left" style="padding:10px 12px;font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};border-bottom:1px solid ${EMAIL_BRAND.border}">Documento</th>
    <th align="left" style="padding:10px 12px;font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};border-bottom:1px solid ${EMAIL_BRAND.border}">Vence</th>
    <th align="left" style="padding:10px 12px;font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};border-bottom:1px solid ${EMAIL_BRAND.border}">Estado</th>
    <th align="left" style="padding:10px 12px;font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${EMAIL_BRAND.muted};border-bottom:1px solid ${EMAIL_BRAND.border}">Criticidad</th>
  </tr>`;

  const body = rows
    .map(row => {
      const docLabel = `${escapeHtml(row.documentName)} (${escapeHtml(row.documentType)})`;
      return `<tr>
    <td style="padding:12px;font-family:${FONT_STACK};font-size:14px;color:${EMAIL_BRAND.foreground};border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top"><strong>${escapeHtml(row.vendorName)}</strong></td>
    <td style="padding:12px;font-family:${FONT_STACK};font-size:14px;color:${EMAIL_BRAND.foreground};border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top">${docLabel}</td>
    <td style="padding:12px;font-family:${FONT_STACK};font-size:14px;color:${EMAIL_BRAND.foreground};border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top;white-space:nowrap">${escapeHtml(row.expiresAt)}</td>
    <td style="padding:12px;border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top">${renderStatusBadge(row.status)}</td>
    <td style="padding:12px;border-bottom:1px solid ${EMAIL_BRAND.border};vertical-align:top">${renderCriticalityBadge(row.criticality)}</td>
  </tr>`;
    })
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:16px 0 0;border:1px solid ${EMAIL_BRAND.border};border-radius:8px;overflow:hidden">
  <thead>${header}</thead>
  <tbody>${body}</tbody>
</table>`;
}

function renderEmailHeader(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 0 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:40px;height:40px;border-radius:10px;background-color:${EMAIL_BRAND.primary};text-align:center;vertical-align:middle">
            <span style="font-family:${FONT_STACK};font-size:20px;line-height:40px;color:${EMAIL_BRAND.primaryForeground}">&#10003;</span>
          </td>
          <td style="padding-left:10px;vertical-align:middle">
            <p style="margin:0;font-family:${FONT_STACK};font-size:18px;font-weight:700;color:${EMAIL_BRAND.foreground};line-height:1.2">${BRAND_NAME}</p>
            <p style="margin:2px 0 0;font-family:${FONT_STACK};font-size:12px;color:${EMAIL_BRAND.muted}">${BRAND_TAGLINE}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function wrapEmailLayout(input: WrapEmailLayoutInput): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(input.preheader)}</div>`
    : '';
  const title = input.title
    ? `<h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${EMAIL_BRAND.foreground};line-height:1.3">${escapeHtml(input.title)}</h1>`
    : '';
  const cta = input.cta ? renderCtaButton(input.cta) : '';
  const footerNote = input.footerNote
    ? `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:12px;color:${EMAIL_BRAND.muted}">${escapeHtml(input.footerNote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.title ?? BRAND_NAME)}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.background};font-family:${FONT_STACK}">
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${EMAIL_BRAND.background}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${EMAIL_MAX_WIDTH}" style="max-width:${EMAIL_MAX_WIDTH}px">
          <tr>
            <td>
              ${renderEmailHeader()}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${EMAIL_BRAND.card};border:1px solid ${EMAIL_BRAND.border};border-radius:10px">
                <tr>
                  <td style="padding:28px 24px">
                    ${title}
                    <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${EMAIL_BRAND.foreground}">
                      ${input.bodyHtml}
                    </div>
                    ${cta}
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-family:${FONT_STACK};font-size:12px;color:${EMAIL_BRAND.muted};text-align:center">&mdash; ${BRAND_NAME}</p>
              ${footerNote}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPlainText(input: PlainTextInput): string {
  const parts: string[] = [];
  if (input.greeting) parts.push(input.greeting, '');
  parts.push(...input.paragraphs);
  if (input.cta) {
    parts.push('', `${input.cta.label}: ${input.cta.url}`);
  }
  parts.push('', input.footer ?? `— ${BRAND_NAME}`);
  return parts.join('\n');
}
