import { NextResponse } from 'next/server';
import { getStore, getStoreSource } from '@/lib/arkiv/validations';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const lookup = await getStore().getByDocumentId(documentId);

  if (!lookup) {
    return NextResponse.json({
      found: false,
      source: getStoreSource(),
    });
  }

  return NextResponse.json({
    found: true,
    source: getStoreSource(),
    entityKey: lookup.entityKey,
    validation: lookup.entity,
  });
}
