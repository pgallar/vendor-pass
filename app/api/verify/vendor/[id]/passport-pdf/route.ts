import { NextResponse } from 'next/server';
import { passportPdfResponse } from '@/lib/passport/pdf-response';
import { renderVendorPassportPdfBuffer } from '@/lib/passport/render-vendor-passport-pdf';
import { buildPublicPassportPdfUrl } from '@/lib/passport/verify-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PDF público del pasaporte. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await renderVendorPassportPdfBuffer(id, {
    pdfDownloadUrl: buildPublicPassportPdfUrl(id),
  });

  if (!result) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  return passportPdfResponse(result.pdf, result.vendorName);
}
