import { getStore } from '@/lib/arkiv/validations';
import { documentStatus, vendorComplianceReasons, vendorStatus } from '@/lib/status';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { DocumentStatus, Vendor, VendorDocument, VendorStatus } from '@/lib/types';

export type VendorPassportDocument = VendorDocument & { status: DocumentStatus };

export type VendorPassport = {
  vendor: Pick<Vendor, 'id' | 'name' | 'category' | 'area'>;
  status: VendorStatus;
  reasons: ReturnType<typeof vendorComplianceReasons>;
  documents: VendorPassportDocument[];
  resolvedFrom: 'store' | 'postgres';
};

/** Pasaporte público del proveedor (Postgres; enriquecido con Arkiv si hay entidades). */
export async function resolveVendorPassport(vendorId: string): Promise<VendorPassport | null> {
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

  const documents = ((docs ?? []) as VendorDocument[]).map(d => ({
    ...d,
    status: documentStatus(d),
  }));

  let resolvedFrom: VendorPassport['resolvedFrom'] = 'postgres';

  try {
    const arkivDocs = await getStore().listByVendor(vendorId);
    if (arkivDocs.length > 0) {
      resolvedFrom = 'store';
      const arkivById = new Map(arkivDocs.map(e => [e.documentId, e]));
      for (const doc of documents) {
        const arkiv = arkivById.get(doc.id);
        if (arkiv) {
          doc.status = arkiv.status;
        }
      }
    }
  } catch {
    // Arkiv no disponible: mantener estados desde Postgres
  }

  return {
    vendor: vendor as VendorPassport['vendor'],
    status: vendorStatus(documents),
    reasons: vendorComplianceReasons(documents),
    documents,
    resolvedFrom,
  };
}
