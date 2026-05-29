'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Avatar } from '@/components/vendor-pass/avatar';
import { User, Phone, Building2, Mail, CheckCircle2, Clock } from 'lucide-react';
import type { ProfileResponse } from '@/lib/types';

interface ProfileFormProps {
  initial: ProfileResponse;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.profile.full_name ?? '');
  const [phone, setPhone] = useState(initial.profile.phone ?? '');
  const [organization, setOrganization] = useState(initial.profile.organization ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial.profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/profile/avatar', { method: 'POST', body });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error subiendo la imagen');
      return;
    }
    const { avatar_url } = await res.json();
    setAvatarUrl(avatar_url);
    setMessage('Foto de perfil actualizada.');
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone, organization }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error guardando los datos');
      return;
    }
    setMessage('Datos guardados.');
    router.refresh();
  }

  const verified = Boolean(initial.email_confirmed_at);
  const memberSince = initial.created_at
    ? new Date(initial.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl} name={fullName} email={initial.email} size={64} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="avatar"
              className="inline-flex items-center justify-center min-h-11 px-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/40 transition-colors text-sm font-medium text-foreground"
            >
              {uploading ? 'Subiendo…' : 'Cambiar foto'}
            </label>
            <input
              id="avatar"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="sr-only"
              onChange={handleAvatar}
              disabled={uploading}
            />
            <span className="text-xs text-muted-foreground">PNG o JPG, máx. 5 MB.</span>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Datos de cuenta</h2>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Mail size={15} className="text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{initial.email ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 size={14} aria-hidden="true" /> Correo verificado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Clock size={14} aria-hidden="true" /> Correo sin verificar
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Miembro desde {memberSince}</p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Información personal</h2>

        <FormField id="full_name" label="Nombre completo">
          <Input
            id="full_name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ej: Ana Pérez"
            leftAddon={<User size={15} />}
            className="min-h-11"
          />
        </FormField>

        <FormField id="phone" label="Teléfono">
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+54 11 1234-5678"
            leftAddon={<Phone size={15} />}
            className="min-h-11"
          />
        </FormField>

        <FormField id="organization" label="Organización">
          <Input
            id="organization"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            placeholder="Ej: ACME S.A."
            leftAddon={<Building2 size={15} />}
            className="min-h-11"
          />
        </FormField>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <Button type="submit" variant="primary" size="lg" loading={saving} className="w-full min-h-11">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
