import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { listDocuments } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const vendorId = new URL(req.url).searchParams.get('vendor_id') ?? undefined;
  try {
    const documents = await listDocuments(auth.supabase, auth.userId, vendorId);
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
