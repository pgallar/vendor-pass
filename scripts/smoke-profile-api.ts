/**
 * Smoke test: migración profiles + API /api/profile (requiere stack Docker levantado).
 * Uso: npx tsx scripts/smoke-profile-api.ts
 */
// @ts-expect-error ws types optional in dev
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.docker'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const email = `profile-smoke-${Date.now()}@vendorpass.local`;
  const password = 'smokepass123';

  const supabase = createClient(url, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) throw new Error(`signup: ${signUpErr.message}`);
  const userId = signUp.user?.id;
  if (!userId) throw new Error('signup sin user id');

  // Confirmar correo (Mailpit en local no confirma automáticamente)
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  await admin.auth.admin.updateUserById(userId, { email_confirm: true });

  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr || !session.session) throw new Error(`signin: ${signInErr?.message ?? 'sin sesión'}`);
  const token = session.session.access_token;

  // Perfil autocreado por trigger
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  if (profileErr || !profileRow) throw new Error(`perfil no autocreado: ${profileErr?.message}`);

  // API Next.js con Bearer (si el servidor no acepta Bearer, fallará aquí)
  const getRes = await fetch(`${appUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON },
  });
  if (!getRes.ok) throw new Error(`GET /api/profile → ${getRes.status}: ${await getRes.text()}`);
  const getBody = (await getRes.json()) as { profile: { id: string }; email: string };
  if (getBody.profile?.id !== userId) throw new Error('GET /api/profile: perfil incorrecto');
  console.log('GET /api/profile OK ✓', getBody.email === email ? '(email)' : '');

  const patchApi = await fetch(`${appUrl}/api/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ full_name: 'Smoke API', phone: '+54 11 2222-3333', organization: 'QA' }),
  });
  if (!patchApi.ok) throw new Error(`PATCH /api/profile → ${patchApi.status}: ${await patchApi.text()}`);
  console.log('PATCH /api/profile OK ✓');

  // Avatar: PNG mínimo 1×1
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'avatar.png');
  const avatarRes = await fetch(`${appUrl}/api/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: ANON },
    body: form,
  });
  if (!avatarRes.ok) {
    const errText = await avatarRes.text();
    if (avatarRes.status === 503 && errText.includes('S3')) {
      console.warn('POST /api/profile/avatar → 503 (S3 no configurado en el proceso de la app)');
    } else {
      throw new Error(`POST /api/profile/avatar → ${avatarRes.status}: ${errText}`);
    }
  } else {
    const { avatar_url } = (await avatarRes.json()) as { avatar_url: string };
    const img = await fetch(avatar_url);
    if (!img.ok) throw new Error(`avatar_url no accesible: ${avatar_url} → ${img.status}`);
    console.log('POST /api/profile/avatar OK ✓ (URL pública)');
  }

  const unauth = await fetch(`${appUrl}/api/profile`);
  if (unauth.status !== 401) throw new Error(`sin auth debería ser 401, fue ${unauth.status}`);
  console.log('GET /api/profile sin auth → 401 ✓');

  console.log('\nSmoke profile: OK (migración + API + RLS + trigger)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
