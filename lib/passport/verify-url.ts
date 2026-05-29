import { resolveServerAppBaseUrl } from '@/lib/app-url';

/** Base pública de la app, sin barra final. */
export function appBaseUrl(): string {
  return resolveServerAppBaseUrl();
}

/** Página web pública del pasaporte (estado en línea, siempre actualizado). */
export function buildVerifyPageUrl(vendorId: string): string {
  return `${appBaseUrl()}/verify/vendor/${vendorId}`;
}

/** @deprecated Usar buildVerifyPageUrl */
export function buildVerifyUrl(vendorId: string): string {
  return buildVerifyPageUrl(vendorId);
}

/** Ruta API pública de descarga del PDF (sin segmento `.pdf` en la URL). */
export function publicPassportPdfPath(vendorId: string): string {
  return `/api/verify/vendor/${vendorId}/passport-pdf`;
}

/** URL absoluta de descarga del PDF público. */
export function buildPublicPassportPdfUrl(vendorId: string): string {
  return `${appBaseUrl()}${publicPassportPdfPath(vendorId)}`;
}

/** Ruta API autenticada de descarga del PDF. */
export function authPassportPdfPath(vendorId: string): string {
  return `/api/vendors/${vendorId}/passport-pdf`;
}

/** URL absoluta de descarga del PDF (requiere sesión). */
export function buildAuthPassportPdfUrl(vendorId: string): string {
  return `${appBaseUrl()}${authPassportPdfPath(vendorId)}`;
}
