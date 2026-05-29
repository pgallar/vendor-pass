import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { anchorDocument } from '@/lib/arkiv/anchor';
import { recordDocumentEvent } from '@/lib/events/record';
import type { LifecycleStatus, VendorDocument } from '@/lib/types';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from('documents')
    .select('*')
    .order('expires_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json();

  // El alta crea un BORRADOR (o 'pending_anchor' si el cliente lo solicita).
  // El anclaje en Arkiv es una acción explícita posterior (POST /api/documents/[id]/anchor).
  const requested = body.lifecycle_status as LifecycleStatus | undefined;
  const lifecycle_status: LifecycleStatus =
    requested === 'pending_anchor' ? 'pending_anchor' : 'draft';

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: body.vendor_id,
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      lifecycle_status,
    })
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const typed = doc as VendorDocument;

  await recordDocumentEvent({
    documentId: typed.id,
    eventType: 'created',
    actorUserId: auth.user.id,
    payload: { document: typed },
    supabase: auth.supabase,
  });

  // Modo compatibilidad para demos: anclar al guardar. NO usar en producción.
  if (process.env.ANCHOR_ON_SAVE === 'true' && typed.file_hash) {
    const { data: vendor } = await auth.supabase
      .from('vendors')
      .select('name,owner_email,owner_name')
      .eq('id', typed.vendor_id)
      .single();
    try {
      const result = await anchorDocument(auth.supabase, typed, vendor, auth.user.id);
      return NextResponse.json({ document: result.document }, { status: 201 });
    } catch {
      // Si el anclaje automático falla, el documento igual queda creado como borrador.
      return NextResponse.json({ document: typed }, { status: 201 });
    }
  }

  return NextResponse.json({ document: typed }, { status: 201 });
}
