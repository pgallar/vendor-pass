import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEventPayload } from '@/lib/events/payload';
import { createEventEntity } from '@/lib/arkiv/events';
import type { DocumentEvent, DocumentEventType } from '@/lib/types';

type RecordInput<T extends DocumentEventType> = {
  documentId: string;
  eventType: T;
  /** null = system / cron (sin actor humano). */
  actorUserId: string | null;
  /** Entrada cruda del payload; se pasa tal cual a buildEventPayload. */
  payload: Parameters<typeof buildEventPayload<T>>[1];
  supabase: SupabaseClient;
};

/**
 * Registra un evento del historial:
 *  1) SIEMPRE inserta una fila en document_events (Postgres).
 *  2) Si el documento está anchored (lifecycle_status='anchored'), ancla además
 *     una entidad de evento en Arkiv (best-effort: no rompe el flujo si falla).
 */
export async function recordDocumentEvent<T extends DocumentEventType>(
  input: RecordInput<T>,
): Promise<DocumentEvent> {
  const { documentId, eventType, actorUserId, supabase } = input;
  const payload = buildEventPayload(eventType, input.payload) as Record<string, unknown>;

  const { data: row, error } = await supabase
    .from('document_events')
    .insert({
      document_id: documentId,
      event_type: eventType,
      actor_user_id: actorUserId,
      payload,
    })
    .select('id, document_id, event_type, actor_user_id, payload, created_at')
    .single();
  if (error || !row) {
    throw new Error(error?.message ?? 'No se pudo registrar el evento');
  }
  const event = row as DocumentEvent;

  // ¿El documento está anclado? Solo entonces espejamos a Arkiv.
  const { data: doc } = await supabase
    .from('documents')
    .select('vendor_id, lifecycle_status, supersedes_document_id')
    .eq('id', documentId)
    .maybeSingle();

  if (doc && (doc as { lifecycle_status?: string }).lifecycle_status === 'anchored') {
    try {
      await createEventEntity({
        documentId,
        vendorId: (doc as { vendor_id: string }).vendor_id,
        eventType,
        occurredAt: event.created_at,
        payload,
        parentDocumentId: (doc as { supersedes_document_id: string | null }).supersedes_document_id ?? null,
      });
    } catch (err) {
      // Best-effort: el rastro en Postgres ya quedó. No bloqueamos la operación de negocio.
      console.error('[recordDocumentEvent] no se pudo anclar el evento en Arkiv:', err);
    }
  }

  return event;
}
