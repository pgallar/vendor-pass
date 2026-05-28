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
};

export async function auditArkivParity(options: AuditOptions = {}): Promise<ParityAuditResult> {
  const sb = options.supabase ?? supabaseAdmin();

  const [{ data: docs, error }, { data: vendors }] = await Promise.all([
    sb.from('documents').select('*'),
    sb.from('vendors').select('id'),
  ]);
  if (error) throw error;

  const vendorIds = new Set((vendors ?? []).map(v => v.id));
  const postgresDocs = (docs ?? []) as VendorDocument[];
  const scoped = options.supabase != null;

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
