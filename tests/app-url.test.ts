import { afterEach, describe, expect, it } from 'vitest';
import { isLocalAppUrl, resolveServerAppBaseUrl } from '@/lib/app-url';

describe('isLocalAppUrl', () => {
  it('detects localhost origins', () => {
    expect(isLocalAppUrl('http://localhost:3000')).toBe(true);
    expect(isLocalAppUrl('http://127.0.0.1:3000')).toBe(true);
  });

  it('treats production origins as non-local', () => {
    expect(isLocalAppUrl('https://vendor-pass.vercel.app')).toBe(false);
  });
});

describe('resolveServerAppBaseUrl', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('prefers non-local NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vendor-pass.vercel.app';
    delete process.env.VERCEL_URL;
    expect(resolveServerAppBaseUrl()).toBe('https://vendor-pass.vercel.app');
  });

  it('ignores localhost NEXT_PUBLIC_APP_URL when VERCEL_URL is set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.VERCEL_URL = 'vendor-pass.vercel.app';
    expect(resolveServerAppBaseUrl()).toBe('https://vendor-pass.vercel.app');
  });

  it('falls back to localhost when only local env is set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.VERCEL_URL;
    expect(resolveServerAppBaseUrl()).toBe('http://localhost:3000');
  });
});
