import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export type ParityAuditResult = {
  postgresCount: number;
  arkivCount: number;
  missingInArkiv: string[];
  orphanInArkiv: string[];
  mismatches: Array<{ documentId: string; postgres: string; arkiv: string }>;
  ok: boolean;
};

type AuditOptions = {
  supabase?: SupabaseClient;
  /** Scope por dueño cuando se usa el cliente service-role (sin RLS), p. ej. auth por API key. */
  userId?: string;
};

export async function auditArkivParity(options: AuditOptions = {}): Promise<ParityAuditResult> {
  const sb = options.supabase ?? supabaseAdmin();
  const scoped = options.supabase != null || options.userId != null;

  let vendorsQuery = sb.from('vendors').select('id');
  if (options.userId) vendorsQuery = vendorsQuery.eq('user_id', options.userId);
  const { data: vendors, error: vendorsError } = await vendorsQuery;
  if (vendorsError) throw vendorsError;
  const vendorIds = new Set((vendors ?? []).map(v => v.id));

  let docsQuery = sb.from('documents').select('*');
  if (options.userId) docsQuery = docsQuery.in('vendor_id', [...vendorIds]);
  const { data: docs, error } = await docsQuery;
  if (error) throw error;

  const postgresDocs = (docs ?? []) as VendorDocument[];

  const store = getStore();
  const allArkiv = await store.listAll();
  const arkivEntities = scoped
    ? allArkiv.filter(e => vendorIds.has(e.vendorId))
    : allArkiv;
  const arkivById = new Map(arkivEntities.map(e => [e.documentId, e]));

  const missingInArkiv: string[] = [];
  const mismatches: ParityAuditResult['mismatches'] = [];

  for (const doc of postgresDocs) {
    const expected = documentStatus(doc);
    const arkiv = arkivById.get(doc.id);
    if (!arkiv) {
      missingInArkiv.push(doc.id);
      continue;
    }
    if (arkiv.status !== expected) {
      mismatches.push({ documentId: doc.id, postgres: expected, arkiv: arkiv.status });
    }
    arkivById.delete(doc.id);
  }

  const orphanInArkiv = [...arkivById.keys()];
  const ok = missingInArkiv.length === 0 && orphanInArkiv.length === 0 && mismatches.length === 0;

  return {
    postgresCount: postgresDocs.length,
    arkivCount: arkivEntities.length,
    missingInArkiv,
    orphanInArkiv,
    mismatches,
    ok,
  };
}
