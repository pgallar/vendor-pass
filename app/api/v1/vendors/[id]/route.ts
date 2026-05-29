import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { getVendorDetail } from '@/lib/api-keys/data';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const detail = await getVendorDetail(auth.supabase, auth.userId, id);
    if (!detail) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
