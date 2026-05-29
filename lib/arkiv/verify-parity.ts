import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getStore, type ValidationEntity } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export type ParityAuditResult = {
  postgresCount: number;
  arkivCount: number;
  missingInArkiv: string[];
  orphanInArkiv: string[];
  mismatches: Array<{ documentId: string; postgres: string; arkiv: string }>;
  expectedMissingInArkiv: string[];
  ok: boolean;
  arkivAvailable?: boolean;
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
  let arkivEntities: ValidationEntity[] = [];
  let arkivAvailable = true;

  try {
    // Usamos listAll() que realiza una única consulta optimizada por proyecto,
    // evitando saturar el nodo RPC con múltiples peticiones en paralelo.
    const allArkiv = await store.listAll();
    arkivEntities = scoped
      ? allArkiv.filter(e => vendorIds.has(e.vendorId))
      : allArkiv;
  } catch (err) {
    console.error('Error al conectar con Arkiv RPC para auditoría de paridad:', err);
    arkivAvailable = false;
  }

  const arkivById = new Map(arkivEntities.map(e => [e.documentId, e]));

  const missingInArkiv: string[] = [];
  const expectedMissingInArkiv: string[] = [];
  const mismatches: ParityAuditResult['mismatches'] = [];

  if (arkivAvailable) {
    for (const doc of postgresDocs) {
      const arkiv = arkivById.get(doc.id);

      // Los borradores / pendientes no se esperan en Arkiv: aún no se anclaron.
      if (doc.lifecycle_status !== 'anchored') {
        if (arkiv) arkivById.delete(doc.id); // si por algún motivo está, no es huérfano
        else expectedMissingInArkiv.push(doc.id);
        continue;
      }

      const expected = documentStatus(doc);
      if (!arkiv) {
        missingInArkiv.push(doc.id);
        continue;
      }
      if (arkiv.status !== expected) {
        mismatches.push({ documentId: doc.id, postgres: expected, arkiv: arkiv.status });
      }
      arkivById.delete(doc.id);
    }
  }

  const orphanInArkiv = arkivAvailable ? [...arkivById.keys()] : [];
  const ok = arkivAvailable && missingInArkiv.length === 0 && orphanInArkiv.length === 0 && mismatches.length === 0;

  return {
    postgresCount: postgresDocs.length,
    arkivCount: arkivEntities.length,
    missingInArkiv,
    orphanInArkiv,
    mismatches,
    expectedMissingInArkiv,
    ok,
    arkivAvailable,
  };
}
