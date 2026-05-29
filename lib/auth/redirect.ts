import { getAppBaseUrl } from '@/lib/app-url';

/** URL de callback para enlaces en correos de auth (confirmación, recovery). */
export function authCallbackUrl(next = '/dashboard') {
  const base = getAppBaseUrl().replace(/\/$/, '');
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
