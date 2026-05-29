import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { documentStatus, vendorStatus, vendorComplianceReasons } from '@/lib/status';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { DocumentList } from '@/components/vendor-pass/document-list';
import { VendorComplianceSummary } from '@/components/vendor-pass/vendor-compliance-summary';
import { VendorInfoSection } from '@/components/vendor-pass/vendor-info-section';
import {
  VendorDetailTabBar,
  isVendorDetailTab,
  type VendorDetailTab,
} from '@/components/vendor-pass/vendor-detail-tab-bar';
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
import { InviteVendor } from '@/components/vendor-pass/invite-vendor';
import { PendingReviewsBadge } from '@/components/vendor-pass/pending-reviews-badge';
import { passportPdfFilename } from '@/lib/passport/pdf-filename';
import { generateQrDataUrl } from '@/lib/passport/qr';
import { Plus, Pencil, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const activeTab: VendorDetailTab = isVendorDetailTab(tabParam) ? tabParam : 'resumen';

  const sb = await createClient();
  const { data: vendor } = await sb.from('vendors').select('*').eq('id', id).single();
  if (!vendor) notFound();

  const { data: documents } = await sb.from('documents').select('*').eq('vendor_id', id).order('expires_at');
  const { count: pendingCount } = await sb
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', id)
    .eq('review_status', 'submitted');
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

        <VendorDetailTabBar
          vendorId={id}
          activeTab={activeTab}
          documentCount={ds.length}
          status={status}
          pendingCount={pendingCount ?? 0}
        />

        {activeTab === 'resumen' && (
          <div
            role="tabpanel"
            id="vendor-panel-resumen"
            aria-labelledby="vendor-tab-resumen"
            className="flex flex-col gap-6"
          >
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

            <VendorInfoSection vendor={v} />
          </div>
        )}

        {activeTab === 'documentos' && (
          <section
            role="tabpanel"
            id="vendor-panel-documentos"
            aria-labelledby="vendor-tab-documentos"
            className="bg-card border border-border rounded-xl p-4"
          >
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
        )}

        {activeTab === 'pasaporte' && (
          <div
            role="tabpanel"
            id="vendor-panel-pasaporte"
            aria-labelledby="vendor-tab-pasaporte"
          >
            <SharePassportLink
              pdfUrl={pdfUrl}
              pdfDownloadPath={authPassportPdfPath(v.id)}
              qrDataUrl={qrDataUrl}
              pageUrl={pageUrl}
              vendorName={v.name}
              pdfFilename={passportPdfFilename(v.name)}
              inputId={`passport-pdf-url-${v.id}`}
            />
          </div>
        )}

        {activeTab === 'portal' && (
          <div
            role="tabpanel"
            id="vendor-panel-portal"
            aria-labelledby="vendor-tab-portal"
            className="flex flex-col gap-6"
          >
            <div className="flex items-center gap-3">
              <Link href={`/vendors/${id}/reviews`} className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                Revisiones del portal
                <PendingReviewsBadge count={pendingCount ?? 0} />
              </Link>
            </div>

            <section className="bg-card border border-border rounded-xl p-4">
              <InviteVendor vendorId={id} />
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
