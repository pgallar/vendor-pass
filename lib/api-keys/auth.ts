import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashApiKey, isValidKeyFormat } from '@/lib/api-keys/keys';

export type ApiKeyAuth =
  | { userId: string; supabase: SupabaseClient; keyId: string; error: null }
  | { userId: null; supabase: null; keyId: null; error: NextResponse };

function unauthorized(): ApiKeyAuth {
  return {
    userId: null,
    supabase: null,
    keyId: null,
    error: NextResponse.json({ error: 'API key inválida o revocada' }, { status: 401 }),
  };
}

/** Resuelve el header Authorization: Bearer vp_... a un usuario, vía service-role. */
export async function requireApiKey(req: Request): Promise<ApiKeyAuth> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!isValidKeyFormat(token)) return unauthorized();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hashApiKey(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return unauthorized();

  // Marcar último uso (best-effort, sin bloquear la respuesta).
  void admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return { userId: data.user_id, supabase: admin, keyId: data.id, error: null };
}
