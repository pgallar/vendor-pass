import { documentStatus } from '@/lib/status';
import type { ValidationEntity } from '@/lib/arkiv/validations';
import type { VendorDocument } from '@/lib/types';

type VendorInfo = {
  name?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
};

export function documentToValidationEntity(
  doc: VendorDocument,
  vendor: VendorInfo | null | undefined,
  syncedAt?: string,
): ValidationEntity {
  return {
    vendorId: doc.vendor_id,
    documentId: doc.id,
    documentType: doc.document_type,
    documentName: doc.document_name,
    issuedAt: doc.issued_at,
    expiresAt: doc.expires_at,
    status: documentStatus(doc),
    criticality: doc.criticality,
    owner: vendor?.owner_email ?? vendor?.owner_name ?? null,
    creator: null,
    fileUrl: doc.file_url,
    fileHash: doc.file_hash ?? null,
    notes: doc.notes,
    vendorName: vendor?.name ?? null,
    syncedAt: syncedAt ?? null,
  };
}
