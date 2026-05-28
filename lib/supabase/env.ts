/** Cookie compartida navegador ↔ middleware (evita mismatch localhost vs gateway en Docker). */
export const SUPABASE_AUTH_COOKIE_NAME = 'sb-vendorpass-auth-token';

export function supabaseAuthCookieOptions() {
  return { name: SUPABASE_AUTH_COOKIE_NAME } as const;
}

/** URL pública para el cliente en el navegador. */
export function getSupabaseBrowserUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

/** URL para auth/API en el servidor (gateway interno en Docker). */
export function getSupabaseServerAuthUrl() {
  return process.env.SUPABASE_URL_INTERNAL ?? getSupabaseBrowserUrl();
}

/** URL base de Supabase (sin /rest/v1). En Docker el servidor usa el gateway interno. */
export function getSupabaseUrl() {
  return getSupabaseServerAuthUrl();
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}
