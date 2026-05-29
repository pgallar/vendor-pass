import { arkivPublicClient, arkivWalletClient, jsonToPayload } from './client';
import { getStoreSource } from './validations';
import { asc, eq } from '@arkiv-network/sdk/query';
import type { ArkivDocumentEvent } from '@/lib/types';

/** Tipo de entidad NUEVO — no toca ENTITY_TYPE ('vendor_document_validation'). */
export const ENTITY_TYPE_EVENT = 'vendor_document_event';

/** Los eventos no caducan junto al documento; se conservan un año mínimo. */
const EVENT_EXPIRES_IN = 60 * 60 * 24 * 365; // 1 año en segundos

function eventAttributes(event: ArkivDocumentEvent) {
  return [
    { key: 'entityType', value: ENTITY_TYPE_EVENT },
    { key: 'documentId', value: event.documentId },
    { key: 'vendorId', value: event.vendorId },
    { key: 'eventType', value: event.eventType },
    { key: 'occurredAt', value: event.occurredAt },
  ];
}

function parseEvent(e: { toJson(): unknown }): ArkivDocumentEvent {
  const raw = e.toJson() as Partial<ArkivDocumentEvent>;
  return {
    documentId: raw.documentId ?? '',
    vendorId: raw.vendorId ?? '',
    eventType: (raw.eventType ?? 'updated') as ArkivDocumentEvent['eventType'],
    occurredAt: raw.occurredAt ?? '',
    payload: (raw.payload as Record<string, unknown>) ?? {},
    parentDocumentId: raw.parentDocumentId ?? null,
  };
}

// Fallback en memoria para dev (mismo criterio que createInMemoryStore en validations.ts).
const memoryEvents: ArkivDocumentEvent[] = [];

/** Ancla un evento en Arkiv (o lo guarda en memoria en dev). Devuelve la entityKey si aplica. */
export async function createEventEntity(event: ArkivDocumentEvent): Promise<{ entityKey: string | null }> {
  if (getStoreSource() !== 'arkiv') {
    memoryEvents.push(event);
    return { entityKey: null };
  }
  const wallet = arkivWalletClient();
  const { entityKey } = await wallet.createEntity({
    payload: jsonToPayload(event),
    attributes: eventAttributes(event),
    contentType: 'application/json',
    expiresIn: EVENT_EXPIRES_IN,
  });
  return { entityKey };
}

/** Lista los eventos anclados de un documento, ordenados por occurredAt asc. */
export async function listEvents(documentId: string): Promise<ArkivDocumentEvent[]> {
  if (getStoreSource() !== 'arkiv') {
    return memoryEvents
      .filter(e => e.documentId === documentId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  const pub = arkivPublicClient();
  const result = await pub
    .buildQuery()
    .where([eq('entityType', ENTITY_TYPE_EVENT), eq('documentId', documentId)])
    .withPayload(true)
    .orderBy(asc('occurredAt', 'string'))
    .fetch();
  return result.entities.map(parseEvent);
}
