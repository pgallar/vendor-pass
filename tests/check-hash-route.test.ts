import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '@/lib/crypto/rate-limit';

describe('createRateLimiter', () => {
  it('permite hasta el límite y luego bloquea dentro de la ventana', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    const now = 0;
    const ip = '1.2.3.4';
    expect(limiter.check(ip, now).allowed).toBe(true);
    expect(limiter.check(ip, now).allowed).toBe(true);
    expect(limiter.check(ip, now).allowed).toBe(true);
    const blocked = limiter.check(ip, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('reinicia la cuenta al pasar la ventana', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    const ip = '5.6.7.8';
    expect(limiter.check(ip, 0).allowed).toBe(true);
    expect(limiter.check(ip, 500).allowed).toBe(false);
    expect(limiter.check(ip, 1001).allowed).toBe(true);
  });

  it('aísla los contadores por IP', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
  });
});
