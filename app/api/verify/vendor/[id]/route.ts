import { NextResponse } from 'next/server';
import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import { getStoreSource } from '@/lib/arkiv/validations';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = await buildVendorPassport(id);

  if (!passport) {
    return NextResponse.json({ found: false, source: getStoreSource() }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    source: getStoreSource(),
    passport,
  });
}
