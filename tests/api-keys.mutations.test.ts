import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVendor,
  deleteVendor,
  updateVendor,
} from '@/lib/api-keys/mutations';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VENDOR_B = '22222222-2222-2222-2222-222222222222';

describe('api-keys mutations — aislamiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateVendor devuelve null si el proveedor no es del usuario', async () => {
    const sb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
    };
    const result = await updateVendor(sb as never, USER_A, VENDOR_B, { name: 'X' });
    expect(result).toBeNull();
  });

  it('deleteVendor devuelve null si el proveedor no es del usuario', async () => {
    const sb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
    };
    const result = await deleteVendor(sb as never, USER_A, VENDOR_B);
    expect(result).toBeNull();
  });

  it('createVendor asigna user_id al insertar', async () => {
    const insertPayload: Record<string, unknown> = {};
    const sb = {
      from: vi.fn(() => ({
        insert: vi.fn((row: Record<string, unknown>) => {
          Object.assign(insertPayload, row);
          return {
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { id: 'new-id', ...row },
                  error: null,
                }),
              ),
            })),
          };
        }),
      })),
    };
    await createVendor(sb as never, USER_A, { name: 'Proveedor MCP' });
    expect(insertPayload.user_id).toBe(USER_A);
    expect(insertPayload.name).toBe('Proveedor MCP');
  });
});
