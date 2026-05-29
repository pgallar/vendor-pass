'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { authCallbackUrl } from '@/lib/auth/redirect';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail, Lock } from 'lucide-react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authCallbackUrl(next) },
    });
    setLoading(false);

    if (signUpError) {
      console.error('Sign up error:', signUpError);

      let errorMessage = signUpError.message;
      if (signUpError.message.includes('already registered')) {
        errorMessage = 'Este correo ya está registrado.';
      } else if (signUpError.message.includes('rate limit') || signUpError.status === 429) {
        errorMessage = 'El sistema de correos está temporalmente saturado. Por favor, intenta de nuevo en unos minutos.';
      }

      setError(errorMessage);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace de confirmación a <strong className="text-foreground">{email}</strong>.
          Haz clic en el enlace para activar tu cuenta.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-muted-foreground">
            En desarrollo, abre el{' '}
            <a href="http://localhost:8025" className="text-primary font-medium" target="_blank" rel="noreferrer">
              visor de correos
            </a>{' '}
            para ver el correo.
          </p>
        )}
        <Button variant="outline" size="lg" className="w-full min-h-11" asChild>
          <Link href={`/verify-email?email=${encodeURIComponent(email)}`}>Reenviar confirmación</Link>
        </Button>
        <Link href="/login" className="text-sm text-primary font-medium">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tras confirmar tu correo, el primer acceso vincula los proveedores de demostración
        </p>
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

        <FormField id="password" label="Contraseña" required hint="Mínimo 6 caracteres">
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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
          Registrarse
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-primary font-medium">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Cargando…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
