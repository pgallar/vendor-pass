import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { writeSyncState } from '@/lib/arkiv/sync-state';
import { recordDocumentEvent } from '@/lib/events/record';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export type SyncDocumentsResult = {
  total: number;
  synced: number;
  failed: number;
  pendingAnchor: number;
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

  const { data: allDocs, error } = await sb.from('documents').select('*');
  if (error) throw error;

  const typed = (allDocs ?? []) as VendorDocument[];
  const active = typed.filter(d => !d.superseded_by_document_id);
  // El sync masivo solo re-ancla documentos ya anclados (mantiene su status al día).
  // Los borradores quedan fuera y se reportan como pendientes de anclaje.
  const anchored = active.filter(d => d.lifecycle_status === 'anchored');
  const pendingAnchor = active.length - anchored.length;

  const { data: vendors } = await sb.from('vendors').select('id,name,owner_email,owner_name');
  const vendorById = new Map((vendors ?? []).map(v => [v.id, v]));
  const store = getStore();
  const syncedAt = new Date().toISOString();

  const result: SyncDocumentsResult = {
    total: anchored.length,
    synced: 0,
    failed: 0,
    pendingAnchor,
    errors: [],
  };

  for (const d of anchored) {
    try {
      const existing = await store.getByDocumentId(d.id);
      const oldStatus = existing?.entity.status ?? documentStatus(d);
      const entity = documentToValidationEntity(d, vendorById.get(d.vendor_id), syncedAt);
      const newStatus = entity.status;

      if (newStatus !== oldStatus) {
        await recordDocumentEvent({
          documentId: d.id,
          eventType: 'status_recomputed',
          actorUserId: null,
          payload: { oldStatus, newStatus },
          supabase: sb,
        });
      }

      await store.upsert(entity);
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
