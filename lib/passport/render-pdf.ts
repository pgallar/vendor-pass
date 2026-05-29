import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { VendorPassportData } from '@/lib/passport/build-vendor-passport';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: '#1a1a1a', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  org: { fontSize: 14, fontWeight: 'bold' },
  subtitle: { fontSize: 9, color: '#666', marginTop: 2 },
  qr: { width: 90, height: 90 },
  vendorName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  meta: { fontSize: 9, color: '#666', marginBottom: 12 },
  statusPill: { fontSize: 10, fontWeight: 'bold', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', borderBottom: 1, borderColor: '#ccc', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottom: 0.5, borderColor: '#eee' },
  cName: { width: '34%' },
  cType: { width: '20%' },
  cExp: { width: '16%' },
  cStatus: { width: '14%' },
  cAnchor: { width: '16%' },
  cell: { fontSize: 9 },
  mono: { fontSize: 6, color: '#888', marginTop: 1 },
  verifyUrl: { fontSize: 7, color: '#444', marginTop: 4, maxWidth: 200 },
  footer: { position: 'absolute', bottom: 28, left: 36, right: 36, borderTop: 1, borderColor: '#ccc', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#666' },
});

const STATUS_LABEL: Record<string, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

const VENDOR_STATUS_LABEL: Record<string, string> = {
  ok: 'Cumple',
  atencion: 'Requiere atención',
  bloqueado: 'Bloqueado',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export interface PassportPdfInput {
  passport: VendorPassportData;
  qrDataUrl: string;
  /** URL de descarga del PDF (codificada en el QR e impresa bajo el código). */
  pdfDownloadUrl: string;
  organization: string | null;
}

export async function renderPassportPdf(input: PassportPdfInput): Promise<Buffer> {
  const { passport, qrDataUrl, pdfDownloadUrl, organization } = input;
  const e = createElement;

  const headerCells = e(View, { style: styles.tableHeader }, [
    e(Text, { key: 'n', style: [styles.cell, styles.cName] }, 'Documento'),
    e(Text, { key: 't', style: [styles.cell, styles.cType] }, 'Tipo'),
    e(Text, { key: 'x', style: [styles.cell, styles.cExp] }, 'Vence'),
    e(Text, { key: 's', style: [styles.cell, styles.cStatus] }, 'Estado'),
    e(Text, { key: 'a', style: [styles.cell, styles.cAnchor] }, 'Anclaje'),
  ]);

  const rows = passport.documents.map(doc =>
    e(View, { key: doc.id, style: styles.row }, [
      e(View, { key: 'n', style: styles.cName }, [
        e(Text, { key: 'nm', style: styles.cell }, doc.documentName),
        doc.entityKey ? e(Text, { key: 'ek', style: styles.mono }, doc.entityKey) : null,
      ]),
      e(Text, { key: 't', style: [styles.cell, styles.cType] }, doc.documentType),
      e(Text, { key: 'x', style: [styles.cell, styles.cExp] }, formatDate(doc.expiresAt)),
      e(Text, { key: 's', style: [styles.cell, styles.cStatus] }, STATUS_LABEL[doc.status] ?? doc.status),
      e(
        Text,
        { key: 'a', style: [styles.cell, styles.cAnchor] },
        doc.lifecycle === 'anchored' ? 'En red' : doc.lifecycle === 'draft' ? 'Borrador' : 'Pendiente',
      ),
    ]),
  );

  const doc = e(Document, {}, e(Page, { size: 'A4', style: styles.page }, [
    e(View, { key: 'h', style: styles.header }, [
      e(View, { key: 'l' }, [
        e(Text, { key: 'o', style: styles.org }, organization ?? 'VendorPass'),
        e(Text, { key: 's', style: styles.subtitle }, 'Pasaporte de cumplimiento verificable'),
      ]),
      e(View, { key: 'qrCol', style: { alignItems: 'flex-end' } }, [
        e(Image, { key: 'qr', style: styles.qr, src: qrDataUrl }),
        e(Text, { key: 'qrUrl', style: styles.verifyUrl }, pdfDownloadUrl),
      ]),
    ]),
    e(Text, { key: 'vn', style: styles.vendorName }, passport.vendor.name),
    e(
      Text,
      { key: 'vm', style: styles.meta },
      [passport.vendor.category, passport.vendor.area].filter(Boolean).join(' · '),
    ),
    e(
      Text,
      { key: 'st', style: styles.statusPill },
      `Estado general: ${VENDOR_STATUS_LABEL[passport.status] ?? passport.status}`,
    ),
    e(
      Text,
      { key: 'gen', style: styles.meta },
      `Estado al ${new Date(passport.generatedAt).toLocaleString('es-MX')}`,
    ),
    headerCells,
    ...rows,
    e(View, { key: 'f', style: styles.footer }, [
      e(
        Text,
        { key: 'ft', style: styles.footerText },
        'Verificado en Arkiv Network. Escaneá el código QR para consultar el estado vigente en línea. Esta es una attestación técnica del estado registrado, no una validez legal.',
      ),
    ]),
  ]));

  return renderToBuffer(doc);
}
