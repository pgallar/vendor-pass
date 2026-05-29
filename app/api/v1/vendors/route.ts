import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { listVendors } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const vendors = await listVendors(auth.supabase, auth.userId);
    return NextResponse.json({ vendors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
