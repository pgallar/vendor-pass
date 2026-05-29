/**
 * Smoke: MCP remoto + aislamiento por API key (dos usuarios, datos separados).
 * Requiere Docker (app :3000, Supabase :54321).
 *
 * Uso: npx tsx scripts/smoke-mcp-isolation.ts
 */
// @ts-expect-error ws optional
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type SessionBundle = {
  userId: string;
  email: string;
  cookie: string;
  apiKey: string;
  vendorId: string;
  vendorName: string;
};

async function signupUser(supabaseUrl: string, label: string): Promise<SessionBundle> {
  const supabase = createClient(supabaseUrl, ANON, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const email = `mcp-iso-${label}-${Date.now()}@vendorpass.local`;
  const password = 'smokepass123';
  const { data: signUp, error } = await supabase.auth.signUp({ email, password });
  if (error || !signUp.user) throw new Error(`signup ${label}: ${error?.message}`);

  const admin = createClient(supabaseUrl, SERVICE, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  await admin.auth.admin.updateUserById(signUp.user.id, { email_confirm: true });

  const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.session) throw new Error(`signin ${label}`);

  const cookie = encodeURIComponent(JSON.stringify(signIn.session));
  return {
    userId: signUp.user.id,
    email,
    cookie,
    apiKey: '',
    vendorId: '',
    vendorName: `Vendor-ISO-${label}-${Date.now()}`,
  };
}

async function createVendor(appUrl: string, bundle: SessionBundle): Promise<string> {
  const res = await fetch(`${appUrl}/api/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-vendorpass-auth-token=${bundle.cookie}`,
    },
    body: JSON.stringify({ name: bundle.vendorName, category: 'QA' }),
  });
  if (!res.ok) throw new Error(`POST vendor: ${res.status} ${await res.text()}`);
  const { vendor } = (await res.json()) as { vendor: { id: string } };
  return vendor.id;
}

async function createApiKey(appUrl: string, bundle: SessionBundle): Promise<string> {
  const res = await fetch(`${appUrl}/api/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-vendorpass-auth-token=${bundle.cookie}`,
    },
    body: JSON.stringify({ name: `mcp-iso-${bundle.userId.slice(0, 8)}` }),
  });
  if (!res.ok) throw new Error(`POST api-key: ${res.status} ${await res.text()}`);
  const { key } = (await res.json()) as { key: { plaintext: string } };
  return key.plaintext;
}

async function v1Get(appUrl: string, apiKey: string, path: string) {
  return fetch(`${appUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
}

/** Parsea respuesta SSE de MCP y devuelve el último mensaje JSON data. */
async function parseMcpSseBody(text: string): Promise<unknown> {
  const lines = text.split('\n');
  let lastData: string | null = null;
  for (const line of lines) {
    if (line.startsWith('data: ')) lastData = line.slice(6);
  }
  if (!lastData) throw new Error('MCP: sin evento data en SSE');
  return JSON.parse(lastData);
}

async function mcpJsonRpc(
  appUrl: string,
  apiKey: string,
  method: string,
  params: unknown,
  id: number,
): Promise<unknown> {
  const res = await fetch(`${appUrl}/api/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP ${method} → ${res.status}: ${text}`);
  return parseMcpSseBody(text);
}

async function mcpListVendors(appUrl: string, apiKey: string): Promise<{ vendors: { id: string; name: string }[] }> {
  const msg = (await mcpJsonRpc(
    appUrl,
    apiKey,
    'tools/call',
    { name: 'list_vendors', arguments: {} },
    2,
  )) as { result?: { content?: { type: string; text: string }[] } };
  const text = msg.result?.content?.[0]?.text;
  if (!text) throw new Error('MCP list_vendors: sin contenido');
  return JSON.parse(text) as { vendors: { id: string; name: string }[] };
}

async function main() {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  console.log('1. Crear dos usuarios con proveedores propios…');
  const userA = await signupUser(supabaseUrl, 'A');
  const userB = await signupUser(supabaseUrl, 'B');
  userA.vendorId = await createVendor(appUrl, userA);
  userB.vendorId = await createVendor(appUrl, userB);
  userA.apiKey = await createApiKey(appUrl, userA);
  userB.apiKey = await createApiKey(appUrl, userB);
  console.log(`   Usuario A: vendor ${userA.vendorId}`);
  console.log(`   Usuario B: vendor ${userB.vendorId}`);

  console.log('2. MCP initialize (usuario A)…');
  const init = (await mcpJsonRpc(
    appUrl,
    userA.apiKey,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-mcp-isolation', version: '1' },
    },
    1,
  )) as { result?: { serverInfo?: { name: string } } };
  assert(init.result?.serverInfo?.name === 'vendorpass', 'MCP initialize: serverInfo incorrecto');
  console.log('   MCP initialize OK ✓');

  console.log('3. REST v1 — list_vendors scopeado…');
  const listA = await v1Get(appUrl, userA.apiKey, '/vendors');
  const listB = await v1Get(appUrl, userB.apiKey, '/vendors');
  assert(listA.ok && listB.ok, 'GET /vendors falló');
  const bodyA = (await listA.json()) as { vendors: { id: string; name: string }[] };
  const bodyB = (await listB.json()) as { vendors: { id: string; name: string }[] };
  const idsA = new Set(bodyA.vendors.map(v => v.id));
  const idsB = new Set(bodyB.vendors.map(v => v.id));
  assert(idsA.has(userA.vendorId), 'A no ve su proveedor');
  assert(!idsA.has(userB.vendorId), 'A ve proveedor de B (fuga de datos)');
  assert(idsB.has(userB.vendorId), 'B no ve su proveedor');
  assert(!idsB.has(userA.vendorId), 'B ve proveedor de A (fuga de datos)');
  console.log(`   A: ${bodyA.vendors.length} proveedor(es), B: ${bodyB.vendors.length} proveedor(es) ✓`);

  console.log('4. REST v1 — acceso cruzado debe ser 404…');
  const crossAB = await v1Get(appUrl, userA.apiKey, `/vendors/${userB.vendorId}`);
  const crossBA = await v1Get(appUrl, userB.apiKey, `/vendors/${userA.vendorId}`);
  assert(crossAB.status === 404, `A accedió al vendor de B: ${crossAB.status}`);
  assert(crossBA.status === 404, `B accedió al vendor de A: ${crossBA.status}`);
  console.log('   Cross-tenant 404 ✓');

  console.log('5. MCP tools/call list_vendors (usuario A)…');
  const mcpA = await mcpListVendors(appUrl, userA.apiKey);
  const mcpIdsA = new Set(mcpA.vendors.map(v => v.id));
  assert(mcpIdsA.has(userA.vendorId), 'MCP A: falta su proveedor');
  assert(!mcpIdsA.has(userB.vendorId), 'MCP A: incluye proveedor de B');
  console.log(`   MCP list_vendors A: ${mcpA.vendors.length} proveedor(es) ✓`);

  console.log('6. Comparar con total en DB (service role)…');
  const admin = createClient(supabaseUrl, SERVICE, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { count: totalVendors } = await admin
    .from('vendors')
    .select('id', { count: 'exact', head: true });
  const { count: countA } = await admin
    .from('vendors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userA.userId);
  assert(
    bodyA.vendors.length === countA,
    `API A devolvió ${bodyA.vendors.length} pero user tiene ${countA}`,
  );
  assert(
    (totalVendors ?? 0) > (countA ?? 0) || bodyB.vendors.length > 0,
    'Se esperaba más vendors en el sistema que los de un solo usuario (para validar scope)',
  );
  console.log(`   Total DB: ${totalVendors}, solo user A: ${countA} ✓`);

  console.log('7. Arkiv audit scopeado…');
  const auditA = await v1Get(appUrl, userA.apiKey, '/arkiv/audit');
  assert(auditA.ok, `arkiv/audit A: ${auditA.status}`);
  const auditBody = (await auditA.json()) as { postgresCount: number };
  const { count: docsA } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .in('vendor_id', [...idsA]);
  const { count: docsAll } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true });
  assert(
    auditBody.postgresCount === (docsA ?? 0),
    `audit A postgresCount=${auditBody.postgresCount} vs docs del usuario=${docsA}`,
  );
  if ((docsAll ?? 0) > (docsA ?? 0)) {
    assert(
      auditBody.postgresCount < (docsAll ?? 0),
      'audit A debería contar menos documentos que el total del sistema',
    );
  }
  console.log(`   arkiv/audit A: postgresCount=${auditBody.postgresCount} (docs usuario=${docsA}, total=${docsAll}) ✓`);

  console.log('8. API key inválida → 401…');
  const bad = await v1Get(appUrl, 'vp_' + '0'.repeat(40), '/vendors');
  assert(bad.status === 401, `clave inválida debería ser 401, fue ${bad.status}`);
  console.log('   401 sin auth ✓');

  console.log('\nSmoke MCP + aislamiento: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
