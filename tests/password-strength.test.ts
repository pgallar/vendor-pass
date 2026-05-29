import { describe, expect, it } from 'vitest';
import { scorePassword } from '@/lib/auth/password-strength';

describe('scorePassword', () => {
  it('returns score 0 for empty string', () => {
    const result = scorePassword('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('Muy débil');
  });

  it('returns score 1 and label Débil for single criterion (only lowercase)', () => {
    const result = scorePassword('ab');
    expect(result.score).toBe(1);
    expect(result.label).toBe('Débil');
  });

  it('detects length >= 8 as a criterion', () => {
    const result = scorePassword('abcdefgh');
    expect(result.criteria.length8).toBe(true);
  });

  it('detects lowercase letters', () => {
    expect(scorePassword('a').criteria.lower).toBe(true);
    expect(scorePassword('A').criteria.lower).toBe(false);
  });

  it('detects uppercase letters', () => {
    expect(scorePassword('A').criteria.upper).toBe(true);
    expect(scorePassword('a').criteria.upper).toBe(false);
  });

  it('detects numbers', () => {
    expect(scorePassword('1').criteria.number).toBe(true);
    expect(scorePassword('a').criteria.number).toBe(false);
  });

  it('detects symbols', () => {
    expect(scorePassword('!').criteria.symbol).toBe(true);
    expect(scorePassword('a').criteria.symbol).toBe(false);
  });

  it('returns label Débil for 1-2 criteria', () => {
    expect(scorePassword('abcdefgh').label).toBe('Débil'); // length + lower = 2
  });

  it('returns label Media for 3 criteria', () => {
    expect(scorePassword('Abcdefgh').label).toBe('Media'); // length + lower + upper = 3
  });

  it('returns label Fuerte for 4+ criteria', () => {
    expect(scorePassword('Abcdefg1').label).toBe('Fuerte'); // length + lower + upper + number = 4
  });

  it('returns score 4 for fully strong password', () => {
    const result = scorePassword('Abcdefg1!');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Fuerte');
    expect(result.criteria).toEqual({
      length8: true,
      lower: true,
      upper: true,
      number: true,
      symbol: true,
    });
  });
});
