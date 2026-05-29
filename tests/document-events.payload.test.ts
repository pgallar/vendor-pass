import { describe, it, expect } from 'vitest';
import { buildEventPayload, diffDocumentFields } from '@/lib/events/payload';
import type { VendorDocument } from '@/lib/types';

const baseDoc: VendorDocument = {
  id: 'doc-1',
  vendor_id: 'ven-1',
  document_type: 'poliza',
  document_name: 'ART',
  issued_at: '2026-01-01',
  expires_at: '2026-12-31',
  criticality: 'critical',
  file_url: null,
  file_hash: 'hash-a',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  lifecycle_status: 'draft',
  anchored_at: null,
  arkiv_entity_key: null,
  supersedes_document_id: null,
  superseded_by_document_id: null,
};

describe('buildEventPayload', () => {
  it('created: snapshot con los campos de negocio', () => {
    const p = buildEventPayload('created', { document: baseDoc });
    expect(p.snapshot).toMatchObject({ document_name: 'ART', expires_at: '2026-12-31' });
  });

  it('anchored: entityKey, status y fileHash', () => {
    const p = buildEventPayload('anchored', {
      entityKey: '0xabc',
      status: 'vigente',
      fileHash: 'hash-a',
    });
    expect(p).toEqual({ entityKey: '0xabc', status: 'vigente', fileHash: 'hash-a' });
  });

  it('status_recomputed: viejo y nuevo estado', () => {
    const p = buildEventPayload('status_recomputed', {
      oldStatus: 'vigente',
      newStatus: 'por_vencer',
    });
    expect(p).toEqual({ oldStatus: 'vigente', newStatus: 'por_vencer' });
  });

  it('renewed: referencia al documento que reemplaza', () => {
    const p = buildEventPayload('renewed', { supersedesDocumentId: 'doc-0' });
    expect(p).toEqual({ supersedesDocumentId: 'doc-0' });
  });

  it('revoked: motivo requerido (default vacío válido)', () => {
    expect(buildEventPayload('revoked', { reason: 'baja manual' })).toEqual({ reason: 'baja manual' });
  });

  it('file_replaced: hashes viejo y nuevo', () => {
    const p = buildEventPayload('file_replaced', { oldHash: 'hash-a', newHash: 'hash-b' });
    expect(p).toEqual({ oldHash: 'hash-a', newHash: 'hash-b' });
  });

  it('lanza si faltan campos obligatorios del tipo', () => {
    // @ts-expect-error: falta entityKey a propósito
    expect(() => buildEventPayload('anchored', { status: 'vigente', fileHash: null })).toThrow();
  });
});

describe('diffDocumentFields', () => {
  it('detecta solo los campos que cambiaron', () => {
    const next: VendorDocument = { ...baseDoc, expires_at: '2027-01-31', notes: 'renovada' };
    const changes = diffDocumentFields(baseDoc, next);
    expect(changes).toEqual({
      expires_at: { from: '2026-12-31', to: '2027-01-31' },
      notes: { from: null, to: 'renovada' },
    });
  });

  it('devuelve objeto vacío si no hubo cambios', () => {
    expect(diffDocumentFields(baseDoc, { ...baseDoc })).toEqual({});
  });
});
