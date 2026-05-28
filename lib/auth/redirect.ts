/** URL de callback para enlaces en correos de auth (confirmación, recovery). */
export function authCallbackUrl(next = '/') {
  const base =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin)
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
