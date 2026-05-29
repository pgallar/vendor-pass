import { describe, it, expect } from 'vitest';
import { documentStatus, vendorStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

const baseDoc = (overrides: Partial<VendorDocument>): VendorDocument => ({
  id: 'd', vendor_id: 'v', document_type: 'poliza', document_name: 'X',
  issued_at: '2025-01-01', expires_at: '2026-01-01',
  criticality: 'critical', file_url: null, file_hash: null, notes: null,
  created_at: '', updated_at: '',
  lifecycle_status: 'anchored', anchored_at: null, arkiv_entity_key: null,
  ...overrides,
});

describe('documentStatus', () => {
  const today = new Date('2026-05-28');

  it('returns vencido when expires_at is in the past', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-05-27' }), today)).toBe('vencido');
  });

  it('returns por_vencer when expires_at is within 30 days', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-06-10' }), today)).toBe('por_vencer');
  });

  it('returns vigente when expires_at is more than 30 days away', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-07-15' }), today)).toBe('vigente');
  });

  it('treats today as vencido boundary (expires today = vencido)', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-05-28' }), today)).toBe('por_vencer');
  });
});

describe('vendorStatus', () => {
  const today = new Date('2026-05-28');

  it('returns ok when all critical docs are vigente', () => {
    const docs = [baseDoc({ expires_at: '2027-01-01', criticality: 'critical' })];
    expect(vendorStatus(docs, today)).toBe('ok');
  });

  it('returns atencion when a critical doc is por_vencer', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-06-10', criticality: 'critical' }),
    ];
    expect(vendorStatus(docs, today)).toBe('atencion');
  });

  it('returns bloqueado when any critical doc is vencido', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-05-01', criticality: 'critical' }),
    ];
    expect(vendorStatus(docs, today)).toBe('bloqueado');
  });

  it('ignores non-critical docs for vendor status', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-05-01', criticality: 'normal' }),
    ];
    expect(vendorStatus(docs, today)).toBe('ok');
  });

  it('returns ok when there are no documents', () => {
    expect(vendorStatus([], today)).toBe('ok');
  });
});
