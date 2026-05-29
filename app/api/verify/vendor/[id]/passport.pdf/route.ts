import { NextResponse } from 'next/server';
import { buildPublicPassportPdfUrl } from '@/lib/passport/verify-url';

/** Redirige la ruta antigua (`.pdf` en el path rompe descargas en Next). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(buildPublicPassportPdfUrl(id), 308);
}
