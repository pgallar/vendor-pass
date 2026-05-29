import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { notifyDocumentSubmitted } from '@/lib/notifications/portal';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('id, vendor_id, document_name, review_status')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const role = await requirePortalMember(auth.supabase, auth.user.id, doc.vendor_id);
  if (role !== 'uploader') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!['portal_draft', 'rejected'].includes(doc.review_status)) {
    return NextResponse.json({ error: 'Solo se pueden enviar borradores o documentos rechazados' }, { status: 409 });
  }

  const { error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: 'submitted', rejection_reason: null })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    const { data: vendor } = await admin
      .from('vendors')
      .select('name, owner_email, user_id')
      .eq('id', doc.vendor_id)
      .single();
    if (vendor?.owner_email) {
      await notifyDocumentSubmitted(vendor.owner_email, vendor.name, doc.document_name, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando submit', err);
  }

  return NextResponse.json({ ok: true });
}
