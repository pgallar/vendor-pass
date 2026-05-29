import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1a1a1a', fontFamily: 'Helvetica' },
  header: { marginBottom: 24, borderBottom: 1, borderColor: '#e5e7eb', paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#374151', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  statBox: { padding: 10, border: 1, borderColor: '#e5e7eb', borderRadius: 4, width: '31%' },
  statLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: 'bold' },
  statValueOk: { fontSize: 14, fontWeight: 'bold', color: '#059669' },
  statValueWarn: { fontSize: 14, fontWeight: 'bold', color: '#d97706' },
  statValueError: { fontSize: 14, fontWeight: 'bold', color: '#dc2626' },
  parityBox: { padding: 12, borderRadius: 6, marginBottom: 12, backgroundColor: '#f3f4f6' },
  parityBoxOk: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', border: 1 },
  parityBoxError: { backgroundColor: '#fef2f2', borderColor: '#fecaca', border: 1 },
  parityTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  paritySubtitle: { fontSize: 9, color: '#4b5563' },
  listContainer: { marginTop: 8 },
  listHeader: { fontSize: 9, fontWeight: 'bold', marginBottom: 4, color: '#4b5563' },
  listItem: { fontSize: 8, fontFamily: 'Courier', color: '#374151', marginBottom: 2 },
  conclusionBox: { padding: 12, backgroundColor: '#f9fafb', borderLeft: 4, borderColor: '#6366f1', marginTop: 10 },
  conclusionText: { fontSize: 10, lineHeight: 1.5, color: '#1f2937' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: 1, borderColor: '#e5e7eb', paddingTop: 10 },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  
  // Table styles
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  tableColHeader: { borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb', borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: '#f3f4f6' },
  tableCol: { borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb', borderLeftWidth: 0, borderTopWidth: 0 },
  tableCellHeader: { margin: 5, fontSize: 8, fontWeight: 'bold', color: '#374151' },
  tableCell: { margin: 5, fontSize: 8 },
  
  // Custom column widths for Vendors Table
  colVendorName: { width: '30%' },
  colVendorCat: { width: '25%' },
  colVendorArea: { width: '25%' },
  colVendorDocs: { width: '10%' },
  colVendorStatus: { width: '10%' },

  // Custom column widths for Documents Table
  colDocVendor: { width: '20%' },
  colDocName: { width: '25%' },
  colDocType: { width: '20%' },
  colDocExp: { width: '15%' },
  colDocCrit: { width: '10%' },
  colDocStatus: { width: '10%' },
});

export interface AuditReportData {
  generatedAt: string;
  source: string;
  summary: {
    vendors: number;
    blocked: number;
    attention: number;
    ok: number;
    documentsExpiringOrExpired: number;
  };
  vendorsList: { id: string; name: string; category: string; area: string; status: string; documents_count: number }[];
  documentsList: { id: string; vendor_id: string; document_name: string; document_type: string; expires_at: string; criticality: string; status: string }[];
  arkiv: {
    ok: boolean;
    postgresCount: number;
    arkivCount: number;
    missingInArkiv: string[];
    orphanInArkiv: string[];
    mismatches: { documentId: string; postgres: string; arkiv: string }[];
    arkivAvailable?: boolean;
  };
  conclusion: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export async function renderAuditPdf(report: AuditReportData): Promise<Buffer> {
  const e = createElement;

  const generatedDate = new Date(report.generatedAt).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const doc = e(Document, {}, [
    // PÁGINA 1: Resumen y Paridad
    e(Page, { key: 'p1', size: 'A4', style: styles.page, wrap: false }, [
      e(View, { key: 'header', style: styles.header }, [
        e(Text, { key: 'title', style: styles.title }, 'Reporte de Cumplimiento y Auditoría Arkiv'),
        e(Text, { key: 'subtitle', style: styles.subtitle }, `Generado el ${generatedDate} · Entorno: ${report.source}`),
      ]),

      e(View, { key: 'summary', style: styles.section }, [
        e(Text, { key: 's-title', style: styles.sectionTitle }, 'Resumen de Cumplimiento'),
        e(View, { key: 's-grid', style: styles.grid }, [
          e(View, { key: 'box-total', style: styles.statBox }, [
            e(Text, { key: 'l', style: styles.statLabel }, 'Total Proveedores'),
            e(Text, { key: 'v', style: styles.statValue }, report.summary.vendors.toString()),
          ]),
          e(View, { key: 'box-ok', style: styles.statBox }, [
            e(Text, { key: 'l', style: styles.statLabel }, 'Cumplen (OK)'),
            e(Text, { key: 'v', style: styles.statValueOk }, report.summary.ok.toString()),
          ]),
          e(View, { key: 'box-att', style: styles.statBox }, [
            e(Text, { key: 'l', style: styles.statLabel }, 'Requieren Atención'),
            e(Text, { key: 'v', style: report.summary.attention > 0 ? styles.statValueWarn : styles.statValue }, report.summary.attention.toString()),
          ]),
          e(View, { key: 'box-blocked', style: styles.statBox }, [
            e(Text, { key: 'l', style: styles.statLabel }, 'Bloqueados'),
            e(Text, { key: 'v', style: report.summary.blocked > 0 ? styles.statValueError : styles.statValue }, report.summary.blocked.toString()),
          ]),
          e(View, { key: 'box-docs', style: styles.statBox }, [
            e(Text, { key: 'l', style: styles.statLabel }, 'Docs. Vencidos / Por Vencer'),
            e(Text, { key: 'v', style: report.summary.documentsExpiringOrExpired > 0 ? styles.statValueError : styles.statValue }, report.summary.documentsExpiringOrExpired.toString()),
          ]),
        ]),
      ]),

      e(View, { key: 'parity', style: styles.section }, [
        e(Text, { key: 'p-title', style: styles.sectionTitle }, 'Auditoría de Paridad DB ↔ Arkiv'),
        e(View, { key: 'p-box', style: [styles.parityBox, report.arkiv.ok ? styles.parityBoxOk : styles.parityBoxError] }, [
          e(Text, { key: 'p-stat', style: styles.parityTitle }, report.arkiv.arkivAvailable === false ? '⚠️ Auditoría Descentralizada Fuera de Línea' : report.arkiv.ok ? '✅ Paridad Confirmada' : '❌ Discrepancias Detectadas'),
          e(Text, { key: 'p-sub', style: styles.paritySubtitle }, report.arkiv.arkivAvailable === false ? 'No se pudo conectar con el nodo RPC de Arkiv' : `Documentos en Postgres: ${report.arkiv.postgresCount} · Validaciones en Arkiv: ${report.arkiv.arkivCount}`),
        ]),
        report.arkiv.missingInArkiv.length > 0 && e(View, { key: 'p-missing', style: styles.listContainer }, [
          e(Text, { key: 'l-t', style: styles.listHeader }, `Faltantes en Arkiv (${report.arkiv.missingInArkiv.length})`),
          ...report.arkiv.missingInArkiv.map(id => e(Text, { key: id, style: styles.listItem }, `• ${id}`)),
        ]),
        report.arkiv.orphanInArkiv.length > 0 && e(View, { key: 'p-orphan', style: styles.listContainer }, [
          e(Text, { key: 'l-t', style: styles.listHeader }, `Huérfanos en Arkiv (${report.arkiv.orphanInArkiv.length})`),
          ...report.arkiv.orphanInArkiv.map(id => e(Text, { key: id, style: styles.listItem }, `• ${id}`)),
        ]),
        report.arkiv.mismatches.length > 0 && e(View, { key: 'p-mismatch', style: styles.listContainer }, [
          e(Text, { key: 'l-t', style: styles.listHeader }, `Estados Desincronizados (${report.arkiv.mismatches.length})`),
          ...report.arkiv.mismatches.map(m => e(Text, { key: m.documentId, style: styles.listItem }, `• ${m.documentId}: Postgres (${m.postgres}) vs Arkiv (${m.arkiv})`)),
        ]),
      ]),

      e(View, { key: 'conclusion', style: styles.conclusionBox }, [
        e(Text, { key: 'c-t', style: styles.conclusionText }, report.conclusion),
      ]),

      e(View, { key: 'footer', style: styles.footer, fixed: true }, [
        e(Text, { key: 'f-t', style: styles.footerText }, 'VendorPass - Sistema de validación y cumplimiento descentralizado'),
      ]),
    ]),

    // PÁGINA 2: Inventario de Proveedores
    e(Page, { key: 'p2', size: 'A4', style: styles.page, wrap: true }, [
      e(Text, { key: 'vt', style: [styles.sectionTitle, { marginBottom: 12 }] }, 'Inventario de Proveedores'),
      e(View, { key: 'vtable', style: styles.table }, [
        e(View, { key: 'vth', style: styles.tableRow }, [
          e(View, { key: 'th1', style: [styles.tableColHeader, styles.colVendorName] }, [e(Text, { key: 't1', style: styles.tableCellHeader }, 'Proveedor')]),
          e(View, { key: 'th2', style: [styles.tableColHeader, styles.colVendorCat] }, [e(Text, { key: 't2', style: styles.tableCellHeader }, 'Categoría')]),
          e(View, { key: 'th3', style: [styles.tableColHeader, styles.colVendorArea] }, [e(Text, { key: 't3', style: styles.tableCellHeader }, 'Área')]),
          e(View, { key: 'th4', style: [styles.tableColHeader, styles.colVendorDocs] }, [e(Text, { key: 't4', style: styles.tableCellHeader }, 'Docs')]),
          e(View, { key: 'th5', style: [styles.tableColHeader, styles.colVendorStatus] }, [e(Text, { key: 't5', style: styles.tableCellHeader }, 'Estado')]),
        ]),
        ...(report.vendorsList || []).map(v => 
          e(View, { key: v.id, style: styles.tableRow, wrap: false }, [
            e(View, { key: 'td1', style: [styles.tableCol, styles.colVendorName] }, [e(Text, { key: 't1', style: styles.tableCell }, v.name || 'N/A')]),
            e(View, { key: 'td2', style: [styles.tableCol, styles.colVendorCat] }, [e(Text, { key: 't2', style: styles.tableCell }, v.category || 'N/A')]),
            e(View, { key: 'td3', style: [styles.tableCol, styles.colVendorArea] }, [e(Text, { key: 't3', style: styles.tableCell }, v.area || 'N/A')]),
            e(View, { key: 'td4', style: [styles.tableCol, styles.colVendorDocs] }, [e(Text, { key: 't4', style: styles.tableCell }, String(v.documents_count || 0))]),
            e(View, { key: 'td5', style: [styles.tableCol, styles.colVendorStatus] }, [e(Text, { key: 't5', style: styles.tableCell }, v.status || 'N/A')]),
          ])
        )
      ]),
      e(View, { key: 'footer2', style: styles.footer, fixed: true }, [
        e(Text, { key: 'f-t2', style: styles.footerText }, 'VendorPass - Sistema de validación y cumplimiento descentralizado'),
      ]),
    ]),

    // PÁGINA 3: Inventario Detallado de Documentos
    e(Page, { key: 'p3', size: 'A4', style: styles.page, wrap: true, orientation: 'landscape' }, [
      e(Text, { key: 'dt', style: [styles.sectionTitle, { marginBottom: 12 }] }, 'Inventario Detallado de Documentos'),
      e(View, { key: 'dtable', style: styles.table }, [
        e(View, { key: 'dth', style: styles.tableRow }, [
          e(View, { key: 'th1', style: [styles.tableColHeader, styles.colDocVendor] }, [e(Text, { key: 't1', style: styles.tableCellHeader }, 'Proveedor')]),
          e(View, { key: 'th2', style: [styles.tableColHeader, styles.colDocName] }, [e(Text, { key: 't2', style: styles.tableCellHeader }, 'Documento')]),
          e(View, { key: 'th3', style: [styles.tableColHeader, styles.colDocType] }, [e(Text, { key: 't3', style: styles.tableCellHeader }, 'Tipo')]),
          e(View, { key: 'th4', style: [styles.tableColHeader, styles.colDocExp] }, [e(Text, { key: 't4', style: styles.tableCellHeader }, 'Vencimiento')]),
          e(View, { key: 'th5', style: [styles.tableColHeader, styles.colDocCrit] }, [e(Text, { key: 't5', style: styles.tableCellHeader }, 'Criticidad')]),
          e(View, { key: 'th6', style: [styles.tableColHeader, styles.colDocStatus] }, [e(Text, { key: 't6', style: styles.tableCellHeader }, 'Estado')]),
        ]),
        ...(report.documentsList || []).map(d => {
          const vendor = report.vendorsList?.find(v => v.id === d.vendor_id);
          return e(View, { key: d.id, style: styles.tableRow, wrap: false }, [
            e(View, { key: 'td1', style: [styles.tableCol, styles.colDocVendor] }, [e(Text, { key: 't1', style: styles.tableCell }, vendor?.name || 'Desconocido')]),
            e(View, { key: 'td2', style: [styles.tableCol, styles.colDocName] }, [e(Text, { key: 't2', style: styles.tableCell }, d.document_name || 'N/A')]),
            e(View, { key: 'td3', style: [styles.tableCol, styles.colDocType] }, [e(Text, { key: 't3', style: styles.tableCell }, d.document_type || 'N/A')]),
            e(View, { key: 'td4', style: [styles.tableCol, styles.colDocExp] }, [e(Text, { key: 't4', style: styles.tableCell }, formatDate(d.expires_at))]),
            e(View, { key: 'td5', style: [styles.tableCol, styles.colDocCrit] }, [e(Text, { key: 't5', style: styles.tableCell }, d.criticality || 'N/A')]),
            e(View, { key: 'td6', style: [styles.tableCol, styles.colDocStatus] }, [e(Text, { key: 't6', style: styles.tableCell }, d.status || 'N/A')]),
          ]);
        })
      ]),
      e(View, { key: 'footer3', style: styles.footer, fixed: true }, [
        e(Text, { key: 'f-t3', style: styles.footerText }, 'VendorPass - Sistema de validación y cumplimiento descentralizado'),
      ]),
    ]),
  ]);

  return renderToBuffer(doc);
}
