import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/arkiv/validations';
import type { ValidationEntity } from '@/lib/arkiv/validations';

const sampleEntity: ValidationEntity = {
  vendorId: 'v1',
  documentId: 'd1',
  documentType: 'habilitacion',
  documentName: 'Test doc',
  issuedAt: '2025-01-01',
  expiresAt: '2026-12-31',
  status: 'vigente',
  criticality: 'normal',
  owner: null,
  creator: null,
  fileUrl: null,
  fileHash: null,
  notes: null,
  vendorName: 'Vendor',
  syncedAt: null,
};

const mockMaybeSingle = vi.fn();
const mockVendorSingle = vi.fn();

const sharedStore = createInMemoryStore();

vi.mock('@/lib/arkiv/validations', async importOriginal => {
  const orig = await importOriginal<typeof import('@/lib/arkiv/validations')>();
  return {
    ...orig,
    getStore: vi.fn(() => sharedStore),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'documents') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: mockVendorSingle,
          }),
        }),
      };
    },
  }),
}));

describe('resolveValidationLookup', () => {
  beforeEach(async () => {
    mockMaybeSingle.mockReset();
    mockVendorSingle.mockReset();
    for (const id of ['d1', 'd2']) {
      await sharedStore.remove(id);
    }
  });

  it('returns store hit when present', async () => {
    const { getStore } = await import('@/lib/arkiv/validations');
    const store = getStore();
    await store.upsert(sampleEntity);

    const { resolveValidationLookup } = await import('@/lib/arkiv/lookup');
    const result = await resolveValidationLookup('d1');
    expect(result?.resolvedFrom).toBe('store');
    expect(result?.entity.documentName).toBe('Test doc');
  });

  it('falls back to postgres when store misses', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'd2',
        vendor_id: 'v1',
        document_type: 'habilitacion',
        document_name: 'From DB',
        issued_at: '2025-01-01',
        expires_at: '2026-12-31',
        criticality: 'normal',
        file_url: null,
        file_hash: null,
        notes: null,
      },
      error: null,
    });
    mockVendorSingle.mockResolvedValue({
      data: { id: 'v1', name: 'Vendor', owner_email: null, owner_name: null },
      error: null,
    });

    const { resolveValidationLookup } = await import('@/lib/arkiv/lookup');
    const result = await resolveValidationLookup('d2');
    expect(result?.resolvedFrom).toBe('postgres');
    expect(result?.entity.documentName).toBe('From DB');
  });
});
