import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryStore } from '@/lib/arkiv/validations';
import type { ValidationEntity } from '@/lib/arkiv/validations';

const make = (o: Partial<ValidationEntity>): ValidationEntity => ({
  vendorId: 'v1', documentId: 'd1', documentType: 't', documentName: 'n',
  issuedAt: '2025-01-01', expiresAt: '2026-01-01',
  status: 'vigente', criticality: 'critical',
  owner: null, creator: null, fileUrl: null, fileHash: null, notes: null,
  vendorName: null, syncedAt: null, ...o,
});

describe('in-memory validation store', () => {
  let store = createInMemoryStore();
  beforeEach(() => { store = createInMemoryStore(); });

  it('upserts and lists by vendor', async () => {
    await store.upsert(make({ documentId: 'd1', vendorId: 'v1' }));
    await store.upsert(make({ documentId: 'd2', vendorId: 'v1' }));
    await store.upsert(make({ documentId: 'd3', vendorId: 'v2' }));
    const list = await store.listByVendor('v1');
    expect(list.map(e => e.documentId).sort()).toEqual(['d1', 'd2']);
  });

  it('upsert replaces existing documentId', async () => {
    await store.upsert(make({ documentId: 'd1', documentName: 'old' }));
    await store.upsert(make({ documentId: 'd1', documentName: 'new' }));
    const list = await store.listByVendor('v1');
    expect(list).toHaveLength(1);
    expect(list[0].documentName).toBe('new');
  });

  it('lists expired only', async () => {
    await store.upsert(make({ documentId: 'd1', status: 'vencido' }));
    await store.upsert(make({ documentId: 'd2', status: 'vigente' }));
    const list = await store.listExpired();
    expect(list.map(e => e.documentId)).toEqual(['d1']);
  });

  it('lists expiring soon ordered by expiresAt asc', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    await store.upsert(make({ documentId: 'd1', status: 'por_vencer', expiresAt: '2026-06-20' }));
    await store.upsert(make({ documentId: 'd2', status: 'por_vencer', expiresAt: '2026-06-05' }));
    await store.upsert(make({ documentId: 'd3', status: 'vigente', expiresAt: '2026-12-10' }));
    const list = await store.listExpiringSoon(30);
    expect(list.map(e => e.documentId)).toEqual(['d2', 'd1']);
    vi.useRealTimers();
  });

  it('listExpiringSoon respects days window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    await store.upsert(make({ documentId: 'd1', expiresAt: '2026-06-05' }));
    await store.upsert(make({ documentId: 'd2', expiresAt: '2026-06-20' }));
    const list = await store.listExpiringSoon(7);
    expect(list.map(e => e.documentId)).toEqual(['d1']);
    vi.useRealTimers();
  });

  it('getByDocumentId finds and misses', async () => {
    await store.upsert(make({ documentId: 'd1', documentName: 'found' }));
    const hit = await store.getByDocumentId('d1');
    expect(hit?.entity.documentName).toBe('found');
    expect(hit?.entityKey).toBeNull();
    expect(await store.getByDocumentId('missing')).toBeNull();
  });

  it('removes by documentId', async () => {
    await store.upsert(make({ documentId: 'd1' }));
    await store.remove('d1');
    expect(await store.listByVendor('v1')).toHaveLength(0);
  });
});
