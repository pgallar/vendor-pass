import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseBrowserUrl, supabaseAuthCookieOptions } from '@/lib/supabase/env';

export function createClient() {
  return createBrowserClient(
    getSupabaseBrowserUrl(),
    getSupabaseAnonKey(),
    {
      auth: {
        flowType: 'pkce',
      },
      cookieOptions: supabaseAuthCookieOptions(),
    },
  );
}

/** @deprecated Usar createClient() */
export const supabaseBrowser = createClient;
