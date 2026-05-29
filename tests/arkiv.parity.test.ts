import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';
import { createInMemoryStore, type ValidationEntity } from '@/lib/arkiv/validations';
import type { VendorDocument } from '@/lib/types';

const VENDOR_ID = 'v1';
const DRAFT_DOC_ID = 'draft-doc';
const ANCHORED_DOC_ID = 'anchored-doc';

let memoryStore = createInMemoryStore();

vi.mock('@/lib/arkiv/validations', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/arkiv/validations')>();
  return {
    ...original,
    getStore: () => memoryStore,
  };
});

function chain(final: { data: unknown; error: null }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    then: (resolve: (v: typeof final) => void) => Promise.resolve(final).then(resolve),
  };
  return self;
}

function mockSupabase(docs: VendorDocument[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'vendors') {
        return chain({ data: [{ id: VENDOR_ID }], error: null });
      }
      if (table === 'documents') {
        return chain({ data: docs, error: null });
      }
      return chain({ data: [], error: null });
    }),
  };
}

function baseDoc(overrides: Partial<VendorDocument>): VendorDocument {
  return {
    id: 'd1',
    vendor_id: VENDOR_ID,
    document_type: 'poliza',
    document_name: 'Doc',
    issued_at: '2025-01-01',
    expires_at: '2026-07-01',
    criticality: 'critical',
    file_url: null,
    file_hash: 'abc',
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    lifecycle_status: 'anchored',
    anchored_at: '2025-01-01T00:00:00Z',
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

describe('arkiv parity logic', () => {
  beforeEach(() => {
    memoryStore = createInMemoryStore();
  });

  it('detects missing and mismatched entities', async () => {
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
    await memoryStore.upsert(entity);

    const all = await memoryStore.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].documentId).toBe('d1');

    const missing = await memoryStore.getByDocumentId('d-missing');
    expect(missing).toBeNull();
  });

  it('un documento en borrador no se cuenta como faltante en Arkiv', async () => {
    const anchoredEntity: ValidationEntity = {
      vendorId: VENDOR_ID,
      documentId: ANCHORED_DOC_ID,
      documentType: 'poliza',
      documentName: 'Anclado',
      issuedAt: '2025-01-01',
      expiresAt: '2026-07-01',
      status: 'vigente',
      criticality: 'critical',
      owner: null,
      creator: null,
      fileUrl: null,
      fileHash: 'hash',
      notes: null,
      vendorName: 'Vendor',
      syncedAt: null,
    };
    await memoryStore.upsert(anchoredEntity);

    const docs = [
      baseDoc({ id: DRAFT_DOC_ID, lifecycle_status: 'draft', anchored_at: null }),
      baseDoc({ id: ANCHORED_DOC_ID, lifecycle_status: 'anchored' }),
    ];
    const sb = mockSupabase(docs);

    const result = await auditArkivParity({ supabase: sb as never });

    expect(result.missingInArkiv).not.toContain(DRAFT_DOC_ID);
    expect(result.expectedMissingInArkiv).toContain(DRAFT_DOC_ID);
    expect(result.ok).toBe(true);
  });
});
