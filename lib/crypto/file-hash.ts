import { createHash } from 'crypto';

/** SHA-256 de un buffer en hex minúscula (64 chars). Fuente de verdad del hashing en servidor. */
export function sha256Hex(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Normaliza un hash para comparar: minúscula, sin espacios, sin prefijo `sha256:`. */
export function normalizeHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const trimmed = hash.trim().toLowerCase().replace(/^sha256:/, '');
  return trimmed.length ? trimmed : null;
}

/** Compara dos hashes de forma tolerante (mayúsculas/prefijo). false si alguno falta. */
export function hashesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeHash(a);
  const nb = normalizeHash(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Calcula el SHA-256 de un File en el navegador usando Web Crypto.
 * IMPORTANTE: solo usar desde componentes cliente; `crypto.subtle` no existe en el server.
 */
export async function hashFileBrowser(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
