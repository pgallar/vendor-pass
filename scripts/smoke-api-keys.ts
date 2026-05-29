/**
 * Smoke: POST /api/api-keys (requiere stack Docker + usuario test@vendorpass.local).
 */
// @ts-expect-error ws optional
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function loadEnv() {
  for (const f of ['.env.docker', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), f), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* optional */
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const email = `apikeys-smoke-${Date.now()}@vendorpass.local`;
  const password = 'smokepass123';

  const supabase = createClient(url, ANON, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) throw new Error(`signup: ${signUpErr.message}`);
  const userId = signUp.user?.id;
  if (!userId) throw new Error('signup sin user id');

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  await admin.auth.admin.updateUserById(userId, { email_confirm: true });

  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signin: ${signInErr.message}`);
  const session = signIn.session;
  if (!session) throw new Error('sin sesión');

  const cookieVal = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }),
  );

  const body = JSON.stringify({ name: `smoke-${Date.now()}` });
  const resCookie = await fetch(`${appUrl}/api/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sb-vendorpass-auth-token=${cookieVal}` },
    body,
  });
  console.log('POST /api/api-keys (cookie)', resCookie.status, await resCookie.text());

  const resBearer = await fetch(`${appUrl}/api/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON,
    },
    body: JSON.stringify({ name: `smoke-bearer-${Date.now()}` }),
  });
  console.log('POST /api/api-keys (bearer)', resBearer.status, await resBearer.text());

  await supabase.auth.setSession(session);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: session.user.id,
      name: 'direct-insert',
      key_prefix: 'vp_test…',
      key_hash: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
    })
    .select('id')
    .single();
  console.log('direct insert', {
    data,
    error: error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null,
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
