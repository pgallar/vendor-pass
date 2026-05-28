import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const result = await auditArkivParity({ supabase: auth.supabase });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en auditoría';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
