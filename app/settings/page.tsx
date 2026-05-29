'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ProfileForm } from '@/components/vendor-pass/profile-form';
import { PasswordForm } from '@/components/vendor-pass/password-form';
import type { ProfileResponse } from '@/lib/types';

export default function SettingsPage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(async res => {
        if (!res.ok) throw new Error('No se pudo cargar el perfil');
        return res.json();
      })
      .then((json: ProfileResponse) => setData(json))
      .catch(() => setError('No se pudo cargar tu perfil. Recargá la página.'));
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader title="Mi perfil" description="Gestioná tus datos, tu foto y tu contraseña." />

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {!data && !error && (
          <p className="text-sm text-muted-foreground">Cargando tu perfil…</p>
        )}

        {data && (
          <>
            <ProfileForm initial={data} />
            <PasswordForm />
          </>
        )}
      </div>
    </AppShell>
  );
}
