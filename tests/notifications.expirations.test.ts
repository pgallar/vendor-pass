import { describe, it, expect } from 'vitest';
import { classifyExpirationAlert } from '@/lib/notifications/expirations';
import type { VendorDocument } from '@/lib/types';

const baseDoc = (overrides: Partial<VendorDocument>): VendorDocument => ({
  id: 'd',
  vendor_id: 'v',
  document_type: 'poliza',
  document_name: 'X',
  issued_at: '2025-01-01',
  expires_at: '2026-01-01',
  criticality: 'critical',
  file_url: null,
  file_hash: null,
  notes: null,
  created_at: '',
  updated_at: '',
  lifecycle_status: 'anchored',
  anchored_at: null,
  arkiv_entity_key: null,
  supersedes_document_id: null,
  superseded_by_document_id: null,
  review_status: 'approved',
  rejection_reason: null,
  submitted_by_portal: false,
  submitted_by: null,
  ...overrides,
});

describe('classifyExpirationAlert', () => {
  const today = new Date('2026-05-28');

  it('returns expired when document is past due', () => {
    expect(classifyExpirationAlert(baseDoc({ expires_at: '2026-05-27' }), today)).toBe('expired');
  });

  it('returns expiring_7d when document expires within 7 days', () => {
    expect(classifyExpirationAlert(baseDoc({ expires_at: '2026-06-02' }), today)).toBe('expiring_7d');
  });

  it('returns expiring_30d when document expires within 30 days', () => {
    expect(classifyExpirationAlert(baseDoc({ expires_at: '2026-06-17' }), today)).toBe('expiring_30d');
  });

  it('returns null when document expires in more than 30 days', () => {
    expect(classifyExpirationAlert(baseDoc({ expires_at: '2026-07-28' }), today)).toBeNull();
  });
});
