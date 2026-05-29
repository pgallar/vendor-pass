'use client';

import { useState } from 'react';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail, Send } from 'lucide-react';

export function InviteVendor({ vendorId }: { vendorId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSending(true);
    const res = await fetch('/api/portal/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, email: email.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setMsg('Invitación enviada. El enlace vence en 7 días.');
      setEmail('');
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? 'No se pudo enviar la invitación');
    }
  }

  return (
    <form onSubmit={handleInvite} noValidate className="flex flex-col gap-3">
      <FormField id="invite_email" label="Invitar contacto del proveedor al portal">
        <Input
          id="invite_email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          leftAddon={<Mail size={15} />}
          placeholder="contacto@proveedor.com"
          className="min-h-11"
        />
      </FormField>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" variant="outline" size="sm" loading={sending} leftIcon={<Send size={14} />} className="self-start min-h-11">
        Enviar invitación
      </Button>
    </form>
  );
}
