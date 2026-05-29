import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAnonKey, getSupabaseServerAuthUrl } from '@/lib/supabase/env';

function bearerClient(accessToken: string): SupabaseClient {
  const opts: Parameters<typeof createSupabaseClient>[2] = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  };
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws') as typeof WebSocket;
    opts.realtime = { transport: ws };
  }
  return createSupabaseClient(getSupabaseServerAuthUrl(), getSupabaseAnonKey(), opts);
}

export async function requireUser(): Promise<
  | { user: User; supabase: SupabaseClient; error: null }
  | { user: null; supabase: null; error: NextResponse }
> {
  const headerStore = await headers();
  const bearer = headerStore.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];

  const supabase = bearer ? bearerClient(bearer) : await createClient();
  const {
    data: { user },
    error,
  } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  return { user, supabase, error: null };
}
