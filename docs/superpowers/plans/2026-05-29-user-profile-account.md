# Perfil y Cuenta del Usuario — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle al usuario una sección "Mi perfil" donde pueda ver y verificar sus datos de cuenta (correo, estado de verificación, alta), editar su nombre/teléfono/organización, subir una foto de perfil y cambiar su contraseña — todo dentro del shell autenticado de la app.

**Architecture:** Una tabla `profiles` (1:1 con `auth.users`, RLS por dueño, fila autocreada por trigger + backfill) guarda los datos editables y la URL del avatar. La foto se sube al mismo S3/MinIO ya usado para evidencias (reutilizando `uploadEvidence`) bajo `avatars/{userId}/...`. Los datos de cuenta inmutables (correo, verificación, fecha de alta) salen de `auth.users` vía `requireUser()`. La edición de campos y el avatar pasan por REST (`GET/PATCH /api/profile`, `POST /api/profile/avatar`); el cambio de contraseña se hace en el cliente con `supabase.auth.updateUser()` previa re-verificación de la contraseña actual con `signInWithPassword` (Supabase no valida la contraseña anterior por sí solo). La lógica de validación vive en funciones puras testeables. La página `/settings` queda protegida automáticamente por el middleware existente (no está en `PUBLIC_PREFIXES`).

**Tech Stack:** Next.js 16.2.6 (App Router), Supabase (`@supabase/ssr`, RLS), S3/MinIO (`@aws-sdk/client-s3`, ya integrado), TypeScript, Vitest, Tailwind v4, lucide-react.

**Decisiones tomadas (objetá si querés cambiarlas):**
- **Almacenamiento de datos:** tabla `profiles` dedicada (no `user_metadata`) — mejor práctica, consultable con RLS, sigue el estilo de la migración `0003`.
- **Avatar:** reutiliza el bucket S3 existente (`uploadEvidence`), no Supabase Storage. *Requiere que el bucket permita lectura pública* (igual que las evidencias que ya se muestran).
- **Correo:** se muestra como **solo lectura** con su estado de verificación. Cambiar el correo dispara un flujo de confirmación aparte → queda como *stretch* opcional al final, fuera del MVP.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0005_profiles.sql` (crear) | Tabla `profiles` + RLS por dueño + trigger de autocreación + backfill |
| `lib/types.ts` (modificar) | Tipo `Profile` |
| `lib/profile/validation.ts` (crear) | Funciones puras: `validatePasswordChange`, `validateProfileFields`, `validateAvatarFile`, `getInitials` + constantes de avatar |
| `tests/profile.test.ts` (crear) | Tests de las funciones puras |
| `app/api/profile/route.ts` (crear) | `GET` (lee/crea perfil + datos de cuenta) y `PATCH` (edita campos) |
| `app/api/profile/avatar/route.ts` (crear) | `POST` sube avatar a S3 y actualiza `avatar_url` |
| `components/vendor-pass/avatar.tsx` (crear) | Avatar: imagen o iniciales |
| `components/vendor-pass/profile-form.tsx` (crear) | Datos de cuenta + edición de campos + subida de avatar |
| `components/vendor-pass/password-form.tsx` (crear) | Cambio de contraseña con re-verificación |
| `app/settings/page.tsx` (crear) | Página "Mi perfil" dentro del `AppShell` |
| `components/vendor-pass/auth-user-footer.tsx` (modificar) | Mostrar avatar + nombre + correo, enlazar a `/settings` |
| `components/vendor-pass/bottom-nav.tsx` (modificar) | Entrada "Perfil" en el nav móvil |

---

## Task 1: Migración — tabla `profiles`

**Files:**
- Create: `supabase/migrations/0005_profiles.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0005_profiles.sql`:

```sql
-- Perfil de usuario: 1:1 con auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  organization text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Autocrear la fila de perfil al crearse un usuario nuevo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: perfiles para los usuarios ya existentes
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
```

- [ ] **Step 2: Aplicar la migración**

Run (con tu flujo habitual de Supabase local):
`npx supabase migration up`
(alternativa para recrear desde cero, **borra datos**: `npx supabase db reset`)
Expected: la migración se aplica sin errores.

- [ ] **Step 3: Verificar la tabla y el backfill**

Run: `npx supabase db reset --help >/dev/null 2>&1; echo "consulta manual abajo"` — luego en el SQL editor de Supabase (o `psql`):
`select count(*) from public.profiles;`
Expected: devuelve una fila por cada usuario existente (≥ la cantidad de cuentas registradas), confirmando el backfill.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_profiles.sql
git commit -m "feat(db): tabla profiles con RLS, trigger de alta y backfill"
```

---

## Task 2: Tipo `Profile`

**Files:**
- Modify: `lib/types.ts` (append al final, después de la línea 36)

- [ ] **Step 1: Añadir el tipo**

Append to `lib/types.ts`:

```typescript
export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  avatar_url: string | null;
  updated_at: string;
}

/** Respuesta de GET /api/profile: perfil editable + datos de cuenta de solo lectura. */
export interface ProfileResponse {
  profile: Profile;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string | null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): tipos Profile y ProfileResponse"
```

---

## Task 3: Validación (funciones puras, TDD)

**Files:**
- Create: `lib/profile/validation.ts`
- Test: `tests/profile.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/profile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validatePasswordChange,
  validateProfileFields,
  validateAvatarFile,
  getInitials,
  AVATAR_MAX_BYTES,
} from '@/lib/profile/validation';

describe('validatePasswordChange', () => {
  it('acepta un cambio válido', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: 'nuevo123', confirm: 'nuevo123' })).toBeNull();
  });
  it('exige la contraseña actual', () => {
    expect(validatePasswordChange({ current: '', next: 'nuevo123', confirm: 'nuevo123' })).toMatch(/actual/i);
  });
  it('exige mínimo 6 caracteres', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: '123', confirm: '123' })).toMatch(/6/);
  });
  it('exige que coincidan', () => {
    expect(validatePasswordChange({ current: 'viejo123', next: 'nuevo123', confirm: 'otra123' })).toMatch(/coinciden/i);
  });
  it('exige que sea distinta de la actual', () => {
    expect(validatePasswordChange({ current: 'igual123', next: 'igual123', confirm: 'igual123' })).toMatch(/distinta/i);
  });
});

describe('validateProfileFields', () => {
  it('no devuelve errores con datos válidos', () => {
    expect(validateProfileFields({ full_name: 'Ana Pérez', phone: '+54 11 1234-5678', organization: 'ACME' })).toEqual({});
  });
  it('acepta campos vacíos (todos opcionales)', () => {
    expect(validateProfileFields({ full_name: null, phone: null, organization: null })).toEqual({});
  });
  it('rechaza nombre demasiado largo', () => {
    expect(validateProfileFields({ full_name: 'x'.repeat(81), phone: null, organization: null }).full_name).toBeDefined();
  });
  it('rechaza teléfono con caracteres inválidos', () => {
    expect(validateProfileFields({ full_name: null, phone: 'abc!!', organization: null }).phone).toBeDefined();
  });
});

describe('validateAvatarFile', () => {
  it('acepta PNG dentro del límite', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1000 })).toBeNull();
  });
  it('rechaza un PDF', () => {
    expect(validateAvatarFile({ type: 'application/pdf', size: 1000 })).toMatch(/PNG|JPG/i);
  });
  it('rechaza imágenes que superan el límite', () => {
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toMatch(/MB/);
  });
});

describe('getInitials', () => {
  it('toma las iniciales de nombre y apellido', () => {
    expect(getInitials('Ana Pérez', 'ana@acme.com')).toBe('AP');
  });
  it('usa dos letras de un nombre simple', () => {
    expect(getInitials('Ana', null)).toBe('AN');
  });
  it('cae al correo si no hay nombre', () => {
    expect(getInitials(null, 'pablo@acme.com')).toBe('PA');
  });
  it('devuelve "?" si no hay datos', () => {
    expect(getInitials(null, null)).toBe('?');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/profile.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/profile/validation'".

- [ ] **Step 3: Implementar las funciones puras**

Create `lib/profile/validation.ts`:

```typescript
export const AVATAR_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

/** Devuelve un mensaje de error o null si el cambio es válido. */
export function validatePasswordChange(input: PasswordChangeInput): string | null {
  if (!input.current) return 'Ingresá tu contraseña actual.';
  if (input.next.length < 6) return 'La nueva contraseña debe tener al menos 6 caracteres.';
  if (input.next !== input.confirm) return 'Las contraseñas no coinciden.';
  if (input.next === input.current) return 'La nueva contraseña debe ser distinta de la actual.';
  return null;
}

export interface ProfileFieldsInput {
  full_name: string | null;
  phone: string | null;
  organization: string | null;
}

/** Devuelve un mapa de errores por campo (vacío = válido). */
export function validateProfileFields(
  input: ProfileFieldsInput,
): Partial<Record<keyof ProfileFieldsInput, string>> {
  const errors: Partial<Record<keyof ProfileFieldsInput, string>> = {};
  if (input.full_name && input.full_name.length > 80) errors.full_name = 'Máximo 80 caracteres.';
  if (input.organization && input.organization.length > 120) errors.organization = 'Máximo 120 caracteres.';
  if (input.phone && !/^[+\d\s()-]{6,30}$/.test(input.phone)) errors.phone = 'Teléfono inválido.';
  return errors;
}

/** Devuelve un mensaje de error o null si el archivo es un avatar válido. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!AVATAR_ALLOWED_TYPES.has(file.type)) return 'Formato no permitido. Usá PNG o JPG.';
  if (file.size > AVATAR_MAX_BYTES) return 'La imagen supera los 5 MB.';
  return null;
}

/** Iniciales para el avatar de respaldo: del nombre, o del usuario del correo. */
export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '');
  if (!source) return '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/profile.test.ts`
Expected: PASS (todos los grupos).

- [ ] **Step 5: Commit**

```bash
git add lib/profile/validation.ts tests/profile.test.ts
git commit -m "feat(profile): validación pura de perfil/contraseña/avatar con tests"
```

---

## Task 4: Componente Avatar

**Files:**
- Create: `components/vendor-pass/avatar.tsx`

- [ ] **Step 1: Crear el componente**

Create `components/vendor-pass/avatar.tsx`:

```tsx
import { getInitials } from '@/lib/profile/validation';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, email, size = 40, className }: AvatarProps) {
  const dimension = { width: size, height: size };
  if (src) {
    // URL externa de S3; <img> evita configurar dominios de next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        style={dimension}
        className={cn('rounded-full object-cover bg-secondary shrink-0', className)}
      />
    );
  }
  return (
    <span
      style={dimension}
      className={cn(
        'rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-semibold shrink-0',
        className,
      )}
    >
      <span style={{ fontSize: size * 0.4 }}>{getInitials(name, email)}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/avatar.tsx
git commit -m "feat(ui): componente Avatar con respaldo de iniciales"
```

---

## Task 5: API `GET`/`PATCH /api/profile`

**Files:**
- Create: `app/api/profile/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/profile/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { validateProfileFields } from '@/lib/profile/validation';

const PROFILE_COLUMNS = 'id, full_name, phone, organization, avatar_url, updated_at';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const existing = await auth.supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', auth.user.id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }

  let profile = existing.data;
  if (!profile) {
    // Respaldo por si el trigger no corrió (cuentas previas a la migración).
    const created = await auth.supabase
      .from('profiles')
      .insert({ id: auth.user.id })
      .select(PROFILE_COLUMNS)
      .single();
    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 });
    }
    profile = created.data;
  }

  return NextResponse.json({
    profile,
    email: auth.user.email ?? null,
    email_confirmed_at: auth.user.email_confirmed_at ?? null,
    created_at: auth.user.created_at ?? null,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const fields = {
    full_name: typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : null,
    phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
    organization:
      typeof body.organization === 'string' && body.organization.trim() ? body.organization.trim() : null,
  };

  const errors = validateProfileFields(fields);
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: 'Datos inválidos', fields: errors }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', auth.user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ profile: data });
}
```

- [ ] **Step 2: Verificar tipos y smoke test**

Run: `npx tsc --noEmit`
Expected: PASS

Run (dev server + sesión activa en el navegador no aplica a curl; sin sesión):
`curl -i http://localhost:3000/api/profile`
Expected: `HTTP/1.1 401` con `{"error":"No autorizado"}` — confirma que el guard de auth corre.

- [ ] **Step 3: Commit**

```bash
git add app/api/profile/route.ts
git commit -m "feat(api): GET/PATCH de perfil del usuario"
```

---

## Task 6: API `POST /api/profile/avatar`

**Files:**
- Create: `app/api/profile/avatar/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/profile/avatar/route.ts`:

```typescript
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { uploadEvidence } from '@/lib/storage/s3';
import { validateAvatarFile } from '@/lib/profile/validation';

export async function POST(req: Request) {
  if (!process.env.S3_ENDPOINT) {
    return NextResponse.json({ error: 'Almacenamiento S3 no configurado' }, { status: 503 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  const fileError = validateAvatarFile({ type: file.type, size: file.size });
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `avatars/${auth.user.id}/${randomUUID()}.${ext}`;

  try {
    const { url } = await uploadEvidence(buffer, file.type, key);
    const { data, error } = await auth.supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('avatar_url')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ avatar_url: data.avatar_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error subiendo imagen';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/profile/avatar/route.ts
git commit -m "feat(api): subida de avatar a S3 y actualización de perfil"
```

---

## Task 7: Formulario de perfil (datos + avatar)

Muestra los datos de cuenta (correo + verificación + alta, solo lectura), permite editar nombre/teléfono/organización y subir el avatar.

**Files:**
- Create: `components/vendor-pass/profile-form.tsx`

- [ ] **Step 1: Crear el componente**

Create `components/vendor-pass/profile-form.tsx`:

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/profile-form.tsx
git commit -m "feat(ui): formulario de perfil con datos de cuenta y avatar"
```

---

## Task 8: Formulario de cambio de contraseña

Re-verifica la contraseña actual con `signInWithPassword` (Supabase no la valida en `updateUser`), luego actualiza.

**Files:**
- Create: `components/vendor-pass/password-form.tsx`

- [ ] **Step 1: Crear el componente**

Create `components/vendor-pass/password-form.tsx`:

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/password-form.tsx
git commit -m "feat(ui): cambio de contraseña con re-verificación"
```

---

## Task 9: Página `/settings` + navegación

**Files:**
- Create: `app/settings/page.tsx`
- Modify: `components/vendor-pass/auth-user-footer.tsx`
- Modify: `components/vendor-pass/bottom-nav.tsx`

- [ ] **Step 1: Crear la página**

Create `app/settings/page.tsx`:

```tsx
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
```

> **Verificado:** `PageHeader` acepta `title: string` y `description?: string` (props confirmadas en `components/vendor-pass/page-header.tsx`), y `AppShell` toma `children`. No requieren ajustes.

- [ ] **Step 2: Actualizar el pie de la barra lateral**

Replace the entire contents of `components/vendor-pass/auth-user-footer.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';
import { Avatar } from '@/components/vendor-pass/avatar';

export function AuthUserFooter() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch('/api/profile')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.profile) {
          setName(data.profile.full_name);
          setAvatar(data.profile.avatar_url);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="px-3 py-4 border-t border-sidebar-border mt-auto">
      <Link
        href="/settings"
        className="flex items-center gap-2.5 mb-2 -mx-1 px-1 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
      >
        <Avatar src={avatar} name={name} email={email} size={32} />
        <span className="min-w-0">
          {name && (
            <span className="block text-xs font-medium text-sidebar-foreground truncate">{name}</span>
          )}
          {email && (
            <span className="block text-[11px] text-sidebar-foreground/70 truncate" title={email}>
              {email}
            </span>
          )}
        </span>
      </Link>
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground min-h-11"
          leftIcon={<LogOut size={16} aria-hidden="true" />}
        >
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Añadir "Perfil" al nav móvil**

In `components/vendor-pass/bottom-nav.tsx`:

Change the icon import on line 6 to add `User`:
```typescript
import { LayoutDashboard, Users, CalendarClock, Plus, User } from 'lucide-react';
```

Add a fifth entry to `NAV_ITEMS` (after the `'Nuevo'` item, before the closing `] as const;`):
```typescript
  { label: 'Perfil', href: '/settings', icon: User, match: (p: string) => p.startsWith('/settings') },
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx components/vendor-pass/auth-user-footer.tsx components/vendor-pass/bottom-nav.tsx
git commit -m "feat(profile): página Mi perfil y enlaces de navegación"
```

---

## Task 10: Verificación end-to-end

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Suite + arranque**

Run: `npm test && npm run dev`
Expected: tests en verde (incluye `tests/profile.test.ts`); dev server en `http://localhost:3000`.

- [ ] **Step 2: Verificar acceso y datos**

1. Login → en la barra lateral (desktop) hacé clic en tu correo/avatar abajo → debe navegar a `/settings`.
2. En móvil (o viewport angosto) usá la pestaña "Perfil" del nav inferior.
3. En "Datos de cuenta": verificá que aparezca tu correo, el estado de verificación correcto y "Miembro desde …".

- [ ] **Step 3: Editar datos**

Cargá nombre, teléfono y organización → "Guardar cambios" → debe mostrar "Datos guardados." y, al recargar, persistir. Verificá que el nombre aparece ahora en el pie de la barra lateral.

- [ ] **Step 4: Subir avatar**

Subí una imagen PNG/JPG → debe mostrar "Foto de perfil actualizada." y verse en el avatar (en el form y en la barra lateral). Probá un PDF o una imagen > 5 MB → debe rechazarse con el mensaje de error.

> Si la imagen no se ve pero la subida respondió OK, el bucket S3/MinIO no permite lectura pública: ajustá la policy del bucket (o usá un bucket público) — ver decisión de almacenamiento en la cabecera.

- [ ] **Step 5: Cambiar contraseña**

1. Con contraseña actual incorrecta → "La contraseña actual es incorrecta."
2. Con nueva < 6 caracteres → error de longitud.
3. Con nueva ≠ confirmación → "Las contraseñas no coinciden."
4. Con datos correctos → "Contraseña actualizada." Cerrá sesión e iniciá con la nueva contraseña para confirmar.

- [ ] **Step 6: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(profile): ajustes finales tras verificación end-to-end"
```

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Verificar/ver datos de cuenta (correo, verificación, alta) → Task 7 (sección "Datos de cuenta") + Task 5 (GET expone `email`/`email_confirmed_at`/`created_at`).
- ✅ Editar nombre/teléfono/organización → Tasks 5 (PATCH) + 7 (form).
- ✅ Cargar foto de perfil → Tasks 6 (API) + 4 (Avatar) + 7 (subida).
- ✅ Cambiar contraseña → Task 8 (con re-verificación).
- ✅ Acceso desde la navegación (desktop + móvil) → Task 9.
- ✅ Persistencia y RLS por dueño → Task 1.

**2. Placeholders:** sin TODOs. Las dos notas condicionales (nombre de prop de `PageHeader`, lectura pública del bucket) incluyen instrucción exacta de qué verificar y cómo resolver.

**3. Consistencia de tipos:** `Profile`/`ProfileResponse` (Task 2) se usan idénticos en el GET (Task 5), `ProfileForm` (Task 7) y la página (Task 9). `PROFILE_COLUMNS` es la misma cadena en las tres consultas de `app/api/profile/route.ts`. Las constantes `AVATAR_*` y las funciones de validación (Task 3) se consumen en el endpoint de avatar (Task 6), el `Avatar` (Task 4 vía `getInitials`) y `PasswordForm` (Task 8). La ruta `/settings` coincide en la página, el `match` del bottom-nav y el `Link` del footer.

---

## Stretch opcional (fuera del MVP)

- **Cambio de correo:** botón "Cambiar correo" que llama `supabase.auth.updateUser({ email })` y muestra "Revisá tu nuevo correo para confirmar" (Supabase envía confirmación a ambas direcciones). Requiere manejar el retorno por `/auth/callback` (ya existe).
- **Eliminar cuenta:** endpoint con `supabaseAdmin().auth.admin.deleteUser()` + confirmación fuerte.
- **Cerrar sesión en todos los dispositivos:** `supabase.auth.signOut({ scope: 'global' })`.
