'use client';

import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ApiKeysManager } from '@/components/vendor-pass/api-keys-manager';

export default function IntegrationsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title="Integraciones"
          description="Generá API keys para conectar VendorPass con Claude (MCP) y otras herramientas."
        />

        <ApiKeysManager />

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 text-sm">
          <h2 className="text-sm font-semibold text-foreground">Conectar Claude (MCP)</h2>
          <p className="text-muted-foreground">
            Con una API key podés conectar el servidor MCP de VendorPass a Claude Desktop o Claude Code
            y consultar tu cumplimiento en lenguaje natural. Las instrucciones de configuración están en{' '}
            <code className="font-mono text-xs">mcp-server/README.md</code>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
