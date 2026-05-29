import { NextResponse } from 'next/server';
import { resolveValidationLookup } from '@/lib/arkiv/lookup';
import { getStoreSource } from '@/lib/arkiv/validations';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const lookup = await resolveValidationLookup(documentId);

  if (!lookup) {
    return NextResponse.json({
      found: false,
      source: getStoreSource(),
    });
  }

  return NextResponse.json({
    found: true,
    source: getStoreSource(),
    resolvedFrom: lookup.resolvedFrom,
    entityKey: lookup.entityKey,
    validation: lookup.entity,
  });
}
