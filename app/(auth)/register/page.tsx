'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { authCallbackUrl } from '@/lib/auth/redirect';
import { scorePassword } from '@/lib/auth/password-strength';
import { validateEmail, validatePassword, validatePasswordConfirm } from '@/lib/auth/validation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { PasswordInput } from '@/components/vendor-pass/password-input';
import { PasswordStrengthMeter } from '@/components/vendor-pass/password-strength-meter';
import { Mail, User, Building2 } from 'lucide-react';

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const strength = scorePassword(password);

  function setFieldError(field: keyof FieldErrors, error: string | null) {
    setFieldErrors(prev => ({ ...prev, [field]: error ?? undefined }));
  }

  function validateAll(): boolean {
    const errors: FieldErrors = {
      name: name.trim() ? undefined : 'El nombre es requerido.',
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: validatePasswordConfirm(password, confirm) ?? undefined,
    };
    setFieldErrors(errors);
    return !errors.name && !errors.email && !errors.password && !errors.confirm;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    setSubmitError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(next),
        data: {
          full_name: name.trim(),
          ...(organization.trim() ? { organization: organization.trim() } : {}),
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      let msg = signUpError.message;
      if (msg.includes('already registered')) msg = 'Este correo ya está registrado.';
      else if (msg.includes('rate limit') || signUpError.status === 429)
        msg = 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
      setSubmitError(msg);
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
          Hacé clic en el enlace para activar tu cuenta.
        </p>
        <p className="text-xs text-muted-foreground">
          Si no ves el correo, revisá tu carpeta de spam o correo no deseado.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-muted-foreground">
            En desarrollo, abrí el{' '}
            <a href="http://localhost:8025" className="text-primary font-medium" target="_blank" rel="noreferrer">
              visor de correos
            </a>{' '}
            para ver el mensaje.
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

  const hasErrors = !!(fieldErrors.name || fieldErrors.email || fieldErrors.password || fieldErrors.confirm);

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestioná el cumplimiento de tus proveedores con respaldo blockchain
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="name" label="Nombre completo" required error={fieldErrors.name}>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setFieldError('name', name.trim() ? null : 'El nombre es requerido.')}
            leftAddon={<User size={15} />}
            error={!!fieldErrors.name}
            className="min-h-11"
            required
          />
        </FormField>

        <FormField id="organization" label="Organización" hint="Opcional">
          <Input
            id="organization"
            type="text"
            autoComplete="organization"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            leftAddon={<Building2 size={15} />}
            className="min-h-11"
          />
        </FormField>

        <FormField id="email" label="Correo" required error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setFieldError('email', validateEmail(email))}
            leftAddon={<Mail size={15} />}
            error={!!fieldErrors.email}
            className="min-h-11"
            required
          />
        </FormField>

        <FormField id="password" label="Contraseña" required error={fieldErrors.password}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setFieldError('password', validatePassword(password))}
            error={!!fieldErrors.password}
            className="min-h-11"
            required
          />
          {password && (
            <PasswordStrengthMeter score={strength.score} label={strength.label} />
          )}
        </FormField>

        <FormField id="confirm" label="Confirmar contraseña" required error={fieldErrors.confirm}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onBlur={() => setFieldError('confirm', validatePasswordConfirm(password, confirm))}
            error={!!fieldErrors.confirm}
            className="min-h-11"
            required
          />
        </FormField>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={hasErrors}
          className="w-full min-h-11"
        >
          Registrarse
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link
          href={`/login${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-primary font-medium"
        >
          Iniciá sesión
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
