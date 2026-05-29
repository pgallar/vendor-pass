import { getEvidenceObject } from '@/lib/storage/s3';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!process.env.S3_ENDPOINT) {
    return new Response('Almacenamiento no configurado', { status: 503 });
  }

  const { path } = await params;
  const key = path.map(segment => decodeURIComponent(segment)).join('/');

  if (!key.startsWith('evidence/')) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getEvidenceObject(key);
    const bytes = await body.transformToByteArray();
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    });
    if (contentLength != null) {
      headers.set('Content-Length', String(contentLength));
    }
    return new Response(bytes, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
