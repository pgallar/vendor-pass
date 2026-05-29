'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

const TOKEN_STORAGE_KEY = 'vp_auth_callback_tokens';
const AUTH_TYPE_STORAGE_KEY = 'vp_auth_callback_type';
const PROCESSING_KEY = 'vp_auth_callback_processing';

function parseHashParams() {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function readHashTokens() {
  const hashParams = parseHashParams();
  const accessToken = hashParams?.get('access_token');
  const refreshToken = hashParams?.get('refresh_token');
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }

  const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { accessToken?: string; refreshToken?: string };
    if (parsed.accessToken && parsed.refreshToken) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

function readAuthType() {
  const hashParams = parseHashParams();
  const fromHash = hashParams?.get('type');
  if (fromHash) {
    sessionStorage.setItem(AUTH_TYPE_STORAGE_KEY, fromHash);
    return fromHash;
  }
  return sessionStorage.getItem(AUTH_TYPE_STORAGE_KEY);
}

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const [message, setMessage] = useState('Completando autenticación…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function completeAuth() {
      if (sessionStorage.getItem(PROCESSING_KEY) === '1') return;
      sessionStorage.setItem(PROCESSING_KEY, '1');

      try {
        const hashParams = parseHashParams();
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const recoveryFlow =
          readAuthType() === 'recovery' || searchParams.get('next') === '/reset-password';
        const supabase = createClient();

        if (errorParam) {
          const desc = searchParams.get('error_description') ?? '';
          const expired = errorParam === 'access_denied' || desc.toLowerCase().includes('expired');
          router.replace(expired ? '/login?error=expired' : '/login?error=auth');
          return;
        }

        if (hashParams?.get('error')) {
          const hashDesc = hashParams.get('error_description') ?? '';
          const expired =
            hashParams.get('error_code') === 'otp_expired' ||
            hashParams.get('error') === 'access_denied' ||
            hashDesc.toLowerCase().includes('expired');
          router.replace(expired ? '/login?error=expired' : '/login?error=auth');
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            router.replace('/login?error=auth');
            return;
          }
        } else {
          const tokens = readHashTokens();
          if (tokens) {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
            const { error } = await supabase.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            });
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            if (error) {
              router.replace('/login?error=auth');
              return;
            }
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/login?error=auth');
          return;
        }

        if (recoveryFlow || next === '/reset-password') {
          router.replace('/reset-password');
          router.refresh();
          return;
        }

        setMessage('Vinculando datos…');

        const fullName = session.user.user_metadata?.full_name as string | undefined;
        const orgName = session.user.user_metadata?.organization as string | undefined;
        if (fullName) {
          await supabase.from('profiles').upsert({
            id: session.user.id,
            full_name: fullName,
            ...(orgName ? { organization: orgName } : {}),
          });
        }

        const { data: claimed } = await supabase.rpc('claim_legacy_vendors');
        const dest = claimed && claimed > 0 ? `${next}?claimed=${claimed}` : next;
        router.replace(dest);
        router.refresh();
      } finally {
        sessionStorage.removeItem(PROCESSING_KEY);
        sessionStorage.removeItem(AUTH_TYPE_STORAGE_KEY);
      }
    }

    completeAuth().catch(() => {
      sessionStorage.removeItem(PROCESSING_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      router.replace('/login?error=auth');
    });
  }, [next, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando…</div>}>
      <AuthCallbackHandler />
    </Suspense>
  );
}
