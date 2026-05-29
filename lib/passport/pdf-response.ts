import { NextResponse } from 'next/server';
import { passportPdfFilename } from '@/lib/passport/pdf-filename';

export function passportPdfResponse(pdf: Buffer, vendorName: string): NextResponse {
  const filename = passportPdfFilename(vendorName);
  const encoded = encodeURIComponent(filename);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
