import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getVendorDetail,
  listDocuments,
  listVendors,
} from '@/lib/api-keys/data';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VENDOR_A = '11111111-1111-1111-1111-111111111111';
const VENDOR_B = '22222222-2222-2222-2222-222222222222';

type Row = Record<string, unknown>;

function chain(final: { data: Row[] | Row | null; error: null; count?: number }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    order: vi.fn(() => self),
    maybeSingle: vi.fn(() => Promise.resolve(final)),
    then: (resolve: (v: typeof final) => void) => Promise.resolve(final).then(resolve),
  };
  return self;
}

describe('api-keys data layer — aislamiento por user_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listVendors consulta solo proveedores del usuario', async () => {
    const eqCalls: Array<[string, string]> = [];
    const sb = {
      from: vi.fn((table: string) => {
        const self = {
          select: vi.fn(() => self),
          eq: vi.fn((col: string, val: string) => {
            eqCalls.push([col, val]);
            return self;
          }),
          in: vi.fn(() =>
            Promise.resolve({ data: [], error: null }),
          ),
          order: vi.fn(() =>
            Promise.resolve({
              data:
                table === 'vendors'
                  ? [{ id: VENDOR_A, user_id: USER_A, name: 'A' }]
                  : [],
              error: null,
            }),
          ),
        };
        return self;
      }),
    };
    const result = await listVendors(sb as never, USER_A);
    expect(sb.from).toHaveBeenCalledWith('vendors');
    expect(eqCalls).toContainEqual(['user_id', USER_A]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VENDOR_A);
  });

  it('getVendorDetail exige user_id y no devuelve proveedor ajeno', async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === 'vendors') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(function (this: unknown, col: string, val: string) {
                if (col === 'id' && val === VENDOR_B) {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(() =>
                        Promise.resolve({ data: null, error: null }),
                      ),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() =>
                      Promise.resolve({
                        data: { id: VENDOR_A, user_id: USER_A, name: 'A' },
                        error: null,
                      }),
                    ),
                  })),
                };
              }),
            })),
          };
        }
        if (table === 'documents') {
          return chain({ data: [], error: null });
        }
        return chain({ data: [], error: null });
      }),
    };
    const own = await getVendorDetail(sb as never, USER_A, VENDOR_A);
    const foreign = await getVendorDetail(sb as never, USER_A, VENDOR_B);
    expect(own?.vendor.id).toBe(VENDOR_A);
    expect(foreign).toBeNull();
  });

  it('listDocuments limita documentos a vendor_id del usuario', async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === 'vendors') {
          return chain({
            data: [{ id: VENDOR_A }],
            error: null,
          });
        }
        if (table === 'documents') {
          const c = chain({
            data: [
              {
                id: 'd1',
                vendor_id: VENDOR_A,
                document_type: 'x',
                document_name: 'Doc',
                issued_at: '2025-01-01',
                expires_at: '2026-01-01',
                criticality: 'normal',
              },
            ],
            error: null,
          });
          return c;
        }
        return chain({ data: [], error: null });
      }),
    };
    const docs = await listDocuments(sb as never, USER_A);
    expect(docs).toHaveLength(1);
    const docsChain = sb.from.mock.results.find(
      (_r, i) => sb.from.mock.calls[i][0] === 'documents',
    );
    expect(docsChain).toBeDefined();
  });
});

describe('auditArkivParity con userId', () => {
  it('filtra vendors y documents por dueño cuando hay userId', async () => {
    const eqCalls: Array<[string, string, string]> = [];
    const inCalls: string[][] = [];
    const sb = {
      from: vi.fn((table: string) => {
        const self = {
          select: vi.fn(() => self),
          eq: vi.fn((col: string, val: string) => {
            eqCalls.push([table, col, val]);
            return self;
          }),
          in: vi.fn((_col: string, vals: string[]) => {
            inCalls.push(vals);
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return self;
      }),
    };
    await auditArkivParity({ supabase: sb as never, userId: USER_A });
    expect(eqCalls).toContainEqual(['vendors', 'user_id', USER_A]);
    expect(inCalls.length).toBeGreaterThan(0);
  });
});
