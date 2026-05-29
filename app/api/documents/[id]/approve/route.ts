import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { anchorDocument } from '@/lib/arkiv/anchor';
import { notifyDocumentApproved, notifyDocumentAnchored } from '@/lib/notifications/portal';
import type { VendorDocument } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;
  const doAnchor = new URL(req.url).searchParams.get('anchor') === '1';

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  if (doc.review_status !== 'submitted') {
    return NextResponse.json({ error: 'Solo se pueden aprobar documentos enviados' }, { status: 409 });
  }

  const nextStatus = doAnchor ? 'anchored' : 'approved';
  const { data: updated, error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: nextStatus, rejection_reason: null })
    .eq('id', id)
    .select()
    .single();
  if (updErr || !updated) return NextResponse.json({ error: updErr?.message ?? 'Error' }, { status: 400 });

  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('name, owner_email')
    .eq('id', doc.vendor_id)
    .single();

  if (doAnchor) {
    try {
      await anchorDocument(auth.supabase, updated as VendorDocument, vendor, auth.user.id);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Error al anclar en Arkiv' },
        { status: 500 },
      );
    }
  }

  try {
    const submitterEmail = await resolveSubmitterEmail(doc.vendor_id, doc.submitted_by);
    if (submitterEmail) {
      if (doAnchor) await notifyDocumentAnchored(submitterEmail, doc.document_name, id);
      else await notifyDocumentApproved(submitterEmail, doc.document_name, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando approve', err);
  }

  return NextResponse.json({ ok: true, review_status: nextStatus });
}

async function resolveSubmitterEmail(
  vendorId: string,
  submittedBy: string | null,
): Promise<string | null> {
  const admin = supabaseAdmin();

  if (submittedBy) {
    const { data: userData } = await admin.auth.admin.getUserById(submittedBy);
    if (userData?.user?.email) return userData.user.email;
  }

  const { data: invite } = await admin
    .from('vendor_portal_invites')
    .select('email')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return invite?.email ?? null;
}
