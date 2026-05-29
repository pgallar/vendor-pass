import { describe, it, expect } from 'vitest';
import { assemblePassport } from '@/lib/passport/build-vendor-passport';
import type { VendorDocument } from '@/lib/types';
import type { ValidationEntity } from '@/lib/arkiv/validations';

const vendor = {
  id: 'v1',
  name: 'ACME S.A.',
  category: 'Logística',
  area: 'CABA',
  owner_email: 'interno@acme.com',
  notes: 'nota interna confidencial',
} as Record<string, unknown>;

function doc(over: Partial<VendorDocument>): VendorDocument {
  return {
    id: 'd1',
    vendor_id: 'v1',
    document_name: 'Póliza ART',
    document_type: 'Seguro ART',
    issued_at: '2026-01-01',
    expires_at: '2026-12-31',
    criticality: 'critical',
    file_url: 'https://s3.amazonaws.com/bucket/muy/larga/firma?X-Amz-Signature=abc',
    file_hash: 'a'.repeat(64),
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    lifecycle_status: 'anchored',
    anchored_at: '2026-01-01T00:00:00Z',
    arkiv_entity_key: null,
    supersedes_document_id: null,
    superseded_by_document_id: null,
    ...over,
  };
}

function entity(over: Partial<ValidationEntity>): ValidationEntity {
  return {
    vendorId: 'v1', documentId: 'd1', documentType: 'Seguro ART', documentName: 'Póliza ART',
    issuedAt: '2026-01-01', expiresAt: '2026-12-31', status: 'vigente', criticality: 'critical',
    owner: 'interno@acme.com', creator: null, fileUrl: null, fileHash: 'a'.repeat(64),
    notes: 'nota interna', vendorName: 'ACME S.A.', syncedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

describe('assemblePassport', () => {
  it('agrega vendor + documentos y calcula el estado agregado', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    expect(p.vendor.name).toBe('ACME S.A.');
    expect(p.status).toBe('ok');
    expect(p.documents).toHaveLength(1);
    expect(p.documents[0].lifecycle).toBe('anchored');
    expect(p.documents[0].entityKey).toBe(null);
    expect(p.documents[0].hashRegistered).toBe(true);
  });

  it('marca como pendiente de anclaje un documento que no está en Arkiv', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ id: 'd1' }), doc({ id: 'd2', criticality: 'normal', file_hash: null })],
      arkivEntities: [entity({ documentId: 'd1' })],
      arkivAvailable: true,
    });
    const d2 = p.documents.find(d => d.id === 'd2')!;
    expect(d2.lifecycle).toBe('pending_anchor');
    expect(d2.hashRegistered).toBe(false);
  });

  it('usa el estado on-chain de Arkiv cuando difiere del de Postgres', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ expires_at: '2099-12-31' })],
      arkivEntities: [entity({ status: 'vencido' })],
      arkivAvailable: true,
    });
    expect(p.documents[0].status).toBe('vencido');
    expect(p.status).toBe('bloqueado');
  });

  it('NO expone datos sensibles del dueño del tenant', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain('owner_email');
    expect(serialized).not.toContain('interno@acme.com');
    expect(serialized).not.toContain('nota interna');
    expect(serialized).not.toContain('X-Amz-Signature');
  });

  it('si Arkiv no está disponible, todo queda pendiente de anclaje y resolvedFrom=postgres', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [],
      arkivAvailable: false,
    });
    expect(p.resolvedFrom).toBe('postgres');
    expect(p.documents[0].lifecycle).toBe('pending_anchor');
  });

  it('respeta lifecycle_status=draft de Postgres por encima de la inferencia', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ lifecycle_status: 'draft' } as Partial<VendorDocument>)],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    expect(p.documents[0].lifecycle).toBe('draft');
  });
});
