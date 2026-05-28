import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStore, getStoreSource } from '@/lib/arkiv/validations';
import { PublicShell } from '@/components/vendor-pass/public-shell';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { ShieldCheck, Calendar, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default async function VerifyVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  const store = getStore();
  const entities = await store.listByVendor(vendorId);
  const source = getStoreSource();

  if (entities.length === 0) notFound();

  const vendorName = entities[0]?.vendorName ?? 'Proveedor';
  const hasExpired = entities.some(e => e.status === 'vencido');
  const hasExpiring = entities.some(e => e.status === 'por_vencer');
  const passportStatus = hasExpired ? 'bloqueado' : hasExpiring ? 'atencion' : 'ok';

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pasaporte de cumplimiento</h1>
          <p className="text-sm text-muted-foreground mt-1">{vendorName}</p>
        </div>

        {source === 'memory' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Modo desarrollo: datos en memoria local.
            </p>
          </div>
        )}

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold">Estado general</span>
            </div>
            <StatusBadge status={passportStatus} size="md" />
          </div>
          <p className="text-xs text-muted-foreground">
            {entities.length} documento{entities.length !== 1 ? 's' : ''} registrado{entities.length !== 1 ? 's' : ''} en Arkiv
          </p>
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Documentos</h2>
          <ul role="list" className="flex flex-col">
            {entities.map(e => (
              <li key={e.documentId} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.documentName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar size={11} aria-hidden="true" />
                    Vence {formatDate(e.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={e.status} size="sm" />
                  <Link
                    href={`/verify/${e.documentId}`}
                    className="text-xs text-primary font-medium min-h-11 inline-flex items-center px-2"
                  >
                    Verificar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
