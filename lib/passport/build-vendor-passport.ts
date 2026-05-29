import { documentStatus, vendorComplianceReasons, vendorStatus } from '@/lib/status';
import { getStore } from '@/lib/arkiv/validations';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ValidationEntity } from '@/lib/arkiv/validations';
import type {
  Criticality,
  DocumentStatus,
  Vendor,
  VendorDocument,
  VendorStatus,
} from '@/lib/types';
import type { ComplianceReason } from '@/lib/status';

/** Estado de ciclo de vida respecto del anclaje en Arkiv (Feature 2). */
export type PassportLifecycle = 'anchored' | 'pending_anchor' | 'draft';

/** Documento del pasaporte: SOLO metadatos de cumplimiento (sin datos sensibles). */
export interface PassportDocument {
  id: string;
  documentName: string;
  documentType: string;
  issuedAt: string;
  expiresAt: string;
  criticality: Criticality;
  status: DocumentStatus;
  lifecycle: PassportLifecycle;
  /** entityKey de Arkiv si está anclado en red (null en memoria o si no está anclado). */
  entityKey: string | null;
  /** true si la validación anclada registró el hash del archivo (Feature 3). */
  hashRegistered: boolean;
}

/** Pasaporte público: solo lo necesario para auditar cumplimiento, nada sensible. */
export interface VendorPassportData {
  vendor: { id: string; name: string; category: string | null; area: string | null };
  status: VendorStatus;
  reasons: ComplianceReason[];
  documents: PassportDocument[];
  resolvedFrom: 'store' | 'postgres';
  /** Momento del cálculo (ISO). El PDF lo muestra como "Estado al …". */
  generatedAt: string;
}

interface AssembleInput {
  vendor: Record<string, unknown>;
  documents: VendorDocument[];
  arkivEntities: ValidationEntity[];
  arkivAvailable: boolean;
}

/**
 * Núcleo puro y testeable: combina los datos de Postgres con las entidades de Arkiv,
 * deriva el lifecycle y FILTRA todo dato sensible del dueño del tenant.
 */
export function assemblePassport(input: AssembleInput): VendorPassportData {
  const { vendor, documents, arkivEntities, arkivAvailable } = input;
  const arkivById = new Map(arkivEntities.map(e => [e.documentId, e]));
  const resolvedFrom: VendorPassportData['resolvedFrom'] =
    arkivAvailable && arkivEntities.length > 0 ? 'store' : 'postgres';

  const passportDocs: PassportDocument[] = documents.map(doc => {
    const arkiv = arkivById.get(doc.id);
    const status: DocumentStatus = arkiv ? arkiv.status : documentStatus(doc);

    let lifecycle: PassportLifecycle;
    if ((doc as { lifecycle_status?: string }).lifecycle_status === 'draft') {
      lifecycle = 'draft';
    } else if (arkiv) {
      lifecycle = 'anchored';
    } else {
      lifecycle = 'pending_anchor';
    }

    const hashRegistered = arkiv != null && arkiv.fileHash != null && arkiv.fileHash.length > 0;

    return {
      id: doc.id,
      documentName: doc.document_name,
      documentType: doc.document_type,
      issuedAt: doc.issued_at,
      expiresAt: doc.expires_at,
      criticality: doc.criticality,
      status,
      lifecycle,
      entityKey: arkiv ? (arkiv as ValidationEntity & { entityKey?: string }).entityKey ?? null : null,
      hashRegistered,
    };
  });

  const resolvedForStatus: (VendorDocument & { status?: DocumentStatus })[] = documents.map(doc => {
    const arkiv = arkivById.get(doc.id);
    return arkiv ? { ...doc, status: arkiv.status } : doc;
  });

  return {
    vendor: {
      id: String(vendor.id),
      name: String(vendor.name),
      category: (vendor.category as string | null) ?? null,
      area: (vendor.area as string | null) ?? null,
    },
    status: vendorStatus(resolvedForStatus),
    reasons: vendorComplianceReasons(resolvedForStatus),
    documents: passportDocs,
    resolvedFrom,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Carga + ensambla el pasaporte de un proveedor. Usa service-role (público sin sesión).
 * Devuelve null si el proveedor no existe.
 */
export async function buildVendorPassport(vendorId: string): Promise<VendorPassportData | null> {
  const sb = supabaseAdmin();
  const { data: vendor, error } = await sb
    .from('vendors')
    .select('id,name,category,area')
    .eq('id', vendorId)
    .maybeSingle();
  if (error || !vendor) return null;

  const { data: docs } = await sb
    .from('documents')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('expires_at');

  let arkivEntities: ValidationEntity[] = [];
  let arkivAvailable = false;
  try {
    arkivEntities = await getStore().listByVendor(vendorId);
    arkivAvailable = true;
  } catch {
    arkivAvailable = false;
  }

  return assemblePassport({
    vendor: vendor as Record<string, unknown>,
    documents: (docs ?? []) as VendorDocument[],
    arkivEntities,
    arkivAvailable,
  });
}

export type { Vendor };
