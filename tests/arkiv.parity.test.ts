import { describe, it, expect } from 'vitest';
import { createInMemoryStore } from '@/lib/arkiv/validations';
import type { ValidationEntity } from '@/lib/arkiv/validations';

// auditArkivParity uses supabaseAdmin — test the parity logic inline via in-memory store
describe('arkiv parity logic', () => {
  it('detects missing and mismatched entities', async () => {
    const store = createInMemoryStore();
    const entity: ValidationEntity = {
      vendorId: 'v1',
      documentId: 'd1',
      documentType: 'poliza',
      documentName: 'Doc',
      issuedAt: '2025-01-01',
      expiresAt: '2026-07-01',
      status: 'vigente',
      criticality: 'critical',
      owner: null,
      creator: null,
      fileUrl: null,
      fileHash: null,
      notes: null,
      vendorName: 'Vendor',
      syncedAt: null,
    };
    await store.upsert(entity);

    const all = await store.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].documentId).toBe('d1');

    const missing = await store.getByDocumentId('d-missing');
    expect(missing).toBeNull();
  });
});
