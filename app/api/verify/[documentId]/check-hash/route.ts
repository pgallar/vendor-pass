import { NextResponse } from 'next/server';
import { resolveValidationLookup } from '@/lib/arkiv/lookup';
import { getStoreSource } from '@/lib/arkiv/validations';
import { normalizeEvidenceUrl } from '@/lib/storage/evidence-url';
import { sha256Hex, normalizeHash, hashesMatch } from '@/lib/crypto/file-hash';
import { createRateLimiter } from '@/lib/crypto/rate-limit';
import { MAX_BYTES, isAllowedMime } from '@/lib/storage/s3';

export const dynamic = 'force-dynamic';

// 10 comprobaciones por IP cada 60s (estado por proceso).
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const DOWNLOAD_TIMEOUT_MS = 15_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function hashFromUpload(file: File): Promise<{ hash: string } | { error: NextResponse }> {
  if (file.size > MAX_BYTES) {
    return { error: NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 }) };
  }
  if (file.type && !isAllowedMime(file.type)) {
    return { error: NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 }) };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { hash: sha256Hex(buffer) };
}

async function hashFromUrl(fileUrl: string): Promise<{ hash: string } | { error: NextResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(fileUrl, { signal: controller.signal });
    if (!res.ok) {
      return { error: NextResponse.json({ error: 'No se pudo descargar la evidencia' }, { status: 502 }) };
    }
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length && length > MAX_BYTES) {
      return { error: NextResponse.json({ error: 'La evidencia excede el máximo de 10 MB' }, { status: 400 }) };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return { error: NextResponse.json({ error: 'La evidencia excede el máximo de 10 MB' }, { status: 400 }) };
    }
    return { hash: sha256Hex(buffer) };
  } catch {
    return { error: NextResponse.json({ error: 'Tiempo de espera agotado al descargar la evidencia' }, { status: 504 }) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const rate = limiter.check(clientIp(req));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas comprobaciones. Esperá unos segundos e intentá de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  const { documentId } = await params;
  const lookup = await resolveValidationLookup(documentId);
  if (!lookup) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const expectedHash = normalizeHash(lookup.entity.fileHash);
  const source = lookup.resolvedFrom === 'postgres' ? 'postgres' : getStoreSource();

  if (!expectedHash) {
    return NextResponse.json({
      result: 'no_hash_registered',
      expectedHash: null,
      computedHash: null,
      source,
    });
  }

  // Camino A: archivo subido (multipart). Camino B: descargar fileUrl en el servidor.
  const contentType = req.headers.get('content-type') ?? '';
  let computed: { hash: string } | { error: NextResponse };

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    computed = await hashFromUpload(file);
  } else {
    const fileUrl = normalizeEvidenceUrl(lookup.entity.fileUrl);
    if (!fileUrl) {
      return NextResponse.json({ error: 'No hay evidencia registrada para descargar' }, { status: 400 });
    }
    computed = await hashFromUrl(fileUrl);
  }

  if ('error' in computed) return computed.error;

  const computedHash = computed.hash;
  return NextResponse.json({
    result: hashesMatch(expectedHash, computedHash) ? 'match' : 'mismatch',
    expectedHash,
    computedHash,
    source,
  });
}
