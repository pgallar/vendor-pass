import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { requirePortalMember } from '@/lib/portal/membership';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id : '';
  if (!vendorId) return NextResponse.json({ error: 'vendor_id requerido' }, { status: 400 });

  const role = await requirePortalMember(auth.supabase, auth.user.id, vendorId);
  if (role !== 'uploader') {
    return NextResponse.json({ error: 'No tenés permiso para subir a este proveedor' }, { status: 403 });
  }

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: vendorId,
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality ?? 'normal',
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      review_status: 'portal_draft',
      submitted_by_portal: true,
      submitted_by: auth.user.id,
    })
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 400 });

  return NextResponse.json({ document: doc }, { status: 201 });
}
