'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { Button } from '@/components/vendor-pass/button';
import { ArrowLeft } from 'lucide-react';

function DocBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 text-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="text-muted-foreground flex flex-col gap-2 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-secondary [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </section>
  );
}

export default function McpIntegrationDocPage() {
  const mcpUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/mcp`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tu-dominio'}/api/mcp`;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/integrations" className="inline-flex items-center gap-1.5">
              <ArrowLeft size={16} aria-hidden="true" />
              Volver a integraciones
            </Link>
          </Button>
          <PageHeader
            title="Conectar por MCP (URL remota)"
            description="Solo necesitás la URL del servidor MCP y una API key. No hace falta instalar software adicional."
          />
        </div>

        <DocBlock title="1. Obtener una API key">
          <p>
            En{' '}
            <Link href="/integrations" className="text-primary underline underline-offset-2">
              Integraciones
            </Link>{' '}
            generá una API key y copiala al crearla (solo se muestra una vez).
          </p>
        </DocBlock>

        <DocBlock title="2. URL del servidor MCP">
          <p>Usá esta URL en tu cliente MCP (asistente, IDE, automatización):</p>
          <pre>{mcpUrl}</pre>
          <p>Transporte: <strong>Streamable HTTP</strong> (especificación MCP actual).</p>
        </DocBlock>

        <DocBlock title="3. Autenticación">
          <p>
            En cada solicitud el cliente debe enviar tu API key en el header{' '}
            <code>Authorization</code>:
          </p>
          <pre>{`Authorization: Bearer vp_tu_clave_secreta`}</pre>
          <p>
            Sin una clave válida el servidor responde <code>401</code>. Si revocás la clave en
            Integraciones, deja de funcionar de inmediato.
          </p>
        </DocBlock>

        <DocBlock title="4. Ejemplo de configuración (cliente genérico)">
          <p>
            La mayoría de clientes MCP remotos aceptan una URL y headers personalizados. El formato
            suele ser similar a:
          </p>
          <pre>{`{
  "mcpServers": {
    "vendorpass": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer vp_tu_clave"
      }
    }
  }
}`}</pre>
          <p>
            Consultá la documentación de tu herramienta para saber dónde pegar este bloque (archivo
            de configuración MCP, panel de integraciones, variables de entorno, etc.).
          </p>
        </DocBlock>

        <DocBlock title="5. Ejemplo: asistente de escritorio con MCP remoto">
          <p>
            Si tu asistente permite servidores MCP por URL (no solo proceso local), agregá la URL y
            el header <code>Authorization</code> como en el paso 4. Reiniciá el cliente después de
            guardar.
          </p>
        </DocBlock>

        <DocBlock title="6. Probar la conexión">
          <p>Con la app en marcha, pedí por ejemplo:</p>
          <ul>
            <li>«¿Qué proveedores tengo en estado de atención o bloqueados?»</li>
            <li>«Listá documentos por vencer.»</li>
            <li>«Generá un reporte de auditoría Arkiv.»</li>
            <li>«Dá de alta un proveedor y subí su póliza ART.»</li>
          </ul>
        </DocBlock>

        <DocBlock title="Herramientas disponibles">
          <p className="text-foreground font-medium">Lectura</p>
          <ul>
            <li>
              <code>list_vendors</code> — proveedores y estado de cumplimiento
            </li>
            <li>
              <code>get_vendor</code> / <code>get_vendor_compliance</code>
            </li>
            <li>
              <code>list_documents</code> / <code>list_expirations</code>
            </li>
            <li>
              <code>verify_document</code> — validación contra Arkiv
            </li>
            <li>
              <code>arkiv_audit</code> / <code>arkiv_report</code>
            </li>
          </ul>
          <p className="text-foreground font-medium mt-2">Alta y administración</p>
          <ul>
            <li>
              <code>create_vendor</code> / <code>update_vendor</code> /{' '}
              <code>delete_vendor</code>
            </li>
            <li>
              <code>upload_vendor_file</code> — PDF o imagen en base64 (máx. 10 MB)
            </li>
            <li>
              <code>extract_document_fields</code> — extracción IA (OpenRouter) sin guardar
            </li>
            <li>
              <code>create_document_from_file_with_ai</code> — sube, extrae con IA y crea el documento
            </li>
            <li>
              <code>create_document</code> / <code>create_document_with_file</code> /{' '}
              <code>update_document</code> / <code>delete_document</code>
            </li>
          </ul>
        </DocBlock>

        <DocBlock title="Documentación completa">
          <p>
            ¿Querés más detalle sobre cada herramienta y ejemplos de uso? Consultá la{' '}
            <Link href="/docs/mcp" className="text-primary underline underline-offset-2">
              guía del servidor MCP en la documentación
            </Link>
            .
          </p>
        </DocBlock>
      </div>
    </AppShell>
  );
}
