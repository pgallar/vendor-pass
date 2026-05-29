import { describe, it, expect } from 'vitest';
import {
  IMMUTABLE_FIELDS,
  canAnchor,
  canEdit,
  canTransition,
  immutableFieldsChanged,
} from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

function doc(overrides: Partial<VendorDocument> = {}): VendorDocument {
  return {
    id: 'd1',
    vendor_id: 'v1',
    document_type: 'art',
    document_name: 'Póliza ART',
    issued_at: '2025-01-01',
    expires_at: '2026-01-01',
    criticality: 'critical',
    file_url: 'https://s3/x.pdf',
    file_hash: 'abc123',
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    lifecycle_status: 'draft',
    anchored_at: null,
    arkiv_entity_key: null,
    supersedes_document_id: null,
    superseded_by_document_id: null,
    review_status: 'approved',
    rejection_reason: null,
    submitted_by_portal: false,
    submitted_by: null,
    ...overrides,
  };
}

describe('canTransition', () => {
  it('permite draft → pending_anchor, draft → anchored, pending_anchor → anchored', () => {
    expect(canTransition('draft', 'pending_anchor')).toBe(true);
    expect(canTransition('draft', 'anchored')).toBe(true);
    expect(canTransition('pending_anchor', 'anchored')).toBe(true);
  });
  it('permite volver a borrador desde pending_anchor', () => {
    expect(canTransition('pending_anchor', 'draft')).toBe(true);
  });
  it('rechaza salir de anchored (inmutable salvo renovación — Feature 4)', () => {
    expect(canTransition('anchored', 'draft')).toBe(false);
    expect(canTransition('anchored', 'pending_anchor')).toBe(false);
  });
  it('rechaza transiciones a sí mismo', () => {
    expect(canTransition('draft', 'draft')).toBe(false);
  });
});

describe('canEdit', () => {
  it('un borrador se edita libremente', () => {
    expect(canEdit(doc({ lifecycle_status: 'draft' }))).toBe(true);
  });
  it('un documento listo para anclar no se edita (solo volver a borrador)', () => {
    expect(canEdit(doc({ lifecycle_status: 'pending_anchor' }))).toBe(false);
  });
  it('un documento anclado no se edita (campos inmutables)', () => {
    expect(canEdit(doc({ lifecycle_status: 'anchored' }))).toBe(false);
  });
});

describe('canAnchor', () => {
  it('se puede anclar un borrador con archivo y hash', () => {
    expect(canAnchor(doc({ lifecycle_status: 'draft' })).ok).toBe(true);
  });
  it('se puede anclar un pending_anchor', () => {
    expect(canAnchor(doc({ lifecycle_status: 'pending_anchor' })).ok).toBe(true);
  });
  it('no se puede re-anclar un documento ya anclado', () => {
    const r = canAnchor(doc({ lifecycle_status: 'anchored' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/anclado/i);
  });
  it('no se puede anclar sin hash de archivo', () => {
    const r = canAnchor(doc({ file_hash: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/hash|evidencia|archivo/i);
  });
});

describe('immutableFieldsChanged', () => {
  it('detecta cambios en campos inmutables', () => {
    const current = doc();
    expect(immutableFieldsChanged(current, { expires_at: '2027-01-01' })).toEqual(['expires_at']);
    expect(immutableFieldsChanged(current, { document_type: 'seguro' })).toEqual(['document_type']);
  });
  it('ignora cambios en campos mutables (notas)', () => {
    const current = doc();
    expect(
      immutableFieldsChanged(current, { notes: 'nueva nota' } as Partial<
        Record<(typeof IMMUTABLE_FIELDS)[number], unknown>
      >),
    ).toEqual([]);
  });
  it('no reporta cambios si el valor es idéntico', () => {
    const current = doc();
    expect(immutableFieldsChanged(current, { expires_at: '2026-01-01' })).toEqual([]);
  });
  it('IMMUTABLE_FIELDS contiene los cuatro campos clave', () => {
    expect([...IMMUTABLE_FIELDS].sort()).toEqual(
      ['document_type', 'expires_at', 'file_hash', 'issued_at'].sort(),
    );
  });
});
