import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { generateApiKey } from '@/lib/api-keys/keys';

const MAX_ACTIVE_KEYS = 5;

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'Máximo 60 caracteres' }, { status: 400 });

  const { count, error: countErr } = await auth.supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .is('revoked_at', null);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `Alcanzaste el máximo de ${MAX_ACTIVE_KEYS} API keys activas. Revocá una para crear otra.` },
      { status: 400 },
    );
  }

  const { plaintext, prefix, hash } = generateApiKey();
  const { data, error } = await auth.supabase
    .from('api_keys')
    .insert({ user_id: auth.user.id, name, key_prefix: prefix, key_hash: hash })
    .select('id, name, key_prefix, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error creando la API key' }, { status: 400 });

  return NextResponse.json({ key: { ...data, plaintext } }, { status: 201 });
}
