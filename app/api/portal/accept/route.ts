import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashInviteToken, isValidTokenFormat, isInviteUsable } from '@/lib/portal/invites';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!isValidTokenFormat(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: invite, error } = await admin
    .from('vendor_portal_invites')
    .select('id, vendor_id, email, expires_at, accepted_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite || !isInviteUsable(invite)) {
    return NextResponse.json({ error: 'Invitación inválida, vencida o ya utilizada' }, { status: 410 });
  }

  const { error: memErr } = await admin
    .from('vendor_portal_members')
    .upsert(
      { vendor_id: invite.vendor_id, user_id: auth.user.id, role: 'uploader' },
      { onConflict: 'vendor_id,user_id' },
    );
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  const { error: updErr } = await admin
    .from('vendor_portal_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, vendorId: invite.vendor_id });
}
