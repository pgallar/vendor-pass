import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase.rpc('claim_legacy_vendors');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ claimed: data ?? 0 });
}
