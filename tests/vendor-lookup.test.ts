import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockVendorMaybeSingle = vi.fn();
const mockDocsOrder = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'vendors') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockVendorMaybeSingle,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: mockDocsOrder,
          }),
        }),
      };
    },
  }),
}));

vi.mock('@/lib/arkiv/validations', async importOriginal => {
  const orig = await importOriginal<typeof import('@/lib/arkiv/validations')>();
  return {
    ...orig,
    getStore: vi.fn(() => ({
      listByVendor: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe('resolveVendorPassport', () => {
  beforeEach(() => {
    mockVendorMaybeSingle.mockReset();
    mockDocsOrder.mockReset();
  });

  it('returns passport for existing vendor', async () => {
    mockVendorMaybeSingle.mockResolvedValue({
      data: { id: 'v1', name: 'Acme', category: 'Limpieza', area: 'Norte' },
      error: null,
    });
    mockDocsOrder.mockResolvedValue({
      data: [
        {
          id: 'd1',
          vendor_id: 'v1',
          document_type: 'habilitacion',
          document_name: 'Doc 1',
          issued_at: '2025-01-01',
          expires_at: '2027-01-01',
          criticality: 'normal',
          file_url: null,
          file_hash: null,
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
      error: null,
    });

    const { resolveVendorPassport } = await import('@/lib/arkiv/vendor-lookup');
    const result = await resolveVendorPassport('v1');
    expect(result?.vendor.name).toBe('Acme');
    expect(result?.documents).toHaveLength(1);
    expect(result?.status).toBe('ok');
  });

  it('returns null when vendor missing', async () => {
    mockVendorMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { resolveVendorPassport } = await import('@/lib/arkiv/vendor-lookup');
    expect(await resolveVendorPassport('missing')).toBeNull();
  });
});
