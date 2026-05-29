import { listEvents } from '@/lib/arkiv/events';
import { isPublicEvent } from '@/lib/events/payload';
import type { ArkivDocumentEvent } from '@/lib/types';

/**
 * Eventos públicos no sensibles de un documento (anchored, status_recomputed, renewed),
 * leídos de Arkiv (o del store en memoria en dev), más recientes primero, máx. `limit`.
 */
export async function listPublicEvents(documentId: string, limit = 10): Promise<ArkivDocumentEvent[]> {
  const events = await listEvents(documentId);
  return events
    .filter(e => isPublicEvent(e.eventType))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}
