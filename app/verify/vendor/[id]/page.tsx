import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveVendorPassport } from '@/lib/arkiv/vendor-lookup';
import { getStoreSource } from '@/lib/arkiv/validations';
import { PublicShell } from '@/components/vendor-pass/public-shell';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { VendorComplianceSummary } from '@/components/vendor-pass/vendor-compliance-summary';
import { CopyVerifyLink } from '@/components/vendor-pass/copy-verify-link';
import { Building2, ShieldCheck, AlertCircle, FileText, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pasaporte del proveedor — VendorPass',
  robots: { index: false, follow: false },
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

export default async function VerifyVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  const passport = await resolveVendorPassport(vendorId);
  const storeSource = getStoreSource();

  if (!passport) notFound();

  const { vendor, status, reasons, documents, resolvedFrom } = passport;
  const vigentes = documents.filter(d => d.status === 'vigente').length;
  const porVencer = documents.filter(d => d.status === 'por_vencer').length;
  const vencidos = documents.filter(d => d.status === 'vencido').length;

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pasaporte del proveedor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de cumplimiento documental verificable
          </p>
        </div>

        {resolvedFrom === 'postgres' && storeSource === 'memory' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Datos desde la base de aplicación. Ejecuta sincronización Arkiv para registro verificable en red.
            </p>
          </div>
        )}

        {storeSource === 'memory' && resolvedFrom === 'store' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Modo desarrollo: datos en memoria local. Configura{' '}
              <code className="text-xs">ARKIV_RPC_URL</code> y{' '}
              <code className="text-xs">ARKIV_PRIVATE_KEY</code> para verificación en red Arkiv.
            </p>
          </div>
        )}

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={16} className="text-primary shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground truncate">{vendor.name}</h2>
              </div>
              {(vendor.category || vendor.area) && (
                <p className="text-xs text-muted-foreground">
                  {[vendor.category, vendor.area].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <StatusBadge status={status} size="md" />
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Vigentes</dt>
              <dd className="font-medium mt-0.5">{vigentes}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Por vencer</dt>
              <dd className="font-medium mt-0.5">{porVencer}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vencidos</dt>
              <dd className="font-medium mt-0.5">{vencidos}</dd>
            </div>
          </dl>

          <CopyVerifyLink path={`/verify/vendor/${vendorId}`} />

          <VendorComplianceSummary status={status} reasons={reasons} />
        </section>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Documentos</h2>
          </div>
          {documents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Sin documentos registrados.</p>
          ) : (
            <ul role="list">
              {documents.map(doc => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center" aria-hidden="true">
                    <FileText size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span>{doc.document_type}</span>
                      <span aria-hidden="true">·</span>
                      <Calendar size={11} aria-hidden="true" />
                      <span>{formatDate(doc.expires_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/verify/${doc.id}`}
                      className="text-xs text-primary font-medium min-h-11 inline-flex items-center px-2"
                    >
                      Verificar
                    </Link>
                    <StatusBadge status={doc.status} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
