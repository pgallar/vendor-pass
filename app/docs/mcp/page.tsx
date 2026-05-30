import type { ReactNode } from 'react';
import { DocPageHeader, DocSteps, DocCallout } from '@/components/docs/doc-primitives';

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-lg bg-secondary p-3 text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

const READ_TOOLS = [
  ['list_vendors', 'Proveedores del usuario con su estado de cumplimiento.'],
  ['get_vendor', 'Detalle de un proveedor por ID, con sus documentos.'],
  ['get_vendor_compliance', 'Estado de cumplimiento y razones de bloqueo/atención.'],
  ['list_documents', 'Documentos de compliance (filtrables por proveedor).'],
  ['list_expirations', 'Documentos próximos a vencer o ya vencidos.'],
  ['verify_document', 'Valida un documento contra su anclaje en Arkiv.'],
  ['arkiv_audit', 'Auditoría de paridad entre la base de datos y Arkiv.'],
  ['arkiv_report', 'Reporte de auditoría: cumplimiento + paridad DB↔Arkiv.'],
] as const;

const WRITE_TOOLS = [
  ['create_vendor / update_vendor / delete_vendor', 'Alta y administración de proveedores.'],
  ['upload_vendor_file', 'Sube evidencia (PDF/PNG/JPEG, máx. 10 MB) y devuelve file_url y file_hash.'],
  ['extract_document_fields', 'Extrae metadatos de un archivo con IA (OpenRouter) sin guardarlo.'],
  ['create_document_from_file_with_ai', 'Sube, extrae con IA y crea el documento en un solo paso.'],
  ['create_document / create_document_with_file', 'Registra un documento con metadatos provistos por vos.'],
  ['update_document / delete_document', 'Edita o elimina un documento (y su validación en Arkiv).'],
] as const;

export default function DocsMcpPage() {
  return (
    <>
      <DocPageHeader
        title="Servidor MCP"
        description="Conectá asistentes de IA, IDEs y automatizaciones a VendorPass mediante el Model Context Protocol."
      />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">¿Qué es?</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          VendorPass expone un <strong>servidor MCP remoto</strong> que permite a un asistente de IA leer y
          gestionar tu cumplimiento con lenguaje natural: consultar proveedores, listar vencimientos, generar
          reportes de auditoría Arkiv o dar de alta documentos. Usa el transporte{' '}
          <strong>Streamable HTTP</strong> (especificación MCP actual), por lo que no necesitás instalar nada:
          solo la URL del endpoint y una API key.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">URL del servidor</h2>
        <p className="mt-3 text-sm text-muted-foreground">Apuntá tu cliente MCP a:</p>
        <CodeBlock>https://vendor-pass.vercel.app/api/mcp</CodeBlock>
        <p className="text-sm text-muted-foreground">
          En desarrollo local el endpoint es <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">http://localhost:3000/api/mcp</code>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Conectarse paso a paso</h2>
        <DocSteps
          steps={[
            {
              title: 'Generá una API key',
              description:
                'En Integraciones creá una API key (prefijo vp_) y copiala al crearla: solo se muestra una vez.',
            },
            {
              title: 'Configurá el endpoint',
              description: 'Usá la URL del servidor MCP en tu cliente (asistente, IDE o automatización).',
            },
            {
              title: 'Autenticá cada solicitud',
              description: 'Enviá la API key en el header Authorization como Bearer token.',
            },
            {
              title: 'Probá la conexión',
              description: 'Pedile al asistente algo como "listá mis documentos por vencer" y verificá la respuesta.',
            },
          ]}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Autenticación</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          En cada solicitud el cliente debe enviar tu API key en el header <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">Authorization</code>:
        </p>
        <CodeBlock>Authorization: Bearer vp_tu_clave_secreta</CodeBlock>
        <p className="text-sm text-muted-foreground">
          Sin una clave válida el servidor responde <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">401</code>. Si revocás la clave en
          Integraciones, deja de funcionar de inmediato.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Configuración del cliente</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          La mayoría de clientes MCP remotos aceptan una URL y headers personalizados. El formato suele ser
          similar a:
        </p>
        <CodeBlock>{`{
  "mcpServers": {
    "vendorpass": {
      "url": "https://vendor-pass.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer vp_tu_clave"
      }
    }
  }
}`}</CodeBlock>
        <p className="text-sm text-muted-foreground">
          Consultá la documentación de tu herramienta para saber dónde pegar este bloque (archivo de
          configuración MCP, panel de integraciones, variables de entorno, etc.) y reiniciá el cliente
          después de guardar.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Probar la conexión</h2>
        <p className="mt-3 text-sm text-muted-foreground">Con el cliente conectado, pedile por ejemplo:</p>
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>«¿Qué proveedores tengo en estado de atención o bloqueados?»</li>
          <li>«Listá los documentos por vencer.»</li>
          <li>«Generá un reporte de auditoría Arkiv.»</li>
          <li>«Dá de alta un proveedor y subí su póliza ART.»</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Herramientas disponibles</h2>

        <h3 className="mt-5 text-base font-semibold text-foreground">Lectura</h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          {READ_TOOLS.map(([name, desc]) => (
            <li key={name}>
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-foreground">{name}</code>
              {' — '}
              {desc}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-base font-semibold text-foreground">Alta y administración</h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          {WRITE_TOOLS.map(([name, desc]) => (
            <li key={name}>
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-foreground">{name}</code>
              {' — '}
              {desc}
            </li>
          ))}
        </ul>
      </section>

      <DocCallout variant="info">
        <p>
          Las herramientas operan siempre sobre los datos del usuario dueño de la API key: cada clave queda
          aislada a su propia cuenta.
        </p>
      </DocCallout>

      <DocCallout variant="tip">
        <p>
          ¿Preferís un proceso local por stdio para desarrollo? El repo incluye un paquete opcional en{' '}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">mcp-server/</code>. Para uso
          normal, el endpoint remoto <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">/api/mcp</code> descrito arriba es la opción recomendada.
        </p>
      </DocCallout>
    </>
  );
}
