import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  buildAuditReport,
  getVendorCompliance,
  getVendorDetail,
  listDocuments,
  listExpirations,
  listVendors,
  verifyDocumentInArkiv,
} from '@/lib/api-keys/data';
import { extractDocumentFromBase64 } from '@/lib/api-keys/ai-extract';
import {
  createDocument,
  createDocumentFromFileWithAi,
  createDocumentWithFile,
  createVendor,
  deleteDocument,
  deleteVendor,
  updateDocument,
  updateVendor,
  uploadVendorFile,
} from '@/lib/api-keys/mutations';
import { isAiConfigured } from '@/lib/ai/client';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';
import { DOCUMENT_TYPE_VALUES } from '@/lib/documents';
import { getMcpContext } from '@/lib/mcp/context';

const documentTypeSchema = z
  .enum(DOCUMENT_TYPE_VALUES as [string, ...string[]])
  .describe(`Tipo: ${DOCUMENT_TYPE_VALUES.join(', ')}`);
const criticalitySchema = z.enum(['critical', 'normal']).describe('critical o normal');
const dateSchema = z.string().describe('Fecha YYYY-MM-DD');

function jsonText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** Registra las herramientas MCP (usa el contexto de API key del request actual). */
export function registerVendorPassMcpTools(server: McpServer): void {
  server.tool(
    'list_vendors',
    'Lista los proveedores del usuario con su estado de cumplimiento (ok / atención / bloqueado).',
    {},
    async () => {
      const { userId, supabase } = getMcpContext();
      const vendors = await listVendors(supabase, userId);
      return { content: [{ type: 'text' as const, text: jsonText({ vendors }) }] };
    },
  );

  server.tool(
    'get_vendor',
    'Obtiene el detalle de un proveedor por su ID, con sus documentos y estados.',
    { vendor_id: z.string().describe('ID (uuid) del proveedor') },
    async ({ vendor_id }) => {
      const { userId, supabase } = getMcpContext();
      const detail = await getVendorDetail(supabase, userId, vendor_id);
      if (!detail) {
        return {
          content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: jsonText(detail) }] };
    },
  );

  server.tool(
    'get_vendor_compliance',
    'Devuelve el estado de cumplimiento, si está habilitado y las razones de bloqueo/atención de un proveedor.',
    { vendor_id: z.string().describe('ID (uuid) del proveedor') },
    async ({ vendor_id }) => {
      const { userId, supabase } = getMcpContext();
      const compliance = await getVendorCompliance(supabase, userId, vendor_id);
      if (!compliance) {
        return {
          content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: jsonText(compliance) }] };
    },
  );

  server.tool(
    'list_documents',
    'Lista documentos de compliance. Pasá vendor_id para filtrar por proveedor.',
    { vendor_id: z.string().optional().describe('ID del proveedor (opcional)') },
    async ({ vendor_id }) => {
      const { userId, supabase } = getMcpContext();
      const documents = await listDocuments(supabase, userId, vendor_id);
      return { content: [{ type: 'text' as const, text: jsonText({ documents }) }] };
    },
  );

  server.tool(
    'list_expirations',
    'Lista los documentos próximos a vencer o ya vencidos del usuario.',
    {},
    async () => {
      const { userId, supabase } = getMcpContext();
      const documents = await listExpirations(supabase, userId);
      return { content: [{ type: 'text' as const, text: jsonText({ documents }) }] };
    },
  );

  server.tool(
    'verify_document',
    'Valida un documento contra su validación anclada en Arkiv.',
    { document_id: z.string().describe('ID (uuid) del documento') },
    async ({ document_id }) => {
      const { userId, supabase } = getMcpContext();
      const result = await verifyDocumentInArkiv(supabase, userId, document_id);
      if (!result) {
        return {
          content: [{ type: 'text' as const, text: 'Documento no encontrado' }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: jsonText(result) }] };
    },
  );

  server.tool(
    'arkiv_audit',
    'Auditoría de paridad entre la base de datos y Arkiv.',
    {},
    async () => {
      const { userId } = getMcpContext();
      const result = await auditArkivParity({ userId });
      return { content: [{ type: 'text' as const, text: jsonText(result) }] };
    },
  );

  server.tool(
    'arkiv_report',
    'Reporte de auditoría: cumplimiento + paridad DB↔Arkiv.',
    {},
    async () => {
      const { userId, supabase } = getMcpContext();
      const report = await buildAuditReport(supabase, userId);
      return { content: [{ type: 'text' as const, text: jsonText(report) }] };
    },
  );

  server.tool(
    'create_vendor',
    'Da de alta un proveedor asociado al usuario autenticado.',
    {
      name: z.string().describe('Nombre del proveedor (requerido)'),
      category: z.string().optional(),
      owner_name: z.string().optional(),
      owner_email: z.string().optional(),
      area: z.string().optional(),
      notes: z.string().optional(),
    },
    async input => {
      const { userId, supabase } = getMcpContext();
      try {
        const vendor = await createVendor(supabase, userId, input);
        return { content: [{ type: 'text' as const, text: jsonText({ vendor }) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'update_vendor',
    'Actualiza datos de un proveedor del usuario.',
    {
      vendor_id: z.string().describe('ID (uuid) del proveedor'),
      name: z.string().optional(),
      category: z.string().optional(),
      owner_name: z.string().optional(),
      owner_email: z.string().optional(),
      area: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ vendor_id, ...input }) => {
      const { userId, supabase } = getMcpContext();
      try {
        const vendor = await updateVendor(supabase, userId, vendor_id, input);
        if (!vendor) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText({ vendor }) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'delete_vendor',
    'Elimina un proveedor y sus documentos (también en Arkiv).',
    { vendor_id: z.string().describe('ID (uuid) del proveedor') },
    async ({ vendor_id }) => {
      const { userId, supabase } = getMcpContext();
      try {
        const result = await deleteVendor(supabase, userId, vendor_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText(result) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'extract_document_fields',
    'Envía un PDF o imagen (base64) y extrae metadatos de compliance con IA (OpenRouter): tipo, fechas, póliza, emisor, etc. Requiere OPENROUTER_API_KEY en el servidor. Usá el resultado con create_document o create_document_from_file_with_ai.',
    {
      mime_type: z.string().describe('application/pdf, image/png o image/jpeg'),
      content_base64: z.string().describe('Archivo codificado en base64'),
    },
    async input => {
      try {
        const extracted = await extractDocumentFromBase64(input);
        return {
          content: [
            {
              type: 'text' as const,
              text: jsonText({
                extracted,
                ai_configured: true,
                hint: 'Revisá confidence y fields_found antes de crear el documento.',
              }),
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'upload_vendor_file',
    'Sube un archivo de evidencia (PDF/PNG/JPEG, máx. 10 MB) para un proveedor. Devuelve file_url y file_hash. No ejecuta extracción IA; usá extract_document_fields o create_document_from_file_with_ai.',
    {
      vendor_id: z.string().describe('ID del proveedor'),
      filename: z.string().describe('Nombre del archivo, ej. poliza.pdf'),
      mime_type: z.string().describe('application/pdf, image/png o image/jpeg'),
      content_base64: z.string().describe('Contenido del archivo codificado en base64'),
    },
    async input => {
      const { userId, supabase } = getMcpContext();
      try {
        const result = await uploadVendorFile(supabase, userId, input.vendor_id, {
          filename: input.filename,
          mime_type: input.mime_type,
          content_base64: input.content_base64,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText(result) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'create_document',
    'Registra un documento de compliance para un proveedor. Opcionalmente incluí file_url y file_hash (de upload_vendor_file).',
    {
      vendor_id: z.string(),
      document_type: documentTypeSchema,
      document_name: z.string(),
      issued_at: dateSchema,
      expires_at: dateSchema,
      criticality: criticalitySchema,
      file_url: z.string().optional(),
      file_hash: z.string().optional(),
      notes: z.string().optional(),
    },
    async input => {
      const { userId, supabase } = getMcpContext();
      try {
        const document = await createDocument(supabase, userId, input);
        if (!document) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText({ document }) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'create_document_from_file_with_ai',
    'Sube un PDF/imagen, extrae metadatos con OpenRouter (si está configurado) y crea el documento. Los campos opcionales que envíes sobrescriben la IA. Ideal para cargar pólizas o certificados sin tipear fechas a mano.',
    {
      vendor_id: z.string(),
      filename: z.string(),
      mime_type: z.string(),
      content_base64: z.string(),
      extract_with_ai: z
        .boolean()
        .optional()
        .describe('Default true. En false, debés enviar document_type, document_name, issued_at y expires_at.'),
      document_type: documentTypeSchema.optional(),
      document_name: z.string().optional(),
      issued_at: dateSchema.optional(),
      expires_at: dateSchema.optional(),
      criticality: criticalitySchema.optional(),
      notes: z.string().optional(),
    },
    async input => {
      const { userId, supabase } = getMcpContext();
      try {
        const result = await createDocumentFromFileWithAi(supabase, userId, input);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: jsonText({
                document: result.document,
                extracted: result.extracted,
                upload: result.upload,
                ai_configured: isAiConfigured(),
              }),
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'create_document_with_file',
    'Sube el archivo y crea el documento con metadatos que vos proveés (sin extracción IA). Para IA usá create_document_from_file_with_ai.',
    {
      vendor_id: z.string(),
      document_type: documentTypeSchema,
      document_name: z.string(),
      issued_at: dateSchema,
      expires_at: dateSchema,
      criticality: criticalitySchema,
      filename: z.string(),
      mime_type: z.string(),
      content_base64: z.string(),
      notes: z.string().optional(),
    },
    async input => {
      const { userId, supabase } = getMcpContext();
      try {
        const document = await createDocumentWithFile(supabase, userId, input);
        if (!document) {
          return {
            content: [{ type: 'text' as const, text: 'Proveedor no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText({ document }) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'update_document',
    'Actualiza metadatos de un documento del usuario (no permite cambiar de proveedor).',
    {
      document_id: z.string().describe('ID (uuid) del documento'),
      document_type: documentTypeSchema.optional(),
      document_name: z.string().optional(),
      issued_at: dateSchema.optional(),
      expires_at: dateSchema.optional(),
      criticality: criticalitySchema.optional(),
      file_url: z.string().optional(),
      file_hash: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ document_id, ...input }) => {
      const { userId, supabase } = getMcpContext();
      try {
        const document = await updateDocument(supabase, userId, document_id, input);
        if (!document) {
          return {
            content: [{ type: 'text' as const, text: 'Documento no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText({ document }) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'delete_document',
    'Elimina un documento y su validación en Arkiv.',
    { document_id: z.string().describe('ID (uuid) del documento') },
    async ({ document_id }) => {
      const { userId, supabase } = getMcpContext();
      try {
        const result = await deleteDocument(supabase, userId, document_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: 'Documento no encontrado' }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: jsonText(result) }] };
      } catch (e) {
        return {
          content: [{ type: 'text' as const, text: e instanceof Error ? e.message : 'Error' }],
          isError: true,
        };
      }
    },
  );
}
