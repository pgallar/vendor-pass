import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data: vendor, error: vErr } = await auth.supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 404 });
  const { data: documents, error: dErr } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
  return NextResponse.json({ vendor, documents });
}
