#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_KEY = process.env.VENDORPASS_API_KEY;
const BASE_URL = (process.env.VENDORPASS_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

if (!API_KEY) {
  console.error('Falta la variable de entorno VENDORPASS_API_KEY.');
  process.exit(1);
}

async function apiGet(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text;
}

const server = new McpServer({ name: 'vendorpass', version: '0.1.0' });

server.tool(
  'list_vendors',
  'Lista los proveedores del usuario con su estado de cumplimiento (ok / atención / bloqueado).',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/vendors') }] }),
);

server.tool(
  'get_vendor',
  'Obtiene el detalle de un proveedor por su ID, con sus documentos y estados.',
  { vendor_id: z.string().describe('ID (uuid) del proveedor') },
  async ({ vendor_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/vendors/${vendor_id}`) }],
  }),
);

server.tool(
  'get_vendor_compliance',
  'Devuelve el estado de cumplimiento, si está habilitado y las razones de bloqueo/atención de un proveedor.',
  { vendor_id: z.string().describe('ID (uuid) del proveedor') },
  async ({ vendor_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/vendors/${vendor_id}/compliance`) }],
  }),
);

server.tool(
  'list_documents',
  'Lista documentos de compliance. Pasá vendor_id para filtrar por proveedor.',
  { vendor_id: z.string().optional().describe('ID del proveedor (opcional)') },
  async ({ vendor_id }) => {
    const q = vendor_id ? `?vendor_id=${encodeURIComponent(vendor_id)}` : '';
    return { content: [{ type: 'text' as const, text: await apiGet(`/api/v1/documents${q}`) }] };
  },
);

server.tool(
  'list_expirations',
  'Lista los documentos próximos a vencer o ya vencidos del usuario.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/expirations') }] }),
);

server.tool(
  'verify_document',
  'Valida un documento contra su validación anclada en Arkiv: confirma si está en la cadena, si el estado on-chain coincide con el esperado y si el hash del archivo coincide.',
  { document_id: z.string().describe('ID (uuid) del documento') },
  async ({ document_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/documents/${document_id}/verify`) }],
  }),
);

server.tool(
  'arkiv_audit',
  'Auditoría de paridad entre la base de datos y Arkiv: documentos faltantes en la cadena, huérfanos y diferencias de estado.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/arkiv/audit') }] }),
);

server.tool(
  'arkiv_report',
  'Genera un reporte de auditoría que combina el resumen de cumplimiento (proveedores bloqueados/atención/ok, vencimientos) con la paridad DB↔Arkiv y una conclusión.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/arkiv/report') }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('VendorPass MCP server conectado (stdio).');
