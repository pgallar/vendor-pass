import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { passportPdfResponse } from '@/lib/passport/pdf-response';
import { renderVendorPassportPdfBuffer } from '@/lib/passport/render-vendor-passport-pdf';
import { buildAuthPassportPdfUrl } from '@/lib/passport/verify-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data: owned } = await auth.supabase.from('vendors').select('id').eq('id', id).maybeSingle();
  if (!owned) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  let organization: string | null = null;
  try {
    const { data: profile } = await auth.supabase
      .from('profiles')
      .select('organization')
      .eq('id', auth.user.id)
      .maybeSingle();
    organization = (profile as { organization?: string | null } | null)?.organization ?? null;
  } catch {
    organization = null;
  }

  const result = await renderVendorPassportPdfBuffer(id, {
    organization,
    pdfDownloadUrl: buildAuthPassportPdfUrl(id),
  });

  if (!result) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  return passportPdfResponse(result.pdf, result.vendorName);
}
