import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: prev, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !prev) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const prevDoc = prev as VendorDocument;
  if (prevDoc.lifecycle_status !== 'anchored') {
    return NextResponse.json({ error: 'Solo se puede renovar un documento anclado' }, { status: 400 });
  }
  if (prevDoc.superseded_by_document_id) {
    return NextResponse.json({ error: 'Este documento ya fue renovado' }, { status: 400 });
  }
  if (documentStatus(prevDoc) === 'vigente') {
    return NextResponse.json({ error: 'El documento aún está vigente' }, { status: 400 });
  }

  const { data: draft, error: insErr } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: prevDoc.vendor_id,
      document_type: prevDoc.document_type,
      document_name: prevDoc.document_name,
      issued_at: body.issued_at ?? prevDoc.issued_at,
      expires_at: body.expires_at ?? prevDoc.expires_at,
      criticality: prevDoc.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? prevDoc.notes,
      lifecycle_status: 'draft',
      supersedes_document_id: prevDoc.id,
    })
    .select()
    .single();
  if (insErr || !draft) {
    return NextResponse.json({ error: insErr?.message ?? 'No se pudo crear la renovación' }, { status: 400 });
  }

  return NextResponse.json({ document: draft }, { status: 201 });
}
