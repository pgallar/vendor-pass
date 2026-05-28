import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { documentStatus, vendorStatus } from '@/lib/status';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { VendorCard } from '@/components/vendor-pass/vendor-card';
import { EmptyState } from '@/components/vendor-pass/empty-state';
import { Button } from '@/components/vendor-pass/button';
import type { Vendor, VendorDocument, VendorStatus, VendorWithStatus } from '@/lib/types';
import { Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FILTER_TABS: Array<{ key: VendorStatus | 'todos'; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'ok', label: 'OK' },
  { key: 'atencion', label: 'Atención' },
  { key: 'bloqueado', label: 'Bloqueado' },
];

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filter } = await searchParams;
  const activeFilter = (FILTER_TABS.some(t => t.key === filter) ? filter : 'todos') as VendorStatus | 'todos';

  const sb = await createClient();
  const [{ data: vendors }, { data: documents }] = await Promise.all([
    sb.from('vendors').select('*').order('name'),
    sb.from('documents').select('*'),
  ]);

  const vs: Vendor[] = vendors ?? [];
  const ds: VendorDocument[] = documents ?? [];
  const byVendor = new Map<string, VendorDocument[]>();
  ds.forEach(d => { byVendor.set(d.vendor_id, [...(byVendor.get(d.vendor_id) ?? []), d]); });

  const withStatus: VendorWithStatus[] = vs.map(v => {
    const docs = byVendor.get(v.id) ?? [];
    return {
      ...v,
      status: vendorStatus(docs),
      documents: docs.map(d => ({ ...d, status: documentStatus(d) })),
    };
  });

  const counts = {
    todos: withStatus.length,
    ok: withStatus.filter(v => v.status === 'ok').length,
    atencion: withStatus.filter(v => v.status === 'atencion').length,
    bloqueado: withStatus.filter(v => v.status === 'bloqueado').length,
  };

  const filtered = activeFilter === 'todos'
    ? withStatus
    : withStatus.filter(v => v.status === activeFilter);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Proveedores"
          description={`${withStatus.length} proveedores registrados`}
          actions={
            <Button variant="primary" size="sm" asChild>
              <Link href="/vendors/new" className="inline-flex items-center gap-1.5">
                <Plus size={14} aria-hidden="true" />
                Nuevo
              </Link>
            </Button>
          }
        />

        <div
          role="tablist"
          aria-label="Filtrar proveedores"
          className="flex items-center gap-1 p-1 bg-secondary rounded-xl overflow-x-auto"
        >
          {FILTER_TABS.map(tab => {
            const active = tab.key === activeFilter;
            const href = tab.key === 'todos' ? '/vendors' : `/vendors?status=${tab.key}`;
            return (
              <Link
                key={tab.key}
                href={href}
                role="tab"
                aria-selected={active}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-11',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                <span className="text-[10px] tabular-nums opacity-70">({counts[tab.key]})</span>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin proveedores"
            description={activeFilter === 'todos' ? 'Registra tu primer proveedor para comenzar.' : 'Ningún proveedor con este estado.'}
            action={
              activeFilter === 'todos' ? (
                <Button variant="primary" asChild>
                  <Link href="/vendors/new" className="inline-flex items-center gap-1.5">
                    <Plus size={14} aria-hidden="true" />
                    Nuevo proveedor
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(v => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
