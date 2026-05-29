/**
 * Smoke: herramientas MCP de extracción IA (OpenRouter) vía protocolo MCP en /api/mcp.
 * Requiere app :3000, OPENROUTER_API_KEY y API key del usuario (env MCP_API_KEY o crea una).
 *
 * Uso: npx tsx scripts/smoke-mcp-ai-extract.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isAiConfigured } from '../lib/ai/client';

function loadEnv() {
  for (const f of ['.env.docker', '.env']) {
    try {
      const raw = readFileSync(join(process.cwd(), f), 'utf8');
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

async function mcpCallTool(
  appUrl: string,
  apiKey: string,
  name: string,
  args: Record<string, unknown>,
  id: number,
) {
  const msg = (await mcpJsonRpc(
    appUrl,
    apiKey,
    'tools/call',
    { name, arguments: args },
    id,
  )) as { result?: { content?: { type: string; text: string }[]; isError?: boolean } };
  const text = msg.result?.content?.[0]?.text ?? '';
  return { text, isError: Boolean(msg.result?.isError), data: text ? JSON.parse(text) : null };
}

async function main() {
  loadEnv();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey?.startsWith('vp_')) {
    throw new Error('Definí MCP_API_KEY (vp_…) de Integraciones en .env para este smoke');
  }
  if (!isAiConfigured()) {
    throw new Error('OPENROUTER_API_KEY no configurada — no se puede probar extracción IA');
  }

  const fixturePath = join(__dirname, 'fixtures', 'compliance-test.pdf');
  const pdfB64 = readFileSync(fixturePath).toString('base64');

  console.log('1. MCP tools/list — verificar herramientas IA…');
  const list = (await mcpJsonRpc(appUrl, apiKey, 'tools/list', {}, 1)) as {
    result?: { tools?: { name: string }[] };
  };
  const names = new Set((list.result?.tools ?? []).map(t => t.name));
  assert(names.has('extract_document_fields'), 'falta extract_document_fields en tools/list');
  assert(
    names.has('create_document_from_file_with_ai'),
    'falta create_document_from_file_with_ai en tools/list',
  );
  console.log('   tools IA registradas ✓');

  console.log('2. extract_document_fields (fixture compliance-test.pdf)…');
  const extract = await mcpCallTool(
    appUrl,
    apiKey,
    'extract_document_fields',
    { mime_type: 'application/pdf', content_base64: pdfB64 },
    2,
  );
  assert(!extract.isError, extract.text);
  const ex = extract.data?.extracted as {
    document_type?: string;
    expires_at?: string;
    confidence?: number;
  };
  assert(Boolean(ex?.expires_at), 'extracción sin expires_at');
  assert((ex?.confidence ?? 0) > 0, 'confidence vacía');
  console.log(
    `   tipo=${ex?.document_type} expires=${ex?.expires_at} confidence=${ex?.confidence} ✓`,
  );

  console.log('3. list_vendors — elegir proveedor para alta con IA…');
  const vendors = await mcpCallTool(appUrl, apiKey, 'list_vendors', {}, 3);
  const vendorId = vendors.data?.vendors?.[0]?.id as string | undefined;
  assert(Boolean(vendorId), 'sin proveedores para probar create_document_from_file_with_ai');

  console.log('4. create_document_from_file_with_ai…');
  const created = await mcpCallTool(
    appUrl,
    apiKey,
    'create_document_from_file_with_ai',
    {
      vendor_id: vendorId,
      filename: 'smoke-mcp-ai-extract.pdf',
      mime_type: 'application/pdf',
      content_base64: pdfB64,
      notes: 'Creado por smoke-mcp-ai-extract',
    },
    4,
  );
  assert(!created.isError, created.text);
  assert(created.data?.document?.id, 'sin document.id');
  assert(created.data?.extracted, 'sin extracted en respuesta');
  assert(created.data?.upload?.fileUrl, 'sin upload.fileUrl');
  console.log(`   documento ${created.data.document.id} creado con IA ✓`);

  console.log('\nSmoke MCP extracción IA: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
