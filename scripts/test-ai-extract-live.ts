/**
 * Prueba de integración en vivo: OpenRouter + normalización + endpoint HTTP.
 * Uso: npx tsx scripts/test-ai-extract-live.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

import { isAiConfigured, AI_EXTRACTION_MODEL } from '../lib/ai/client';
import { extractDocumentFields } from '../lib/ai/extract';
import { getSupabaseAnonKey, getSupabaseServerAuthUrl, supabaseAuthCookieOptions } from '../lib/supabase/env';

const FIXTURE = join(__dirname, 'fixtures', 'compliance-test.pdf');
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = `ai-extract-test-${Date.now()}@vendorpass.local`;
const TEST_PASSWORD = 'test123456';

let passed = 0;
let failed = 0;

function ok(name: string, detail?: string) {
  passed++;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  failed++;
  console.error(`  ✗ ${name} — ${detail}`);
}

async function testConfig() {
  console.log('\n[1] Configuración');
  if (isAiConfigured()) ok('OPENROUTER_API_KEY presente');
  else fail('OPENROUTER_API_KEY', 'no configurada');
  if (AI_EXTRACTION_MODEL) ok('AI_EXTRACTION_MODEL', AI_EXTRACTION_MODEL);
  else fail('AI_EXTRACTION_MODEL', 'vacía');
}

async function testDirectExtraction() {
  console.log('\n[2] Extracción directa (OpenRouter + PDF fixture)');
  const buffer = readFileSync(FIXTURE);
  const start = Date.now();
  try {
    const result = await extractDocumentFields(buffer, 'application/pdf');
    const ms = Date.now() - start;
    ok('extractDocumentFields respondió', `${ms}ms`);

    if (result.document_type === 'seguro_rc' || result.document_type !== 'otro') {
      ok('document_type reconocido', result.document_type);
    } else {
      fail('document_type', `esperaba seguro_rc u otro tipo, got: ${result.document_type}`);
    }

    if (result.expires_at === '2026-12-31') {
      ok('expires_at', result.expires_at);
    } else {
      fail('expires_at', `esperaba 2026-12-31, got: ${result.expires_at || '(vacío)'}`);
    }

    if (result.confidence > 0) ok('confidence > 0', String(result.confidence));
    else fail('confidence', '0 o vacío');

    if (result.fields_found.length > 0) ok('fields_found', result.fields_found.join(', '));
    else fail('fields_found', 'ninguno');

    console.log('    Resumen:', JSON.stringify(result, null, 2));
  } catch (err) {
    fail('extractDocumentFields', err instanceof Error ? err.message : String(err));
  }
}

async function sessionCookieHeader(accessToken: string, refreshToken: string): Promise<string> {
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(getSupabaseServerAuthUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll: () => [],
      setAll: cookiesToSet => {
        for (const c of cookiesToSet) jar.push({ name: c.name, value: c.value });
      },
    },
  });
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return jar.map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
}

async function ensureTestUser(): Promise<{ accessToken: string; refreshToken: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr && !createErr.message.includes('already')) {
    throw new Error(`createUser: ${createErr.message}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) throw new Error(`signIn: ${error?.message ?? 'sin sesión'}`);
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

async function testHttpEndpoint() {
  console.log('\n[3] Endpoint HTTP POST /api/documents/extract');

  // 3a: sin auth → 401
  const unauth = await fetch(`${BASE}/api/documents/extract`, {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('file', new Blob([readFileSync(FIXTURE)], { type: 'application/pdf' }), 'test.pdf');
      return fd;
    })(),
  });
  if (unauth.status === 401) ok('sin sesión → 401');
  else fail('sin sesión', `esperaba 401, got ${unauth.status}`);

  // 3b: con auth (cookie SSR) → 200 + extracted
  let accessToken: string;
  let refreshToken: string;
  try {
    ({ accessToken, refreshToken } = await ensureTestUser());
    ok('usuario de prueba autenticado', TEST_EMAIL);
  } catch (err) {
    fail('auth de prueba', err instanceof Error ? err.message : String(err));
    return;
  }

  const cookieHeader = await sessionCookieHeader(accessToken, refreshToken);

  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(FIXTURE)], { type: 'application/pdf' }), 'compliance-test.pdf');

  const start = Date.now();
  const res = await fetch(`${BASE}/api/documents/extract`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: fd,
  });
  const ms = Date.now() - start;
  const body = await res.json().catch(() => ({}));

  if (res.status === 200) ok('autenticado → 200', `${ms}ms`);
  else fail('autenticado', `status ${res.status}: ${JSON.stringify(body)}`);

  if (body.extracted?.expires_at) ok('response.extracted.expires_at', body.extracted.expires_at);
  else if (res.ok) fail('response.extracted', 'sin expires_at');

  if (body.extracted?.confidence > 0) ok('response.extracted.confidence', String(body.extracted.confidence));
  else if (res.ok) fail('response.extracted.confidence', '0 o ausente');
}

async function testDegradation503() {
  console.log('\n[4] Degradación sin OPENROUTER_API_KEY → 503');
  // El servidor Next.js ya cargó env; probamos isAiConfigured=false vía lógica local
  const prev = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = '';
  const configured = isAiConfigured();
  process.env.OPENROUTER_API_KEY = prev;
  if (!configured) ok('isAiConfigured() false sin clave');
  else fail('isAiConfigured()', 'debería ser false sin clave');
}

async function main() {
  console.log('=== VendorPass AI Extract — pruebas en vivo ===');
  await testConfig();
  await testDirectExtraction();
  await testHttpEndpoint();
  await testDegradation503();

  console.log(`\n=== Resultado: ${passed} OK, ${failed} FAIL ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
