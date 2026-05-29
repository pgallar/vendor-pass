import { describe, it, expect } from 'vitest';
import {
  generateInviteToken,
  hashInviteToken,
  isValidTokenFormat,
  isInviteExpired,
  isInviteUsable,
  INVITE_TTL_DAYS,
} from '@/lib/portal/invites';

describe('hashInviteToken', () => {
  it('es determinístico y devuelve sha256 hex (64 chars)', () => {
    const h1 = hashInviteToken('vpi_abc');
    const h2 = hashInviteToken('vpi_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
  it('cambia con la entrada', () => {
    expect(hashInviteToken('vpi_abc')).not.toBe(hashInviteToken('vpi_abd'));
  });
});

describe('isValidTokenFormat', () => {
  it('acepta un token generado', () => {
    expect(isValidTokenFormat(generateInviteToken().plaintext)).toBe(true);
  });
  it('rechaza formatos inválidos', () => {
    expect(isValidTokenFormat('abc')).toBe(false);
    expect(isValidTokenFormat('vpi_short')).toBe(false);
    expect(isValidTokenFormat('')).toBe(false);
  });
});

describe('generateInviteToken', () => {
  it('produce claro con prefijo vpi_, hash consistente y expiración a 7 días', () => {
    const now = new Date('2026-05-29T00:00:00Z');
    const t = generateInviteToken(now);
    expect(t.plaintext.startsWith('vpi_')).toBe(true);
    expect(t.hash).toBe(hashInviteToken(t.plaintext));
    const expected = new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();
    expect(t.expiresAt).toBe(expected);
  });
  it('genera tokens distintos en cada llamada', () => {
    expect(generateInviteToken().plaintext).not.toBe(generateInviteToken().plaintext);
  });
});

describe('isInviteExpired', () => {
  it('false antes de expirar, true después', () => {
    const exp = '2026-05-29T00:00:00.000Z';
    expect(isInviteExpired(exp, new Date('2026-05-28T23:59:59Z'))).toBe(false);
    expect(isInviteExpired(exp, new Date('2026-05-29T00:00:01Z'))).toBe(true);
  });
});

describe('isInviteUsable', () => {
  const future = '2026-12-31T00:00:00.000Z';
  const past = '2020-01-01T00:00:00.000Z';
  it('usable: no aceptada y no expirada', () => {
    expect(isInviteUsable({ accepted_at: null, expires_at: future })).toBe(true);
  });
  it('no usable: ya aceptada (un solo uso)', () => {
    expect(isInviteUsable({ accepted_at: '2026-05-29T00:00:00Z', expires_at: future })).toBe(false);
  });
  it('no usable: expirada', () => {
    expect(isInviteUsable({ accepted_at: null, expires_at: past })).toBe(false);
  });
});
