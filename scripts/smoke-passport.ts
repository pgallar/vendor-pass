import { buildPublicPassportPdfUrl } from '../lib/passport/verify-url';
import { passportPdfFilename } from '../lib/passport/pdf-filename';
import { generateQrDataUrl } from '../lib/passport/qr';
import { assemblePassport } from '../lib/passport/build-vendor-passport';
import { renderPassportPdf } from '../lib/passport/render-pdf';
import type { VendorDocument } from '../lib/types';

async function main() {
  const vendorId = 'v-smoke';
  const url = buildPublicPassportPdfUrl(vendorId);
  if (!url.includes('/passport-pdf')) throw new Error(`bad url: ${url}`);
  const filename = passportPdfFilename('Smoke Co');
  if (!filename.startsWith('passport-') || !filename.endsWith('.pdf')) throw new Error(`bad filename: ${filename}`);

  const qr = await generateQrDataUrl(url);
  if (!qr.startsWith('data:image/png')) throw new Error('qr not png data url');

  const passport = assemblePassport({
    vendor: { id: vendorId, name: 'Smoke Co', category: 'Test', area: null },
    documents: [{
      id: 'd1',
      vendor_id: vendorId,
      document_name: 'Doc',
      document_type: 'Tipo',
      issued_at: '2026-01-01',
      expires_at: '2026-12-31',
      criticality: 'critical',
      file_url: null,
      file_hash: null,
      notes: null,
      created_at: '',
      updated_at: '',
    } as VendorDocument],
    arkivEntities: [],
    arkivAvailable: false,
  });

  const pdf = await renderPassportPdf({
    passport,
    qrDataUrl: qr,
    pdfDownloadUrl: url,
    organization: 'VendorPass Test',
  });
  if (pdf.length < 500) throw new Error(`pdf too small: ${pdf.length}`);

  console.log('smoke-passport OK', { url, qrBytes: qr.length, pdfBytes: pdf.length });
}

main().catch(err => {
  console.error('smoke-passport FAIL', err);
  process.exit(1);
});
