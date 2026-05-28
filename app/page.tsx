import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { documentStatus, vendorStatus } from '@/lib/status';
import { getStore } from '@/lib/arkiv/validations';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { KpiCard } from '@/components/vendor-pass/kpi-card';
import { VendorCard } from '@/components/vendor-pass/vendor-card';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { Button } from '@/components/vendor-pass/button';
import { ArkivSyncBanner } from '@/components/vendor-pass/arkiv-sync-banner';
import type { Vendor, VendorDocument, VendorStatus, VendorWithStatus } from '@/lib/types';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Plus,
  Bell,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string }>;
}) {
  const { claimed } = await searchParams;
  const sb = await createClient();
  const store = getStore();

  const [{ data: vendors }, { data: documents }, expired, soon] = await Promise.all([
    sb.from('vendors').select('*').order('name'),
    sb.from('documents').select('*').order('expires_at', { ascending: true }),
    store.listExpired(),
    store.listExpiringSoon(30),
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

  const statuses: Record<VendorStatus, number> = { ok: 0, atencion: 0, bloqueado: 0 };
  withStatus.forEach(v => { statuses[v.status]++; });

  const docsVencidos = expired.length;
  const docsPorVencer = soon.length;
  const vendorById = new Map(vs.map(v => [v.id, v]));
  const upcoming = soon.slice(0, 10);
  const alertVendors = withStatus.filter(v => v.status === 'bloqueado' || v.status === 'atencion');

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {claimed && Number(claimed) > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[oklch(0.936_0.04_145)] border border-[oklch(0.55_0.12_145)]/30">
            <p className="text-sm text-foreground">
              Se vincularon {claimed} proveedor{Number(claimed) > 1 ? 'es' : ''} de demostración a tu cuenta.
            </p>
          </div>
        )}

        <PageHeader
          title="Dashboard"
          description="Vigencia operativa verificable"
          actions={
            <Button variant="primary" size="sm" asChild>
              <Link href="/vendors/new" className="inline-flex items-center gap-1.5">
                <Plus size={14} aria-hidden="true" />
                Nuevo proveedor
              </Link>
            </Button>
          }
        />

        <ArkivSyncBanner />

        {(docsVencidos > 0 || docsPorVencer > 0) && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[oklch(0.936_0.071_27.4)] border border-[oklch(0.577_0.245_27.325)]/30">
            <Bell size={18} className="text-[oklch(0.354_0.14_27.4)] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[oklch(0.354_0.14_27.4)]">Documentos requieren atención</p>
              <p className="text-xs text-[oklch(0.354_0.14_27.4)]/80 mt-0.5">
                {docsVencidos > 0 && `${docsVencidos} vencido${docsVencidos > 1 ? 's' : ''}`}
                {docsVencidos > 0 && docsPorVencer > 0 && ' · '}
                {docsPorVencer > 0 && `${docsPorVencer} por vencer`}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/expirations">Ver</Link>
            </Button>
          </div>
        )}

        <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-3">
          <KpiCard label="Proveedores" value={vs.length} icon={Users} iconColor="indigo" />
          <KpiCard label="OK" value={statuses.ok} icon={ShieldCheck} iconColor="green" />
          <KpiCard label="Atención" value={statuses.atencion} icon={AlertTriangle} iconColor="amber" />
          <KpiCard label="Bloqueados" value={statuses.bloqueado} icon={XCircle} iconColor="red" />
        </section>

        {alertVendors.length > 0 && (
          <section aria-labelledby="alert-vendors-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="alert-vendors-heading" className="text-sm font-semibold text-foreground">
                Requieren atención
              </h2>
              <Link href="/vendors?status=atencion" className="text-xs text-primary font-medium flex items-center gap-0.5">
                Ver todos <ChevronRight size={13} aria-hidden="true" />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {alertVendors.slice(0, 3).map(v => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="upcoming-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="upcoming-heading" className="text-sm font-semibold text-foreground">
              Próximos vencimientos
            </h2>
            <Link href="/expirations" className="text-xs text-primary font-medium flex items-center gap-0.5">
              Ver todos <ChevronRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Todo vigente.</p>
          ) : (
            <ul role="list" className="bg-card border border-border rounded-xl divide-y divide-border">
              {upcoming.map(d => {
                const vendorName = vendorById.get(d.vendorId)?.name ?? d.vendorName ?? 'Proveedor';
                return (
                  <li key={d.documentId}>
                    <Link
                      href={`/vendors/${d.vendorId}`}
                      className="flex items-center gap-3 p-4 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.documentName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {vendorName} · vence {d.expiresAt}
                        </p>
                      </div>
                      <StatusBadge status={d.status} size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
