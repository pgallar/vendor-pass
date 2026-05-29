import { createHash, randomBytes } from 'crypto';

export const KEY_PREFIX = 'vp_';

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function isValidKeyFormat(key: string): boolean {
  return /^vp_[A-Za-z0-9_-]{24,}$/.test(key);
}

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedKey {
  const random = randomBytes(24).toString('base64url'); // 32 chars URL-safe
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = `${plaintext.slice(0, 11)}…`; // 'vp_' + 8 chars + elipsis para mostrar
  return { plaintext, prefix, hash: hashApiKey(plaintext) };
}
