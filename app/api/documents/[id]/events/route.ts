import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from('document_events')
    .select('id, document_id, event_type, actor_user_id, payload, created_at')
    .eq('document_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}
