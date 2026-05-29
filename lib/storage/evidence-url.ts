/** URL pública de evidencia vía la app (evita cookies de localhost en MinIO). */
export function evidencePublicUrl(key: string): string {
  const base = appBaseUrl();
  const segments = key.split('/').map(segment => encodeURIComponent(segment));
  return `${base}/api/files/${segments.join('/')}`;
}

/** Convierte URLs directas a MinIO en rutas proxy; deja URLs externas intactas. */
export function normalizeEvidenceUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const base = appBaseUrl();
  if (url.startsWith('/api/files/')) {
    return `${base}${url}`;
  }
  if (url.startsWith(`${base}/api/files/`)) {
    return url;
  }

  const bucket = process.env.S3_BUCKET ?? 'vendor-pass-evidence';
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(new RegExp(`/${bucket}/(.+)$`));
    if (pathMatch?.[1]) {
      return evidencePublicUrl(decodeURIComponent(pathMatch[1]));
    }
  } catch {
    // URL relativa o inválida: devolver tal cual
  }

  return url;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}
