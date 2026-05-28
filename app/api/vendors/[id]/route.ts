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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('vendors')
    .update({
      name: body.name.trim(),
      category: body.category?.trim() || null,
      owner_name: body.owner_name?.trim() || null,
      owner_email: body.owner_email?.trim() || null,
      area: body.area?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vendor: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data: docs } = await auth.supabase.from('documents').select('id').eq('vendor_id', id);
  const { error } = await auth.supabase.from('vendors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { getStore } = await import('@/lib/arkiv/validations');
  const store = getStore();
  for (const doc of docs ?? []) {
    await store.remove(doc.id);
  }

  return NextResponse.json({ ok: true });
}
