import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { isAllowedMime, MAX_BYTES, uploadEvidence } from '@/lib/storage/s3';

export async function POST(req: Request) {
  if (!process.env.S3_ENDPOINT) {
    return NextResponse.json({ error: 'Almacenamiento S3 no configurado' }, { status: 503 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file');
  const vendorId = form.get('vendorId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }
  if (typeof vendorId !== 'string' || !vendorId.trim()) {
    return NextResponse.json({ error: 'vendorId requerido' }, { status: 400 });
  }

  const { data: vendor, error: vendorErr } = await auth.supabase
    .from('vendors')
    .select('id')
    .eq('id', vendorId)
    .single();
  if (vendorErr || !vendor) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `evidence/${vendorId}/${randomUUID()}-${safeName}`;

  try {
    const { url } = await uploadEvidence(buffer, file.type, key);
    return NextResponse.json({ fileUrl: url, fileHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error subiendo archivo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
