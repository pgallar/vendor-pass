import { createHash, randomBytes } from 'crypto';

export const TOKEN_PREFIX = 'vpi_';
export const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export function hashInviteToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function isValidTokenFormat(token: string): boolean {
  return /^vpi_[A-Za-z0-9_-]{24,}$/.test(token);
}

export interface GeneratedInvite {
  plaintext: string;
  hash: string;
  expiresAt: string;
}

/** Genera un token de un solo uso con expiración a 7 días. */
export function generateInviteToken(now: Date = new Date()): GeneratedInvite {
  const random = randomBytes(24).toString('base64url');
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * MS_PER_DAY).toISOString();
  return { plaintext, hash: hashInviteToken(plaintext), expiresAt };
}

export function isInviteExpired(expiresAt: string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(expiresAt).getTime();
}

/** Un solo uso: usable solo si no fue aceptada y no expiró. */
export function isInviteUsable(
  invite: { accepted_at: string | null; expires_at: string },
  now: Date = new Date(),
): boolean {
  if (invite.accepted_at) return false;
  return !isInviteExpired(invite.expires_at, now);
}
