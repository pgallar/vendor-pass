import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const result = await auditArkivParity({ userId: auth.userId });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
