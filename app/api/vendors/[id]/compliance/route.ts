import { NextResponse } from 'next/server';
import {
  documentStatus,
  isVendorAllowed,
  vendorComplianceReasons,
  vendorStatus,
} from '@/lib/status';
import { requireUser } from '@/lib/supabase/api-auth';
import type { VendorDocument } from '@/lib/types';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data: vendor, error: vErr } = await auth.supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();
  if (vErr || !vendor) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  const { data: documents, error: dErr } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const docs = (documents ?? []) as VendorDocument[];
  const status = vendorStatus(docs);
  const reasons = vendorComplianceReasons(docs);

  return NextResponse.json({
    vendorId: id,
    vendorName: vendor.name,
    allowed: isVendorAllowed(docs),
    status,
    reasons,
    documents: docs.map(d => ({
      id: d.id,
      documentName: d.document_name,
      documentType: d.document_type,
      expiresAt: d.expires_at,
      criticality: d.criticality,
      status: documentStatus(d),
    })),
  });
}
