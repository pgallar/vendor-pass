import type { SupabaseClient } from '@supabase/supabase-js';
import {
  documentStatus,
  isVendorAllowed,
  vendorComplianceReasons,
  vendorStatus,
} from '@/lib/status';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';
import { getStore, getStoreSource } from '@/lib/arkiv/validations';
import type { VendorDocument } from '@/lib/types';

async function userVendorIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('vendors').select('id').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((v: { id: string }) => v.id);
}

export async function listVendors(supabase: SupabaseClient, userId: string) {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(error.message);

  const list = vendors ?? [];
  const ids = list.map((v: { id: string }) => v.id);
  let docs: VendorDocument[] = [];
  if (ids.length) {
    const r = await supabase.from('documents').select('*').in('vendor_id', ids);
    if (r.error) throw new Error(r.error.message);
    docs = (r.data ?? []) as VendorDocument[];
  }

  return list.map((v: Record<string, unknown>) => {
    const vdocs = docs.filter(d => d.vendor_id === v.id);
    return {
      id: v.id,
      name: v.name,
      category: v.category,
      area: v.area,
      owner_name: v.owner_name,
      owner_email: v.owner_email,
      status: vendorStatus(vdocs),
      documents_count: vdocs.length,
    };
  });
}

export async function getVendorDetail(supabase: SupabaseClient, userId: string, id: string) {
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vendor) return null;

  const r = await supabase
    .from('documents')
    .select('*')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  const docs = (r.data ?? []) as VendorDocument[];

  return { vendor, documents: docs.map(d => ({ ...d, status: documentStatus(d) })) };
}

export async function getVendorCompliance(supabase: SupabaseClient, userId: string, id: string) {
  const detail = await getVendorDetail(supabase, userId, id);
  if (!detail) return null;
  const docs = detail.documents as VendorDocument[];
  return {
    vendorId: id,
    vendorName: detail.vendor.name,
    allowed: isVendorAllowed(docs),
    status: vendorStatus(docs),
    reasons: vendorComplianceReasons(docs),
    documents: docs.map(d => ({
      id: d.id,
      documentName: d.document_name,
      documentType: d.document_type,
      expiresAt: d.expires_at,
      criticality: d.criticality,
      status: documentStatus(d),
    })),
  };
}

export async function listDocuments(supabase: SupabaseClient, userId: string, vendorId?: string) {
  let ids = await userVendorIds(supabase, userId);
  if (vendorId) ids = ids.filter(i => i === vendorId);
  if (!ids.length) return [];

  const r = await supabase
    .from('documents')
    .select('*')
    .in('vendor_id', ids)
    .order('expires_at', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []).map((d: VendorDocument) => ({ ...d, status: documentStatus(d) }));
}

export async function listExpirations(supabase: SupabaseClient, userId: string) {
  const docs = await listDocuments(supabase, userId);
  return docs.filter(d => d.status !== 'vigente');
}

/** Valida un documento del usuario contra su validación anclada en Arkiv. */
export async function verifyDocumentInArkiv(supabase: SupabaseClient, userId: string, docId: string) {
  const ids = await userVendorIds(supabase, userId);
  if (!ids.length) return null;

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .in('vendor_id', ids)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) return null;

  const typed = doc as VendorDocument;
  const expectedStatus = documentStatus(typed);
  const lookup = await getStore().getByDocumentId(docId);

  if (!lookup) {
    return { documentId: docId, found: false, source: getStoreSource(), expectedStatus };
  }

  return {
    documentId: docId,
    found: true,
    source: getStoreSource(),
    entityKey: lookup.entityKey,
    expectedStatus,
    onChainStatus: lookup.entity.status,
    statusMatch: lookup.entity.status === expectedStatus,
    hashMatch: typed.file_hash != null && lookup.entity.fileHash === typed.file_hash,
    validation: lookup.entity,
  };
}

/** Reporte de auditoría: combina el estado de cumplimiento con la paridad DB↔Arkiv. */
export async function buildAuditReport(supabase: SupabaseClient, userId: string) {
  const [vendors, expirations, parity] = await Promise.all([
    listVendors(supabase, userId),
    listExpirations(supabase, userId),
    auditArkivParity({ userId }),
  ]);

  const summary = {
    vendors: vendors.length,
    blocked: vendors.filter(v => v.status === 'bloqueado').length,
    attention: vendors.filter(v => v.status === 'atencion').length,
    ok: vendors.filter(v => v.status === 'ok').length,
    documentsExpiringOrExpired: expirations.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: getStoreSource(),
    summary,
    arkiv: parity,
    conclusion: parity.ok
      ? 'La base de datos y Arkiv están en paridad: cada documento tiene su validación anclada con el estado correcto.'
      : 'Hay discrepancias entre la base de datos y Arkiv. Revisá los documentos faltantes, huérfanos o con estado distinto y ejecutá una sincronización.',
  };
}
