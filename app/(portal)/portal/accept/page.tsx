'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';

function AcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'checking' | 'need_auth' | 'accepting' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setState('error');
        setMessage('Falta el token de invitación.');
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState('need_auth');
        return;
      }
      setState('accepting');
      const res = await fetch('/api/portal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const { vendorId } = await res.json();
        setState('done');
        router.replace(`/portal/vendors/${vendorId}`);
      } else {
        const d = await res.json().catch(() => ({}));
        setState('error');
        setMessage(d.error ?? 'No se pudo aceptar la invitación.');
      }
    })();
  }, [token, router]);

  const next = `/portal/accept?token=${encodeURIComponent(token)}`;

  if (state === 'need_auth') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Aceptar invitación</h1>
        <p className="text-sm text-muted-foreground">
          Creá una cuenta o iniciá sesión para vincular tu acceso al portal del proveedor.
        </p>
        <Button asChild variant="primary" size="lg" className="w-full min-h-11">
          <Link href={`/register?next=${encodeURIComponent(next)}`}>Crear cuenta</Link>
        </Button>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-primary font-medium">
          Ya tengo cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center">
      {state === 'error' ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Procesando invitación…</p>
      )}
    </div>
  );
}

export default function PortalAcceptPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Cargando…</p>}>
      <AcceptInner />
    </Suspense>
  );
}
