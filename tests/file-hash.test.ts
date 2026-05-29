import { describe, it, expect } from 'vitest';
import { sha256Hex, normalizeHash, hashesMatch } from '@/lib/crypto/file-hash';

const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256Hex', () => {
  it('hashea la cadena vacía con el vector conocido', () => {
    expect(sha256Hex(Buffer.from(''))).toBe(EMPTY);
  });
  it('hashea "abc" con el vector conocido', () => {
    expect(sha256Hex(Buffer.from('abc', 'utf8'))).toBe(ABC);
  });
  it('devuelve 64 chars hex en minúscula', () => {
    expect(sha256Hex(Buffer.from('vendorpass'))).toMatch(/^[a-f0-9]{64}$/);
  });
  it('un byte distinto cambia el hash (mismatch)', () => {
    expect(sha256Hex(Buffer.from('abc'))).not.toBe(sha256Hex(Buffer.from('abd')));
  });
});

describe('normalizeHash', () => {
  it('pasa a minúscula y recorta espacios', () => {
    expect(normalizeHash(`  ${ABC.toUpperCase()}  `)).toBe(ABC);
  });
  it('quita el prefijo sha256: si está presente', () => {
    expect(normalizeHash(`sha256:${ABC}`)).toBe(ABC);
  });
  it('devuelve null para entradas vacías o nulas', () => {
    expect(normalizeHash('')).toBeNull();
    expect(normalizeHash(null)).toBeNull();
    expect(normalizeHash('   ')).toBeNull();
  });
});

describe('hashesMatch', () => {
  it('compara de forma insensible a mayúsculas y prefijos', () => {
    expect(hashesMatch(ABC, ABC.toUpperCase())).toBe(true);
    expect(hashesMatch(`sha256:${ABC}`, ABC)).toBe(true);
  });
  it('detecta mismatch', () => {
    expect(hashesMatch(ABC, EMPTY)).toBe(false);
  });
  it('es false si alguno es null/vacío', () => {
    expect(hashesMatch(null, ABC)).toBe(false);
    expect(hashesMatch(ABC, '')).toBe(false);
  });
});
