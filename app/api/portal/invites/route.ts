import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { generateInviteToken } from '@/lib/portal/invites';
import { notifyPortalInvite } from '@/lib/notifications/portal';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!vendorId || !email) {
    return NextResponse.json({ error: 'vendor_id e email son requeridos' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const { data: vendor, error: vErr } = await auth.supabase
    .from('vendors')
    .select('id, name, user_id')
    .eq('id', vendorId)
    .maybeSingle();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!vendor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  const { plaintext, hash, expiresAt } = generateInviteToken();

  const { error: insErr } = await auth.supabase.from('vendor_portal_invites').insert({
    vendor_id: vendorId,
    email,
    token_hash: hash,
    expires_at: expiresAt,
    created_by: auth.user.id,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  try {
    await notifyPortalInvite(email, vendor.name, plaintext);
  } catch (err) {
    console.error('[portal] error enviando invitación', err);
  }

  return NextResponse.json({ ok: true, expiresAt }, { status: 201 });
}
