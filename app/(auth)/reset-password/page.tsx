'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Lock } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  if (checking) {
    return (
      <div className="text-sm text-muted-foreground text-center">Verificando sesión…</div>
    );
  }

  if (!hasSession) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Enlace inválido o expirado</h1>
        <p className="text-sm text-muted-foreground">
          Solicita un nuevo enlace de recuperación de contraseña.
        </p>
        <Button variant="primary" size="lg" className="w-full min-h-11" asChild>
          <Link href="/forgot-password">Solicitar enlace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Nueva contraseña</h1>
        <p className="text-sm text-muted-foreground mt-1">Elige una contraseña segura para tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="password" label="Nueva contraseña" required hint="Mínimo 6 caracteres">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            leftAddon={<Lock size={15} />}
            className="min-h-11"
            required
          />
        </FormField>

        <FormField id="confirm" label="Confirmar contraseña" required>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            leftAddon={<Lock size={15} />}
            className="min-h-11"
            required
          />
        </FormField>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
          Guardar contraseña
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Cargando…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
