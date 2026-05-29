'use client';

import Link from 'next/link';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ApiKeysManager } from '@/components/vendor-pass/api-keys-manager';
import { Button } from '@/components/vendor-pass/button';
import { BookOpen } from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title="Integraciones"
          description="Generá API keys para conectar VendorPass con asistentes, automatizaciones u otras herramientas."
        />

        <ApiKeysManager />

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 text-sm">
          <h2 className="text-sm font-semibold text-foreground">Servidor MCP</h2>
          <p className="text-muted-foreground">
            Con una API key y la URL <code className="font-mono text-xs">/api/mcp</code> conectá cualquier
            cliente MCP compatible (asistentes, IDEs, automatizaciones) sin instalar software extra.
          </p>
          <Button variant="outline" size="sm" asChild className="self-start min-h-11">
            <Link href="/integrations/mcp" className="inline-flex items-center gap-2">
              <BookOpen size={16} aria-hidden="true" />
              Ver guía de conexión MCP
            </Link>
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
