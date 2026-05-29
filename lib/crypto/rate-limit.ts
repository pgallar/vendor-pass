export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter de ventana fija en memoria. `now` es inyectable para testear sin reloj real.
 * Nota: el estado es por instancia de proceso (suficiente para protección básica en dev/SSR).
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  function check(key: string, now: number = Date.now()): RateLimitResult {
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.limit - 1, retryAfterMs: 0 };
    }
    if (bucket.count >= options.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
    }
    bucket.count += 1;
    return { allowed: true, remaining: options.limit - bucket.count, retryAfterMs: 0 };
  }

  return { check };
}
