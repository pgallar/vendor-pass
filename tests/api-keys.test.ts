import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, isValidKeyFormat } from '@/lib/api-keys/keys';

describe('hashApiKey', () => {
  it('es determinístico y devuelve sha256 hex (64 chars)', () => {
    const h1 = hashApiKey('vp_abc');
    const h2 = hashApiKey('vp_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
  it('cambia con la entrada', () => {
    expect(hashApiKey('vp_abc')).not.toBe(hashApiKey('vp_abd'));
  });
});

describe('isValidKeyFormat', () => {
  it('acepta una clave generada', () => {
    expect(isValidKeyFormat(generateApiKey().plaintext)).toBe(true);
  });
  it('rechaza formatos inválidos', () => {
    expect(isValidKeyFormat('abc')).toBe(false);
    expect(isValidKeyFormat('vp_short')).toBe(false);
    expect(isValidKeyFormat('')).toBe(false);
  });
});

describe('generateApiKey', () => {
  it('produce texto plano con prefijo vp_ y hash consistente', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith('vp_')).toBe(true);
    expect(key.hash).toBe(hashApiKey(key.plaintext));
    expect(key.prefix.startsWith('vp_')).toBe(true);
  });
  it('genera claves distintas en cada llamada', () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});
