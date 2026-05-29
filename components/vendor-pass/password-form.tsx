'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Lock } from 'lucide-react';
import { validatePasswordChange } from '@/lib/profile/validation';

export function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validation = validatePasswordChange({ current, next, confirm });
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      setLoading(false);
      setError('No se pudo verificar la sesión.');
      return;
    }

    // Re-verificar la contraseña actual.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauthError) {
      setLoading(false);
      setError('La contraseña actual es incorrecta.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrent('');
    setNext('');
    setConfirm('');
    setMessage('Contraseña actualizada.');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Cambiar contraseña</h2>

      <FormField id="current_password" label="Contraseña actual" required>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          leftAddon={<Lock size={15} />}
          className="min-h-11"
          required
        />
      </FormField>

      <FormField id="new_password" label="Nueva contraseña" required hint="Mínimo 6 caracteres">
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={e => setNext(e.target.value)}
          leftAddon={<Lock size={15} />}
          className="min-h-11"
          required
        />
      </FormField>

      <FormField id="confirm_password" label="Confirmar nueva contraseña" required>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          leftAddon={<Lock size={15} />}
          className="min-h-11"
          required
        />
      </FormField>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
        {loading ? 'Actualizando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  );
}
