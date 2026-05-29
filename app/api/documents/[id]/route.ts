import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { immutableFieldsChanged } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();

  // Estado actual (RLS scopea al dueño).
  const { data: current, error: readErr } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (readErr || !current) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  const currentDoc = current as VendorDocument;

  // Si está anclado, los campos inmutables no pueden cambiar → 409 (la renovación es Feature 4).
  if (currentDoc.lifecycle_status === 'anchored') {
    const changed = immutableFieldsChanged(currentDoc, {
      document_type: body.document_type,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      file_hash: body.file_hash ?? null,
    });
    if (changed.length > 0) {
      return NextResponse.json(
        {
          error: `El documento está anclado en Arkiv: no se pueden modificar ${changed.join(', ')}. Solicitá una renovación.`,
          immutableFields: changed,
        },
        { status: 409 },
      );
    }
  }

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

  // Solo re-sincronizamos Arkiv si el documento ya estaba anclado (mantener la entidad al día).
  // Los borradores NO se escriben en Arkiv hasta el anclaje explícito.
  if (typed.lifecycle_status === 'anchored') {
    const { data: vendor } = await auth.supabase
      .from('vendors')
      .select('name,owner_email,owner_name')
      .eq('id', typed.vendor_id)
      .single();
    await getStore().upsert(documentToValidationEntity(typed, vendor));
  }

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
