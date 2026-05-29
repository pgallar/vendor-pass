import { NextResponse } from 'next/server';
import { listPublicEvents } from '@/lib/events/public';
import { getStoreSource } from '@/lib/arkiv/validations';

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  try {
    const events = await listPublicEvents(documentId);
    return NextResponse.json({ source: getStoreSource(), events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
