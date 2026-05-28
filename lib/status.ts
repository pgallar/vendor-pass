import type { VendorDocument, DocumentStatus, VendorStatus, Criticality } from './types';

const MS_PER_DAY = 86_400_000;

export type ComplianceReason = {
  documentId: string;
  documentName: string;
  documentType: string;
  status: DocumentStatus;
  criticality: Criticality;
  expiresAt: string;
};

export function documentStatus(doc: VendorDocument, now: Date = new Date()): DocumentStatus {
  const expires = new Date(doc.expires_at + 'T00:00:00Z');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = Math.floor((expires.getTime() - today.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'por_vencer';
  return 'vigente';
}

export function vendorStatus(docs: VendorDocument[], now: Date = new Date()): VendorStatus {
  const critical = docs.filter(d => d.criticality === 'critical');
  if (critical.length === 0) return 'ok';
  const statuses = critical.map(d => documentStatus(d, now));
  if (statuses.includes('vencido')) return 'bloqueado';
  if (statuses.includes('por_vencer')) return 'atencion';
  return 'ok';
}

export function vendorComplianceReasons(
  docs: VendorDocument[],
  now: Date = new Date(),
): ComplianceReason[] {
  return docs
    .filter(d => d.criticality === 'critical')
    .map(d => ({ doc: d, status: documentStatus(d, now) }))
    .filter(({ status }) => status !== 'vigente')
    .map(({ doc, status }) => ({
      documentId: doc.id,
      documentName: doc.document_name,
      documentType: doc.document_type,
      status,
      criticality: doc.criticality,
      expiresAt: doc.expires_at,
    }));
}

export function isVendorAllowed(docs: VendorDocument[], now: Date = new Date()): boolean {
  return vendorStatus(docs, now) !== 'bloqueado';
}
