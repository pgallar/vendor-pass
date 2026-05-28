import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore, getStoreSource } from '@/lib/arkiv/validations';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { ShieldCheck, Calendar, Hash, Key, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificación — VendorPass',
  robots: { index: false, follow: false },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="text-xs font-mono bg-secondary px-2 py-1.5 rounded-md break-all">{value}</code>
    </div>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const lookup = await getStore().getByDocumentId(documentId);
  const source = getStoreSource();

  if (!lookup) notFound();

  const { entity, entityKey } = lookup;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        <PageHeader
          title="Verificación Arkiv"
          description="Estado de cumplimiento consultado desde el registro verificable"
          backHref={`/vendors/${entity.vendorId}`}
          backLabel="Volver al proveedor"
        />

        {source === 'memory' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Modo desarrollo: datos en memoria local. Configura <code className="text-xs">ARKIV_RPC_URL</code> y{' '}
              <code className="text-xs">ARKIV_PRIVATE_KEY</code> para verificación en red Arkiv.
            </p>
          </div>
        )}

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-primary shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground truncate">{entity.documentName}</h2>
              </div>
              {entity.vendorName && (
                <p className="text-xs text-muted-foreground">{entity.vendorName}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{entity.documentType}</p>
            </div>
            <StatusBadge status={entity.status} size="md" />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" /> Emisión
              </dt>
              <dd className="font-medium mt-0.5">{formatDate(entity.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" /> Vencimiento
              </dt>
              <dd className="font-medium mt-0.5">{formatDate(entity.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Criticidad</dt>
              <dd className="font-medium mt-0.5">{entity.criticality === 'critical' ? 'Crítico' : 'Normal'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fuente</dt>
              <dd className="font-medium mt-0.5 capitalize">{source === 'arkiv' ? 'Arkiv Network' : 'Memoria local'}</dd>
            </div>
          </dl>

          {entity.syncedAt && (
            <p className="text-xs text-muted-foreground">
              Última sincronización: {new Date(entity.syncedAt).toLocaleString('es-MX')}
            </p>
          )}

          {entityKey && (
            <CopyField label="Entity key (Arkiv)" value={entityKey} />
          )}

          {entity.fileHash && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash size={11} aria-hidden="true" /> Hash SHA-256 del archivo
              </span>
              <code className="text-xs font-mono bg-secondary px-2 py-1.5 rounded-md break-all">{entity.fileHash}</code>
              <p className="text-[11px] text-muted-foreground">
                Integridad del archivo certificada al momento del registro.
              </p>
            </div>
          )}

          {entity.fileUrl && (
            <Link
              href={entity.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary font-medium inline-flex items-center gap-1"
            >
              <Key size={12} aria-hidden="true" />
              Ver evidencia
            </Link>
          )}
        </section>
      </div>
    </AppShell>
  );
}
