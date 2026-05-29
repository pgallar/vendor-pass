import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import { buildPublicPassportPdfUrl } from '@/lib/passport/verify-url';
import { generateQrDataUrl } from '@/lib/passport/qr';
import { renderPassportPdf } from '@/lib/passport/render-pdf';

export async function renderVendorPassportPdfBuffer(
  vendorId: string,
  options: { organization?: string | null; pdfDownloadUrl?: string } = {},
): Promise<{ pdf: Buffer; vendorName: string } | null> {
  const passport = await buildVendorPassport(vendorId);
  if (!passport) return null;

  const pdfDownloadUrl = options.pdfDownloadUrl ?? buildPublicPassportPdfUrl(vendorId);
  const qrDataUrl = await generateQrDataUrl(pdfDownloadUrl);
  const pdf = await renderPassportPdf({
    passport,
    qrDataUrl,
    pdfDownloadUrl,
    organization: options.organization ?? null,
  });

  return { pdf, vendorName: passport.vendor.name };
}
