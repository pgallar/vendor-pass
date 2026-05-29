import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import {
  buildPublicPassportPdfUrl,
  buildVerifyPageUrl,
  publicPassportPdfPath,
} from '@/lib/passport/verify-url';
import { passportPdfFilename } from '@/lib/passport/pdf-filename';
import { generateQrDataUrl } from '@/lib/passport/qr';
import { getStoreSource } from '@/lib/arkiv/validations';
import { PublicShell } from '@/components/vendor-pass/public-shell';
import { VendorPassportView } from '@/components/vendor-pass/vendor-passport-view';
import { SharePassportLink } from '@/components/vendor-pass/share-passport-link';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pasaporte del proveedor — VendorPass',
  robots: { index: false, follow: false },
};

export default async function VerifyVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  const passport = await buildVendorPassport(vendorId);
  const storeSource = getStoreSource();

  if (!passport) notFound();

  const pageUrl = buildVerifyPageUrl(vendorId);
  const pdfUrl = buildPublicPassportPdfUrl(vendorId);
  const qrDataUrl = await generateQrDataUrl(pdfUrl);

  return (
    <PublicShell maxWidth="max-w-3xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pasaporte del proveedor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de cumplimiento documental verificable
          </p>
        </div>

        <SharePassportLink
          pdfUrl={pdfUrl}
          pdfDownloadPath={publicPassportPdfPath(vendorId)}
          qrDataUrl={qrDataUrl}
          pageUrl={pageUrl}
          vendorName={passport.vendor.name}
          pdfFilename={passportPdfFilename(passport.vendor.name)}
          inputId={`passport-pdf-url-${vendorId}`}
        />

        {passport.resolvedFrom === 'postgres' && storeSource === 'memory' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Datos desde la base de aplicación. Ejecuta sincronización Arkiv para registro verificable en red.
            </p>
          </div>
        )}

        {storeSource === 'memory' && passport.resolvedFrom === 'store' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Modo desarrollo: datos en memoria local. Configura{' '}
              <code className="text-xs">ARKIV_RPC_URL</code> y{' '}
              <code className="text-xs">ARKIV_PRIVATE_KEY</code> para verificación en red Arkiv.
            </p>
          </div>
        )}

        <VendorPassportView passport={passport} />
      </div>
    </PublicShell>
  );
}
