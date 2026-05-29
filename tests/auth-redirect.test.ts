import { describe, expect, it } from 'vitest';
import { authCallbackUrl } from '@/lib/auth/redirect';

describe('authCallbackUrl', () => {
  it('builds callback URL with encoded next path', () => {
    expect(authCallbackUrl('/dashboard')).toMatch(
      /\/auth\/callback\?next=%2Fdashboard$/,
    );
  });

  it('uses server base URL in Node (no window)', () => {
    const url = authCallbackUrl('/reset-password');
    expect(url).toContain('/auth/callback?next=%2Freset-password');
    expect(url.startsWith('http')).toBe(true);
  });
});
