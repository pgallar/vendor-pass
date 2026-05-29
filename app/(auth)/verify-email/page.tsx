'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { authCallbackUrl } from '@/lib/auth/redirect';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail } from 'lucide-react';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Ingresa tu correo.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authCallbackUrl('/') },
    });

    setLoading(false);

    if (resendError) {
      console.error('Resend email error:', resendError);

      let errorMessage = resendError.message;
      if (resendError.message.includes('rate limit') || resendError.status === 429) {
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
        <h1 className="text-xl font-semibold text-foreground">Confirmar correo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reenvía el enlace de verificación si no lo recibiste
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-sm text-foreground">
            Si existe una cuenta pendiente con <strong>{email}</strong>, enviamos un nuevo correo.
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
        <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
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
            Reenviar confirmación
          </Button>
        </form>
      )}

      <Link href="/login" className="text-sm text-center text-primary font-medium">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Cargando…</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
