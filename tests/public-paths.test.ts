import { describe, expect, it } from 'vitest';
import { isPublicPath } from '@/lib/auth/public-paths';

describe('isPublicPath', () => {
  it('treats the landing root as public', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('treats auth routes as public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/register')).toBe(true);
    expect(isPublicPath('/verify/abc-123')).toBe(true);
  });

  it('treats the dashboard as protected', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
  });

  it('treats app sections as protected', () => {
    expect(isPublicPath('/vendors')).toBe(false);
    expect(isPublicPath('/integrations')).toBe(false);
  });

  it('does not let the root prefix-match every path', () => {
    expect(isPublicPath('/vendors/123')).toBe(false);
  });
});
