'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { claimLegacyVendors } from '@/lib/auth/claim-legacy';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail, Lock } from 'lucide-react';

function isEmailNotConfirmed(message: string) {
  return /email not confirmed|not confirmed/i.test(message);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const authError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (authError === 'expired') return 'El enlace expiró. Solicita uno nuevo.';
    if (authError === 'auth') return 'No se pudo completar la autenticación.';
    return null;
  });
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnconfirmedEmail(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      if (isEmailNotConfirmed(signInError.message)) {
        setUnconfirmedEmail(email);
        setError('Debes confirmar tu correo antes de iniciar sesión.');
      } else {
        setError(
          signInError.message.includes('Invalid login')
            ? 'Correo o contraseña incorrectos.'
            : signInError.message,
        );
      }
      return;
    }

    const claimed = await claimLegacyVendors();
    const dest = claimed > 0 ? `${next}?claimed=${claimed}` : next;
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground mt-1">Accede a tu panel de cumplimiento</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="email" label="Correo" required>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            leftAddon={<Mail size={15} />}
            className="min-h-11"
            required
          />
        </FormField>

        <FormField id="password" label="Contraseña" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            leftAddon={<Lock size={15} />}
            className="min-h-11"
            required
          />
        </FormField>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary font-medium min-h-11 inline-flex items-center">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-destructive">{error}</p>
            {unconfirmedEmail && (
              <Link
                href={`/verify-email?email=${encodeURIComponent(unconfirmedEmail)}`}
                className="text-sm text-primary font-medium"
              >
                Reenviar correo de confirmación
              </Link>
            )}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
          Entrar
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <Link href={`/register${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-primary font-medium">
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Cargando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
