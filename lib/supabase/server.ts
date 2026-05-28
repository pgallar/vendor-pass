import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseServerAuthUrl, supabaseAuthCookieOptions } from '@/lib/supabase/env';

function adminClientOptions() {
  const opts: Parameters<typeof createSupabaseClient>[2] = {
    auth: { persistSession: false },
  };
  // Supabase realtime en Node < 22 requiere transport ws explícito
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws') as typeof WebSocket;
    opts.realtime = { transport: ws };
  }
  return opts;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseServerAuthUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component sin mutación de cookies
        }
      },
    },
  });
}

/** Solo scripts/cron: bypass RLS con service_role */
export function supabaseAdmin() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? getSupabaseAnonKey();
  return createSupabaseClient(url, key, adminClientOptions());
}

/** @deprecated Usar createClient() */
export async function supabaseServer() {
  return createClient();
}
