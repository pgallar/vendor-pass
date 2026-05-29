import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { documentStatus, vendorStatus, vendorComplianceReasons } from '@/lib/status';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { DocumentList } from '@/components/vendor-pass/document-list';
import { VendorComplianceSummary } from '@/components/vendor-pass/vendor-compliance-summary';
import { Button } from '@/components/vendor-pass/button';
import type { Vendor, VendorDocument } from '@/lib/types';
import {
  SharePassportLink,
  CopyPassportUrlButton,
  DownloadPassportPdfButton,
} from '@/components/vendor-pass/share-passport-link';
import {
  authPassportPdfPath,
  buildAuthPassportPdfUrl,
  buildVerifyPageUrl,
} from '@/lib/passport/verify-url';
import { passportPdfFilename } from '@/lib/passport/pdf-filename';
import { generateQrDataUrl } from '@/lib/passport/qr';
import { Building2, Mail, User, MapPin, Calendar, Plus, Pencil, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: vendor } = await sb.from('vendors').select('*').eq('id', id).single();
  if (!vendor) notFound();

  const { data: documents } = await sb.from('documents').select('*').eq('vendor_id', id).order('expires_at');
  const ds: VendorDocument[] = documents ?? [];
  const v = vendor as Vendor;
  const status = vendorStatus(ds);
  const reasons = vendorComplianceReasons(ds);
  const enriched = ds.map(d => ({ ...d, status: documentStatus(d) }));
  const vencidos = enriched.filter(d => d.status === 'vencido').length;
  const porVencer = enriched.filter(d => d.status === 'por_vencer').length;
  const pageUrl = buildVerifyPageUrl(v.id);
  const pdfUrl = buildAuthPassportPdfUrl(v.id);
  const qrDataUrl = await generateQrDataUrl(pdfUrl);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={v.name}
          backHref="/vendors"
          backLabel="Volver a proveedores"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: v.name },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <CopyPassportUrlButton url={pdfUrl} />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/verify/vendor/${v.id}`} className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} aria-hidden="true" />
                  Pasaporte
                </Link>
              </Button>
              <DownloadPassportPdfButton
                href={authPassportPdfPath(v.id)}
                filename={passportPdfFilename(v.name)}
                compact
              />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vendors/${v.id}/edit`} className="inline-flex items-center gap-1.5">
                  <Pencil size={13} aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            </div>
          }
        />

        <SharePassportLink
          pdfUrl={pdfUrl}
          pdfDownloadPath={authPassportPdfPath(v.id)}
          qrDataUrl={qrDataUrl}
          pageUrl={pageUrl}
          vendorName={v.name}
          pdfFilename={passportPdfFilename(v.name)}
          inputId={`passport-pdf-url-${v.id}`}
        />

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center shrink-0" aria-hidden="true">
              <span className="text-base font-bold text-brand-muted-foreground">
                {v.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado de cumplimiento</p>
              <div className="mt-1">
                <StatusBadge status={status} size="md" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground tabular-nums">{ds.length}</p>
            <p className="text-xs text-muted-foreground">documentos</p>
          </div>
        </div>

        <VendorComplianceSummary status={status} reasons={reasons} />

        {(vencidos > 0 || porVencer > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {vencidos > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[oklch(0.936_0.071_27.4)] text-[oklch(0.354_0.14_27.4)]">
                {vencidos} vencido{vencidos > 1 ? 's' : ''}
              </span>
            )}
            {porVencer > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[oklch(0.973_0.077_70.5)] text-[oklch(0.375_0.105_70.5)]">
                {porVencer} por vencer
              </span>
            )}
          </div>
        )}

        <section aria-labelledby="info-heading" className="bg-card border border-border rounded-xl p-4">
          <h2 id="info-heading" className="text-sm font-semibold text-foreground mb-2">
            Información del proveedor
          </h2>
          <InfoRow icon={Building2} label="Categoría" value={v.category ?? '—'} />
          <InfoRow icon={User} label="Owner interno" value={v.owner_name ?? '—'} />
          {v.owner_email && <InfoRow icon={Mail} label="Email del owner" value={v.owner_email} />}
          <InfoRow icon={MapPin} label="Área / sitio" value={v.area ?? '—'} />
          <InfoRow
            icon={Calendar}
            label="Alta en sistema"
            value={new Date(v.created_at).toLocaleDateString('es-MX', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          />
          {v.notes && (
            <div className="pt-2.5 mt-1 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p className="text-sm text-foreground">{v.notes}</p>
            </div>
          )}
        </section>

        <section aria-labelledby="docs-heading" className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 id="docs-heading" className="text-sm font-semibold text-foreground">
              Documentos ({ds.length})
            </h2>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/vendors/${v.id}/documents/new`} className="inline-flex items-center gap-1.5">
                <Plus size={13} aria-hidden="true" />
                Agregar
              </Link>
            </Button>
          </div>
          <DocumentList documents={enriched} vendorId={v.id} showAddCta={enriched.length === 0} />
        </section>
      </div>
    </AppShell>
  );
}
