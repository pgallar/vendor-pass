import { describe, expect, it } from 'vitest';
import { validateEmail, validatePassword, validatePasswordConfirm } from '@/lib/auth/validation';

describe('validateEmail', () => {
  it('returns null for valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns error for empty email', () => {
    expect(validateEmail('')).toBeTruthy();
  });

  it('returns error for email without @', () => {
    expect(validateEmail('userexample.com')).toBeTruthy();
  });

  it('returns error for email without domain', () => {
    expect(validateEmail('user@')).toBeTruthy();
  });

  it('returns error for email without local part', () => {
    expect(validateEmail('@example.com')).toBeTruthy();
  });
});

describe('validatePassword', () => {
  it('returns null for password with 6+ characters', () => {
    expect(validatePassword('abc123')).toBeNull();
  });

  it('returns error for empty password', () => {
    expect(validatePassword('')).toBeTruthy();
  });

  it('returns error for password shorter than 6 characters', () => {
    expect(validatePassword('abc')).toBeTruthy();
  });

  it('returns null for exactly 6 characters', () => {
    expect(validatePassword('abcdef')).toBeNull();
  });
});

describe('validatePasswordConfirm', () => {
  it('returns null when passwords match', () => {
    expect(validatePasswordConfirm('abc123', 'abc123')).toBeNull();
  });

  it('returns error when passwords do not match', () => {
    expect(validatePasswordConfirm('abc123', 'abc124')).toBeTruthy();
  });

  it('returns error when confirm is empty and password is not', () => {
    expect(validatePasswordConfirm('abc123', '')).toBeTruthy();
  });
});
