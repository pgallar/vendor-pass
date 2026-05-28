import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import type { VendorDocument } from '@/lib/types';

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
    })
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('name,owner_email,owner_name')
    .eq('id', doc.vendor_id)
    .single();
  const typed = doc as VendorDocument;
  await getStore().upsert(documentToValidationEntity(typed, vendor));

  return NextResponse.json({ document: doc }, { status: 201 });
}
