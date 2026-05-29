import { NextResponse } from 'next/server';
import { buildAuthPassportPdfUrl } from '@/lib/passport/verify-url';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(buildAuthPassportPdfUrl(id), 308);
}
