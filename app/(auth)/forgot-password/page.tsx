'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { authCallbackUrl } from '@/lib/auth/redirect';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail } from 'lucide-react';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Ingresa tu correo.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl('/reset-password'),
    });

    setLoading(false);

    if (resetError) {
      console.error('Reset password error:', resetError);

      let errorMessage = resetError.message;
      if (resetError.message.includes('rate limit') || resetError.status === 429) {
        errorMessage = 'El sistema de correos está temporalmente saturado. Por favor, intenta de nuevo en unos minutos.';
      }

      setError(errorMessage);
      return;
    }

    setSent(true);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Recuperar contraseña</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Te enviaremos un enlace para restablecer tu contraseña
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-sm text-foreground">
            Si existe una cuenta con ese correo, enviamos instrucciones para restablecer la contraseña.
          </p>
          <p className="text-xs text-muted-foreground">
            Revisa tu bandeja de entrada (incluyendo spam).
            {process.env.NODE_ENV === 'development' && (
              <>
                {' '}(Desarrollo local:{' '}
                <a href="http://localhost:8025" className="text-primary font-medium" target="_blank" rel="noreferrer">
                  visor de correos
                </a>)
              </>
            )}
          </p>
        </div>
      ) : (
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

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
            Enviar enlace
          </Button>
        </form>
      )}

      <Link href="/login" className="text-sm text-center text-primary font-medium">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Cargando…</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
