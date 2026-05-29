import { describe, it, expect } from 'vitest';
import { listPublicEvents } from '@/lib/events/public';
import { createEventEntity, listEvents } from '@/lib/arkiv/events';
import { isPublicEvent, buildEventPayload, diffDocumentFields } from '@/lib/events/payload';
import type { ArkivDocumentEvent, VendorDocument } from '@/lib/types';

delete process.env.ARKIV_RPC_URL;
delete process.env.ARKIV_PRIVATE_KEY;

const baseDoc: VendorDocument = {
  id: 'doc-1', vendor_id: 'ven-1', document_type: 'poliza', document_name: 'ART',
  issued_at: '2026-01-01', expires_at: '2026-12-31', criticality: 'critical',
  file_url: null, file_hash: 'h-a', notes: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  lifecycle_status: 'anchored', anchored_at: null, arkiv_entity_key: null,
  supersedes_document_id: null, superseded_by_document_id: null,
  review_status: 'approved', rejection_reason: null, submitted_by_portal: false, submitted_by: null,
};

function event(type: ArkivDocumentEvent['eventType'], occurredAt: string, payload = {}): ArkivDocumentEvent {
  return { documentId: 'doc-1', vendorId: 'ven-1', eventType: type, occurredAt, payload, parentDocumentId: null };
}

describe('secuencia created → anchored → status_recomputed (en memoria)', () => {
  it('ancla y lista eventos en orden cronológico', async () => {
    await createEventEntity({ ...event('created', '2026-01-01T00:00:00Z'), documentId: 'seq-1' });
    await createEventEntity({ ...event('anchored', '2026-01-02T00:00:00Z'), documentId: 'seq-1' });
    await createEventEntity({ ...event('status_recomputed', '2026-03-01T00:00:00Z'), documentId: 'seq-1' });

    const all = await listEvents('seq-1');
    expect(all.map(e => e.eventType)).toEqual(['created', 'anchored', 'status_recomputed']);
  });
});

describe('filtrado público', () => {
  it('excluye created, updated, revoked y file_replaced', async () => {
    await createEventEntity({ ...event('created', '2026-01-01T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('anchored', '2026-01-02T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('updated', '2026-01-03T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('status_recomputed', '2026-02-01T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('revoked', '2026-02-02T00:00:00Z'), documentId: 'pub-1' });

    const pub = await listPublicEvents('pub-1');
    const types = pub.map(e => e.eventType);
    expect(types).toContain('anchored');
    expect(types).toContain('status_recomputed');
    expect(types).not.toContain('created');
    expect(types).not.toContain('updated');
    expect(types).not.toContain('revoked');
  });

  it('isPublicEvent solo aprueba anchored/status_recomputed/renewed', () => {
    expect(isPublicEvent('anchored')).toBe(true);
    expect(isPublicEvent('status_recomputed')).toBe(true);
    expect(isPublicEvent('renewed')).toBe(true);
    expect(isPublicEvent('created')).toBe(false);
    expect(isPublicEvent('updated')).toBe(false);
    expect(isPublicEvent('revoked')).toBe(false);
    expect(isPublicEvent('file_replaced')).toBe(false);
  });
});

describe('renovación (supersede)', () => {
  it('el evento renewed referencia al documento anterior y es público', async () => {
    const payload = buildEventPayload('renewed', { supersedesDocumentId: 'doc-old' });
    expect(payload).toEqual({ supersedesDocumentId: 'doc-old' });

    await createEventEntity({
      ...event('renewed', '2026-12-01T00:00:00Z', payload),
      documentId: 'doc-new',
      parentDocumentId: 'doc-old',
    });
    const pub = await listPublicEvents('doc-new');
    expect(pub.some(e => e.eventType === 'renewed')).toBe(true);
    expect(pub.find(e => e.eventType === 'renewed')?.parentDocumentId).toBe('doc-old');
  });
});

describe('diff de actualización', () => {
  it('captura el cambio de fecha de vencimiento como evento updated', () => {
    const next = { ...baseDoc, expires_at: '2027-12-31' };
    const changes = diffDocumentFields(baseDoc, next);
    const payload = buildEventPayload('updated', { changes });
    expect(payload.changes.expires_at).toEqual({ from: '2026-12-31', to: '2027-12-31' });
  });
});
