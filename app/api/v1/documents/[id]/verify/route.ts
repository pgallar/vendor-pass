import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { verifyDocumentInArkiv } from '@/lib/api-keys/data';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const result = await verifyDocumentInArkiv(auth.supabase, auth.userId, id);
    if (!result) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
