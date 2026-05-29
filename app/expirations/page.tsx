import Link from 'next/link';
import { getStore } from '@/lib/arkiv/validations';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { EmptyState } from '@/components/vendor-pass/empty-state';
import { ExportExpirationsButton } from '@/components/vendor-pass/export-expirations-button';
import { CalendarClock, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ExpirationRow = {
  vendorId: string;
  documentId: string;
  documentName: string;
  documentType: string;
  expiresAt: string;
  status: 'vigente' | 'por_vencer' | 'vencido';
  criticality: 'critical' | 'normal';
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getDaysLabel(expiresAt: string): string {
  const diff = Math.ceil((new Date(expiresAt + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return `venció hace ${Math.abs(diff)} días`;
  if (diff === 0) return 'vence hoy';
  return `${diff} días restantes`;
}

function ExpiryRow({ row, vendorName }: { row: ExpirationRow; vendorName: string }) {
  return (
    <Link
      href={`/vendors/${row.vendorId}`}
      className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-secondary/40 -mx-4 px-4 transition-colors"
    >
      <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-muted flex items-center justify-center" aria-hidden="true">
        <span className="text-xs font-bold text-brand-muted-foreground">
          {vendorName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{row.documentName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{vendorName}</span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
          <span className={cn(
            'flex items-center gap-1 text-xs',
            row.status === 'vencido' && 'text-[oklch(0.354_0.14_27.4)]',
            row.status === 'por_vencer' && 'text-[oklch(0.375_0.105_70.5)]',
          )}>
            <Calendar size={11} aria-hidden="true" />
            {formatDate(row.expiresAt)} ({getDaysLabel(row.expiresAt)})
          </span>
          {row.criticality === 'critical' && (
            <span className="text-[10px] font-medium text-muted-foreground">Crítico</span>
          )}
        </div>
      </div>
      <StatusBadge status={row.status} size="sm" />
      <ChevronRight size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
    </Link>
  );
}

function ExpirySection({
  title,
  rows,
  vendorNames,
}: {
  title: string;
  rows: ExpirationRow[];
  vendorNames: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
        <p className="text-sm text-muted-foreground">Sin registros.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby={title.replace(/\s/g, '-')}>
      <h2 id={title.replace(/\s/g, '-')} className="text-sm font-semibold text-foreground mb-3">
        {title} ({rows.length})
      </h2>
      <div className="bg-card border border-border rounded-xl p-4">
        {rows.map(r => (
          <ExpiryRow key={r.documentId} row={r} vendorName={vendorNames.get(r.vendorId) ?? 'Proveedor'} />
        ))}
      </div>
    </section>
  );
}

export default async function ExpirationsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { window: winParam } = await searchParams;
  const win = winParam ?? '30';
  const store = getStore();
  const sb = await createClient();

  const [expired, soon, { data: vendors }] = await Promise.all([
    store.listExpired(),
    store.listExpiringSoon(Number(win)),
    sb.from('vendors').select('id, name'),
  ]);

  const vendorNames = new Map((vendors ?? []).map(v => [v.id, v.name as string]));

  // Filtramos la data de Arkiv (pública) cruzándola con los vendors del usuario
  const myExpired = expired.filter(doc => vendorNames.has(doc.vendorId));
  const mySoon = soon.filter(doc => vendorNames.has(doc.vendorId));

  const windowLinks = [
    { label: '7 días', value: '7' },
    { label: '30 días', value: '30' },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Vencimientos"
          description="Documentos vencidos y por vencer"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <ExportExpirationsButton windowDays={win} />
              <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
                {windowLinks.map(w => (
                  <Link
                    key={w.value}
                    href={`/expirations?window=${w.value}`}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors min-h-11 inline-flex items-center',
                      win === w.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {w.label}
                  </Link>
                ))}
              </div>
            </div>
          }
        />

        {myExpired.length === 0 && mySoon.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Todo al día"
            description="No hay documentos vencidos ni por vencer en la ventana seleccionada."
          />
        ) : (
          <>
            <ExpirySection title="Vencidos" rows={myExpired} vendorNames={vendorNames} />
            <ExpirySection title={`Por vencer (${win} días)`} rows={mySoon} vendorNames={vendorNames} />
          </>
        )}
      </div>
    </AppShell>
  );
}
