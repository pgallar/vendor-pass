import type { Criticality, DocumentStatus } from '@/lib/types';
import { arkivPublicClient, arkivWalletClient, ENTITY_TYPE, jsonToPayload } from './client';
import { isExpiringWithinDays } from './dates';
import { asc, eq } from '@arkiv-network/sdk/query';
import type { Hex } from 'viem';

export const PROJECT_SLUG = process.env.PROJECT_SLUG || 'vendor-pass-2026';


export interface ValidationEntity {
  vendorId: string;
  documentId: string;
  documentType: string;
  documentName: string;
  issuedAt: string;
  expiresAt: string;
  status: DocumentStatus;
  criticality: Criticality;
  owner: string | null;
  creator: string | null;
  fileUrl: string | null;
  fileHash: string | null;
  notes: string | null;
  vendorName: string | null;
  syncedAt: string | null;
}

export interface ValidationLookup {
  entity: ValidationEntity;
  entityKey: string | null;
}

export interface ValidationStore {
  upsert(entity: ValidationEntity): Promise<void>;
  remove(documentId: string): Promise<void>;
  getByDocumentId(documentId: string): Promise<ValidationLookup | null>;
  listAll(): Promise<ValidationEntity[]>;
  listByVendor(vendorId: string): Promise<ValidationEntity[]>;
  listExpired(): Promise<ValidationEntity[]>;
  listExpiringSoon(days: number): Promise<ValidationEntity[]>;
}

function entityAttributes(entity: ValidationEntity) {
  const issuedAtMs = entity.issuedAt ? new Date(entity.issuedAt + 'T00:00:00Z').getTime() : 0;
  const expiresAtMs = entity.expiresAt ? new Date(entity.expiresAt + 'T23:59:59Z').getTime() : 0;

  return [
    { key: 'project', value: PROJECT_SLUG },
    { key: 'entityType', value: ENTITY_TYPE },
    { key: 'documentId', value: entity.documentId },
    { key: 'vendorId', value: entity.vendorId },
    { key: 'documentType', value: entity.documentType },
    { key: 'documentName', value: entity.documentName },
    { key: 'issuedAt', value: entity.issuedAt },
    { key: 'issuedAtMs', value: issuedAtMs },
    { key: 'expiresAt', value: entity.expiresAt },
    { key: 'expiresAtMs', value: expiresAtMs },
    { key: 'status', value: entity.status },
    { key: 'criticality', value: entity.criticality },
    ...(entity.owner ? [{ key: 'owner', value: entity.owner }] : []),
  ];
}

function expiresInSeconds(expiresAt: string): number {
  if (!expiresAt) return 86_400 * 365 * 10; // 10 años por defecto si no expira
  const end = new Date(expiresAt + 'T23:59:59Z').getTime();
  if (isNaN(end)) return 86_400 * 365 * 10;
  const diff = Math.floor((end - Date.now()) / 1000);
  return Math.max(diff + 86_400, 86_400);
}

function parseEntity(e: { toJson(): unknown }): ValidationEntity {
  const raw = e.toJson() as Partial<ValidationEntity>;
  return {
    vendorId: raw.vendorId ?? '',
    documentId: raw.documentId ?? '',
    documentType: raw.documentType ?? '',
    documentName: raw.documentName ?? '',
    issuedAt: raw.issuedAt ?? '',
    expiresAt: raw.expiresAt ?? '',
    status: raw.status ?? 'vigente',
    criticality: raw.criticality ?? 'normal',
    owner: raw.owner ?? null,
    creator: raw.creator ?? null,
    fileUrl: raw.fileUrl ?? null,
    fileHash: raw.fileHash ?? null,
    notes: raw.notes ?? null,
    vendorName: raw.vendorName ?? null,
    syncedAt: raw.syncedAt ?? null,
  };
}

function filterExpiringSoon(entities: ValidationEntity[], days: number): ValidationEntity[] {
  return entities
    .filter(e => isExpiringWithinDays(e.expiresAt, days))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export function createInMemoryStore(): ValidationStore {
  const byId = new Map<string, ValidationEntity>();
  return {
    async upsert(entity) { byId.set(entity.documentId, entity); },
    async remove(documentId) { byId.delete(documentId); },
    async getByDocumentId(documentId) {
      const entity = byId.get(documentId);
      if (!entity) return null;
      return { entity, entityKey: null };
    },
    async listAll() {
      return [...byId.values()];
    },
    async listByVendor(vendorId) {
      return [...byId.values()].filter(e => e.vendorId === vendorId);
    },
    async listExpired() {
      return [...byId.values()].filter(e => e.status === 'vencido');
    },
    async listExpiringSoon(days) {
      return filterExpiringSoon([...byId.values()], days);
    },
  };
}

const entityKeyByDocumentId = new Map<string, Hex>();

export function createArkivStore(): ValidationStore {
  const pub = arkivPublicClient();
  const wallet = arkivWalletClient();

  async function findEntityKey(documentId: string): Promise<Hex | undefined> {
    const cached = entityKeyByDocumentId.get(documentId);
    if (cached) return cached;
    const result = await pub.buildQuery()
      .where([eq('entityType', ENTITY_TYPE), eq('documentId', documentId)])
      .fetch();
    const key = result.entities[0]?.key;
    if (key) entityKeyByDocumentId.set(documentId, key);
    return key;
  }

  async function queryByStatus(status: DocumentStatus): Promise<ValidationEntity[]> {
    const all = await queryAll();
    return all.filter(e => e.status === status);
  }

  async function queryAll(): Promise<ValidationEntity[]> {
    const result = await pub.buildQuery()
      .where([eq('project', PROJECT_SLUG), eq('entityType', ENTITY_TYPE)])
      .withPayload(true)
      .orderBy(asc('expiresAtMs', 'number'))
      .fetch();
    return result.entities.map(parseEntity);
  }

  return {
    async upsert(entity) {
      const payload = jsonToPayload(entity);
      const attrs = entityAttributes(entity);
      const expiresIn = expiresInSeconds(entity.expiresAt);
      console.log('upsert: Calling findEntityKey...');
      const existingKey = await findEntityKey(entity.documentId);
      console.log(`upsert: findEntityKey returned ${existingKey}`);
      if (existingKey) {
        console.log('upsert: Calling wallet.updateEntity...');
        await wallet.updateEntity({
          entityKey: existingKey,
          payload,
          attributes: attrs,
          contentType: 'application/json',
          expiresIn,
        });
        console.log('upsert: wallet.updateEntity finished.');
      } else {
        console.log('upsert: Calling wallet.createEntity...');
        const { entityKey } = await wallet.createEntity({
          payload,
          attributes: attrs,
          contentType: 'application/json',
          expiresIn,
        });
        console.log('upsert: wallet.createEntity finished.');
        entityKeyByDocumentId.set(entity.documentId, entityKey);
      }
      console.log('upsert: DONE');
    },
    async remove(documentId) {
      const key = await findEntityKey(documentId);
      if (key) {
        await wallet.deleteEntity({ entityKey: key });
        entityKeyByDocumentId.delete(documentId);
      }
    },
    async getByDocumentId(documentId) {
      const result = await pub.buildQuery()
        .where([eq('entityType', ENTITY_TYPE), eq('documentId', documentId)])
        .withPayload(true)
        .fetch();
      const row = result.entities[0];
      if (!row) return null;
      if (row.key) entityKeyByDocumentId.set(documentId, row.key);
      return { entity: parseEntity(row), entityKey: row.key ?? null };
    },
    async listAll() {
      return queryAll();
    },
    async listByVendor(vendorId) {
      const all = await queryAll();
      return all.filter(e => e.vendorId === vendorId);
    },
    async listExpired() {
      return queryByStatus('vencido');
    },
    async listExpiringSoon(days) {
      const porVencer = await queryByStatus('por_vencer');
      const vigente = await queryByStatus('vigente');
      return filterExpiringSoon([...porVencer, ...vigente], days);
    },
  };
}

let sharedMemory: ValidationStore | null = null;

export function getStoreSource(): 'arkiv' | 'memory' {
  if (process.env.ARKIV_RPC_URL && process.env.ARKIV_PRIVATE_KEY) return 'arkiv';
  return 'memory';
}

export function getStore(): ValidationStore {
  if (getStoreSource() === 'arkiv') {
    return createArkivStore();
  }
  if (!sharedMemory) sharedMemory = createInMemoryStore();
  return sharedMemory;
}
