const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify',
  '/portal/accept',
];

/** `/` (landing) is public by exact match; the rest match by prefix. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}
