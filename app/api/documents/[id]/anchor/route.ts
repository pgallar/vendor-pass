import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { anchorDocument } from '@/lib/arkiv/anchor';
import { canAnchor } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  // RLS scopea el documento al dueño.
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const typed = doc as VendorDocument;
  const check = canAnchor(typed);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });

  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('user_id,name,owner_email,owner_name')
    .eq('id', typed.vendor_id)
    .single();
  if (!vendor || vendor.user_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Solo el responsable del proveedor puede anclar documentos' },
      { status: 403 },
    );
  }

  try {
    const result = await anchorDocument(auth.supabase, typed, vendor, auth.user.id);
    return NextResponse.json({
      document: result.document,
      arkiv_entity_key: result.arkivEntityKey,
      anchored_at: result.anchoredAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al anclar en Arkiv' },
      { status: 500 },
    );
  }
}
