const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isLocalAppUrl(url: string): boolean {
  try {
    return LOCALHOST_RE.test(new URL(url).origin);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/** Base URL of the VendorPass web app, without trailing slash. */
export function resolveServerAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured && !isLocalAppUrl(configured)) {
    return configured;
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) {
    return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  }

  return configured ?? 'http://localhost:3000';
}

/**
 * Base URL for links in the current environment.
 * In the browser, always uses the page origin (avoids a stale localhost build-time env in prod).
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return resolveServerAppBaseUrl();
}
