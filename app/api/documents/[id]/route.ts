import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import type { VendorDocument } from '@/lib/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .update({
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const typed = doc as VendorDocument;
  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('name,owner_email,owner_name')
    .eq('id', typed.vendor_id)
    .single();
  await getStore().upsert(documentToValidationEntity(typed, vendor));

  return NextResponse.json({ document: doc });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { error } = await auth.supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await getStore().remove(id);
  return NextResponse.json({ ok: true });
}
