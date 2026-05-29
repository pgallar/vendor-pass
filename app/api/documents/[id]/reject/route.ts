import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyDocumentRejected } from '@/lib/notifications/portal';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 });

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('id, vendor_id, document_name, review_status, submitted_by')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  if (doc.review_status !== 'submitted') {
    return NextResponse.json({ error: 'Solo se pueden rechazar documentos enviados' }, { status: 409 });
  }

  const { error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: 'rejected', rejection_reason: reason })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    let email: string | null = null;

    if (doc.submitted_by) {
      const { data: userData } = await admin.auth.admin.getUserById(doc.submitted_by);
      email = userData?.user?.email ?? null;
    }

    if (!email) {
      const { data: invite } = await admin
        .from('vendor_portal_invites')
        .select('email')
        .eq('vendor_id', doc.vendor_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      email = invite?.email ?? null;
    }

    if (email) {
      await notifyDocumentRejected(email, doc.document_name, reason, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando reject', err);
  }

  return NextResponse.json({ ok: true });
}
