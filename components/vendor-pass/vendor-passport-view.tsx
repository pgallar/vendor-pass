import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { VendorComplianceSummary } from '@/components/vendor-pass/vendor-compliance-summary';
import { PassportDocumentRow } from '@/components/vendor-pass/passport-document-row';
import type { VendorPassportData } from '@/lib/passport/build-vendor-passport';
import { Building2, ShieldCheck } from 'lucide-react';

export function VendorPassportView({ passport }: { passport: VendorPassportData }) {
  const { vendor, status, reasons, documents } = passport;
  const vigentes = documents.filter(d => d.status === 'vigente').length;
  const porVencer = documents.filter(d => d.status === 'por_vencer').length;
  const vencidos = documents.filter(d => d.status === 'vencido').length;
  const pendientes = documents.filter(d => d.lifecycle !== 'anchored').length;

  return (
    <>
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

        {pendientes > 0 && (
          <p className="text-xs text-muted-foreground">
            {pendientes} documento{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de anclaje en red.
          </p>
        )}

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
              <PassportDocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
