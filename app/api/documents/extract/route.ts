import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { isAllowedMime, MAX_BYTES } from '@/lib/storage/s3';
import { isAiConfigured } from '@/lib/ai/client';
import { extractDocumentFields } from '@/lib/ai/extract';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Extracción por IA no configurada' }, { status: 503 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractDocumentFields(buffer, file.type);
    return NextResponse.json({ extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error extrayendo datos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
