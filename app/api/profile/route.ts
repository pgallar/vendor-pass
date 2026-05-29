import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { validateProfileFields } from '@/lib/profile/validation';

const PROFILE_COLUMNS = 'id, full_name, phone, organization, avatar_url, updated_at';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const existing = await auth.supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', auth.user.id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }

  let profile = existing.data;
  if (!profile) {
    // Respaldo por si el trigger no corrió (cuentas previas a la migración).
    const created = await auth.supabase
      .from('profiles')
      .insert({ id: auth.user.id })
      .select(PROFILE_COLUMNS)
      .single();
    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 });
    }
    profile = created.data;
  }

  return NextResponse.json({
    profile,
    email: auth.user.email ?? null,
    email_confirmed_at: auth.user.email_confirmed_at ?? null,
    created_at: auth.user.created_at ?? null,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const fields = {
    full_name: typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : null,
    phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
    organization:
      typeof body.organization === 'string' && body.organization.trim() ? body.organization.trim() : null,
  };

  const errors = validateProfileFields(fields);
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: 'Datos inválidos', fields: errors }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', auth.user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ profile: data });
}
