import { describe, it, expect } from 'vitest';
import {
  vendorComplianceReasons,
  isVendorAllowed,
  vendorStatus,
} from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

const baseDoc = (overrides: Partial<VendorDocument>): VendorDocument => ({
  id: 'd1',
  vendor_id: 'v1',
  document_type: 'poliza_art',
  document_name: 'Póliza ART',
  issued_at: '2025-01-01',
  expires_at: '2026-06-01',
  criticality: 'critical',
  file_url: null,
  file_hash: null,
  notes: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('vendorComplianceReasons', () => {
  const today = new Date('2026-05-28');

  it('returns critical docs that are vencido or por_vencer', () => {
    const docs = [
      baseDoc({ id: 'd1', expires_at: '2026-05-27', criticality: 'critical' }),
      baseDoc({ id: 'd2', expires_at: '2026-06-10', criticality: 'critical' }),
      baseDoc({ id: 'd3', expires_at: '2026-07-01', criticality: 'critical' }),
      baseDoc({ id: 'd4', expires_at: '2026-05-27', criticality: 'normal' }),
    ];
    const reasons = vendorComplianceReasons(docs, today);
    expect(reasons).toHaveLength(2);
    expect(reasons.map(r => r.documentId)).toEqual(['d1', 'd2']);
  });

  it('isVendorAllowed is false when bloqueado', () => {
    const docs = [baseDoc({ expires_at: '2026-05-27' })];
    expect(vendorStatus(docs, today)).toBe('bloqueado');
    expect(isVendorAllowed(docs, today)).toBe(false);
  });

  it('isVendorAllowed is true when ok', () => {
    const docs = [baseDoc({ expires_at: '2026-07-01' })];
    expect(isVendorAllowed(docs, today)).toBe(true);
  });
});
