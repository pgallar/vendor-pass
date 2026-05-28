import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { writeSyncState } from '@/lib/arkiv/sync-state';
import type { VendorDocument } from '@/lib/types';

export type SyncDocumentsResult = {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ documentId: string; message: string }>;
};

type SyncOptions = {
  /** Cliente con sesión del usuario (RLS). Sin esto, sync global vía service_role (cron/scripts). */
  supabase?: SupabaseClient;
  /** Persistir estado global de sync (solo cron/admin). */
  writeSyncState?: boolean;
};

/** Recalcula status desde Postgres y upsert en Arkiv (create o update). */
export async function syncDocumentsToArkiv(options: SyncOptions = {}): Promise<SyncDocumentsResult> {
  const sb = options.supabase ?? supabaseAdmin();
  const persistState = options.writeSyncState ?? options.supabase == null;

  const { data: docs, error } = await sb.from('documents').select('*');
  if (error) throw error;

  const { data: vendors } = await sb.from('vendors').select('id,name,owner_email,owner_name');
  const vendorById = new Map((vendors ?? []).map(v => [v.id, v]));
  const store = getStore();
  const syncedAt = new Date().toISOString();

  const result: SyncDocumentsResult = {
    total: (docs ?? []).length,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const d of (docs ?? []) as VendorDocument[]) {
    try {
      await store.upsert(documentToValidationEntity(d, vendorById.get(d.vendor_id), syncedAt));
      result.synced++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        documentId: d.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (persistState && result.failed === 0) {
    writeSyncState({
      completedAt: syncedAt,
      synced: result.synced,
      failed: result.failed,
    });
  }

  return result;
}
