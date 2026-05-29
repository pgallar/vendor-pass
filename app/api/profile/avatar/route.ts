import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { uploadEvidence } from '@/lib/storage/s3';
import { validateAvatarFile } from '@/lib/profile/validation';

export async function POST(req: Request) {
  if (!process.env.S3_ENDPOINT) {
    return NextResponse.json({ error: 'Almacenamiento S3 no configurado' }, { status: 503 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  const fileError = validateAvatarFile({ type: file.type, size: file.size });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `avatars/${auth.user.id}/${randomUUID()}.${ext}`;

  try {
    const { url } = await uploadEvidence(buffer, file.type, key);
    const { data, error } = await auth.supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('avatar_url')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ avatar_url: data.avatar_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error subiendo imagen';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
