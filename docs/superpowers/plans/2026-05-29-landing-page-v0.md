# Landing Page Comercial con v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una landing page pública y comercial para VendorPass usando el MCP server de v0, montarla en la raíz `/`, y mover el dashboard actual a `/dashboard`, con un header que muestre el botón "Acceder".

**Architecture:** El dashboard protegido (hoy en `app/page.tsx`) se mueve a `app/dashboard/page.tsx`. La raíz `/` pasa a ser una landing pública (server component, sin `AppShell`). El middleware deja `/` público. La landing lee la sesión: si hay usuario muestra "Ir al panel" (→`/dashboard`), si no muestra "Acceder" (→`/login`). El contenido visual se genera con v0 (`mcp__v0__createChat`) y se adapta al codebase reusando el `Button` existente, `next/link`, y los tokens de marca oklch del proyecto.

**Tech Stack:** Next.js (App Router, server components), Tailwind v4 con tokens oklch (`app/globals.css`), lucide-react, Supabase SSR (`@/lib/supabase/server`), MCP de v0 (`mcp__v0__*`), Vitest, Playwright (verificación).

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `app/dashboard/page.tsx` | Dashboard autenticado (contenido actual de `app/page.tsx`) | Crear (mover) |
| `app/page.tsx` | Landing pública comercial | Reescribir |
| `components/landing/landing-header.tsx` | Header sticky con logo + CTA "Acceder"/"Ir al panel" | Crear |
| `components/landing/landing-footer.tsx` | Footer comercial | Crear |
| `components/landing/landing-sections.tsx` | Secciones de marketing (hero, features, how-it-works, CTA) generadas con v0 y adaptadas | Crear |
| `middleware.ts` | Routing: `/` público; refactor de `isPublicPath` exportable | Modificar |
| `lib/auth/public-paths.ts` | Lógica pura `isPublicPath()` (extraída de middleware para testear) | Crear |
| `components/vendor-pass/sidebar.tsx` | Link "Dashboard" `/` → `/dashboard` | Modificar (línea 10) |
| `components/vendor-pass/bottom-nav.tsx` | Link "Inicio" `/` → `/dashboard` | Modificar (línea 11) |
| `app/(auth)/login/page.tsx` | Default `next ?? '/'` → `/dashboard` | Modificar (línea 19) |
| `app/(auth)/register/page.tsx` | Default `next ?? '/'` → `/dashboard` | Modificar (línea 25) |
| `app/auth/callback/page.tsx` | Default `next ?? '/'` → `/dashboard` | Modificar (línea 50) |
| `lib/auth/redirect.ts` | Default param `next = '/'` → `/dashboard` | Modificar (línea 2) |
| `tests/public-paths.test.ts` | Tests de `isPublicPath` | Crear |

---

## Task 1: Extraer y testear `isPublicPath` (preparación del routing)

**Files:**
- Create: `lib/auth/public-paths.ts`
- Create: `tests/public-paths.test.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Write the failing test**

`tests/public-paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isPublicPath } from '@/lib/auth/public-paths';

describe('isPublicPath', () => {
  it('treats the landing root as public', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('treats auth routes as public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/register')).toBe(true);
    expect(isPublicPath('/verify/abc-123')).toBe(true);
  });

  it('treats the dashboard as protected', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
  });

  it('treats app sections as protected', () => {
    expect(isPublicPath('/vendors')).toBe(false);
    expect(isPublicPath('/integrations')).toBe(false);
  });

  it('does not let the root prefix-match every path', () => {
    expect(isPublicPath('/vendors/123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/public-paths.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/public-paths'`.

- [ ] **Step 3: Write minimal implementation**

`lib/auth/public-paths.ts`:
```ts
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify',
  '/portal/accept',
];

/** `/` (landing) is public by exact match; the rest match by prefix. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/public-paths.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Refactor middleware to use the shared helper**

In `middleware.ts`, delete the inline `PUBLIC_PREFIXES` array and the inline `isPublicPath` function, and import the shared one. Replace the top of the file:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isPublicPath } from '@/lib/auth/public-paths';
```

(Remove the old `const PUBLIC_PREFIXES = [...]` and `function isPublicPath(...)` blocks.)

Then update the authenticated-redirect block so logged-in users on `/login` or `/register` go to `/dashboard` by default (NOT `/`, which is now the landing):

```ts
  if (isPublicPath(pathname)) {
    if (user && (pathname === '/login' || pathname === '/register')) {
      const next = request.nextUrl.searchParams.get('next') ?? '/dashboard';
      return NextResponse.redirect(new URL(next, request.url));
    }
    return supabaseResponse;
  }
```

Note: `/` is intentionally NOT auto-redirected for authenticated users — the landing adapts its CTA instead (Task 4), which is better for demos.

- [ ] **Step 6: Verify the full suite still passes and types are clean**

Run: `npx tsc --noEmit && npm test`
Expected: tsc no output; all tests pass (existing + 5 new).

- [ ] **Step 7: Commit**

```bash
git add lib/auth/public-paths.ts tests/public-paths.test.ts middleware.ts
git commit -m "refactor: extract testable isPublicPath and make / public for landing"
```

---

## Task 2: Mover el dashboard a `/dashboard` y actualizar enlaces

**Files:**
- Create: `app/dashboard/page.tsx` (mover contenido de `app/page.tsx`)
- Modify: `components/vendor-pass/sidebar.tsx:10`
- Modify: `components/vendor-pass/bottom-nav.tsx:11`
- Modify: `app/(auth)/login/page.tsx:19`
- Modify: `app/(auth)/register/page.tsx:25`
- Modify: `app/auth/callback/page.tsx:50`
- Modify: `lib/auth/redirect.ts:2`

- [ ] **Step 1: Move the dashboard file**

```bash
git mv app/page.tsx app/dashboard/page.tsx
```

The moved file keeps `export const dynamic = 'force-dynamic'` and its default export. Rename the component for clarity (optional but recommended): in `app/dashboard/page.tsx`, the function is already `DashboardPage` — leave as is.

- [ ] **Step 2: Update the sidebar Dashboard link**

In `components/vendor-pass/sidebar.tsx` line 10, change:
```ts
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, match: (p: string) => p === '/' },
```
to:
```ts
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
```

- [ ] **Step 3: Update the bottom-nav Inicio link**

In `components/vendor-pass/bottom-nav.tsx` line 11, change:
```ts
  { label: 'Inicio', href: '/', icon: LayoutDashboard, match: (p: string) => p === '/' },
```
to:
```ts
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
```

- [ ] **Step 4: Update the post-auth redirect defaults**

In `app/(auth)/login/page.tsx` line 19, change `const next = searchParams.get('next') ?? '/';` to `const next = searchParams.get('next') ?? '/dashboard';`

In `app/(auth)/register/page.tsx` line 25, change `const next = searchParams.get('next') ?? '/';` to `const next = searchParams.get('next') ?? '/dashboard';`

In `app/auth/callback/page.tsx` line 50, change `const next = searchParams.get('next') ?? '/';` to `const next = searchParams.get('next') ?? '/dashboard';`

In `lib/auth/redirect.ts` line 2, change `export function authCallbackUrl(next = '/') {` to `export function authCallbackUrl(next = '/dashboard') {`

- [ ] **Step 5: Catch any remaining hard-coded dashboard links**

Run: `grep -rn "href=\"/\"\|href={\`/\`}\|?? '/'\|next !== '/'" app/ components/ lib/ --include="*.tsx" --include="*.ts"`

Review each hit. The `next !== '/'` comparisons in login/register (link-building to switch between login/register) should become `next !== '/dashboard'`. Update those two:
- `app/(auth)/login/page.tsx:124` — `${next !== '/' ? ...}` → `${next !== '/dashboard' ? ...}`
- `app/(auth)/register/page.tsx:222` — `${next !== '/' ? ...}` → `${next !== '/dashboard' ? ...}`

Any other `href="/"` that is a logo/home link pointing at the app should point to `/dashboard` if it's inside authenticated chrome; leave landing links alone (none exist yet).

- [ ] **Step 6: Verify build and tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc no output; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx components/vendor-pass/sidebar.tsx components/vendor-pass/bottom-nav.tsx app/\(auth\)/login/page.tsx app/\(auth\)/register/page.tsx app/auth/callback/page.tsx lib/auth/redirect.ts
git commit -m "refactor: move dashboard from / to /dashboard and update all internal links"
```

---

## Task 3: Generar el contenido de la landing con el MCP de v0

**Files:** ninguno del repo en este task — solo se invoca v0 y se guarda el output para el Task 4.

- [ ] **Step 1: Crear el chat de v0 con el prompt de la landing**

Invocar `mcp__v0__createChat` con estos parámetros exactos:

- `modelId`: `"v0-1.5-lg"`
- `modelConfiguration`: `{ "modelId": "v0-1.5-lg", "thinking": true, "imageGenerations": false }`
- `chatPrivacy`: `"private"`
- `system`:
```
Generás una landing page comercial para un SaaS B2B en español (Argentina, voseo). Stack: Next.js App Router + Tailwind CSS. Usá solo Tailwind utility classes y lucide-react para íconos. NO uses imágenes externas ni placeholders de imagen; usá composiciones con divs, gradientes e íconos. Diseño moderno, limpio, con mucho espacio en blanco, tipografía Inter. Paleta: primario indigo (#4f46e5), neutros slate, fondo slate-50. Mobile-first y totalmente responsive. Devolvé un único componente de sección reutilizable sin header ni footer (esos los maneja la app aparte).
```
- `message`:
```
Creá las SECCIONES de contenido (sin <header> ni <footer>, sin nav) de una landing page para "VendorPass", un SaaS de gestión de cumplimiento documental de proveedores cuyo diferencial es anclar los documentos en la blockchain de Arkiv Network para hacerlos verificables e inmutables.

Incluí estas secciones, en orden:

1. HERO: título grande "El cumplimiento de tus proveedores, verificable en blockchain", subtítulo explicando que VendorPass centraliza documentos de proveedores (seguros, certificados, habilitaciones), los ancla en Arkiv y genera un pasaporte de cumplimiento verificable por cualquiera. Dos botones: primario "Crear cuenta gratis" y secundario "Acceder". Debajo, una fila de microcopy de confianza ("Anclaje inmutable en Arkiv · Pasaporte PDF verificable · Auditable por terceros").

2. PROBLEMA → SOLUCIÓN: 3 puntos de dolor (documentos vencidos sin aviso, certificados falsificables, auditorías manuales lentas) contrastados con cómo VendorPass los resuelve.

3. FEATURES (grid de 6 tarjetas con ícono lucide, título y descripción corta):
   - Pasaporte de cumplimiento: PDF verificable con QR y hash anclado.
   - Anclaje en Arkiv: cada documento queda inmutable y auditable en blockchain.
   - Portal de proveedores: autogestión para que el proveedor suba y renueve documentos.
   - Alertas de vencimiento: notificaciones automáticas antes de que algo venza.
   - Historial inmutable: línea de tiempo de eventos de cada documento, imposible de alterar.
   - IA de extracción: subís un PDF y la IA extrae tipo, fechas y datos para precargar el formulario.

4. CÓMO FUNCIONA: 4 pasos numerados (1. Cargás proveedores y documentos · 2. La IA extrae y precarga los datos · 3. Anclás el documento en Arkiv · 4. Compartís el pasaporte verificable).

5. DIFERENCIAL ARKIV: bloque destacado explicando por qué el anclaje en blockchain hace la diferencia (verificable por terceros sin confiar en VendorPass, prueba criptográfica de existencia y vigencia).

6. CTA FINAL: título "Empezá a gestionar el cumplimiento con respaldo blockchain", botón primario "Crear cuenta gratis".

Usá un componente exportado por defecto llamado LandingSections. Texto en español rioplatense. Sin lorem ipsum: usá el copy real indicado.
```

- [ ] **Step 2: Recuperar el código generado**

La respuesta de `createChat` incluye un `id` de chat y el contenido generado. Si el código no viene completo en la respuesta, llamar `mcp__v0__getChat` con ese `chatId` para obtener los archivos/bloques de código finales. Guardar el JSX de `LandingSections` (clases Tailwind + lucide-react) para usarlo en el Task 4.

- [ ] **Step 3: (Sin commit)** Este task no toca el repo. El output de v0 se integra en el Task 4.

---

## Task 4: Integrar la landing en `/` (header con "Acceder", footer, secciones)

**Files:**
- Create: `components/landing/landing-header.tsx`
- Create: `components/landing/landing-footer.tsx`
- Create: `components/landing/landing-sections.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Crear el header con el CTA condicional**

`components/landing/landing-header.tsx`:
```tsx
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function LandingHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck size={20} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-foreground">VendorPass</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Secciones">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Funciones</a>
          <a href="#como-funciona" className="text-sm font-medium text-muted-foreground hover:text-foreground">Cómo funciona</a>
          <a href="#arkiv" className="text-sm font-medium text-muted-foreground hover:text-foreground">Arkiv</a>
        </nav>

        <div className="flex items-center gap-2">
          {authenticated ? (
            <Button variant="primary" size="sm" asChild>
              <Link href="/dashboard">Ir al panel</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Acceder</Link>
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

Note: `Button` (`components/vendor-pass/button.tsx`) soporta `variant`: `primary | secondary | ghost | outline | link`, `size`, y `asChild` — los variants usados aquí (`ghost`, `primary`, `outline`) están confirmados.

- [ ] **Step 2: Crear el footer**

`components/landing/landing-footer.tsx`:
```tsx
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck size={18} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">VendorPass</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cumplimiento de proveedores verificable</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">Acceder</Link>
          <Link href="/register" className="hover:text-foreground">Crear cuenta</Link>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 VendorPass</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Crear `LandingSections` a partir del output de v0**

`components/landing/landing-sections.tsx`: pegar el JSX generado por v0 en el Task 3, adaptándolo así:
- Encabezar el archivo con la sección hero envuelta en `<section>` y, si v0 generó botones, reemplazarlos por `next/link` apuntando a `/register` ("Crear cuenta gratis") y `/login` ("Acceder").
- Reemplazar cualquier color hex/clase arbitraria por los tokens del proyecto: `bg-primary`, `text-primary`, `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-background`. (El primario del proyecto YA es indigo, así que `bg-primary` produce el indigo correcto.)
- Asegurar IDs de ancla para el header: la sección de features debe tener `id="features"`, la de pasos `id="como-funciona"`, la de Arkiv `id="arkiv"`.
- Usar íconos de `lucide-react` (ya es dependencia).
- Exportar `export function LandingSections() { ... }`.

Estructura mínima esperada (si hay que escribir a mano por output incompleto de v0), como referencia de envoltorio:
```tsx
import Link from 'next/link';
import {
  ShieldCheck, FileCheck2, BellRing, History, Sparkles, Users, Link2,
} from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function LandingSections() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          El cumplimiento de tus proveedores, verificable en blockchain
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          VendorPass centraliza los documentos de tus proveedores, los ancla en Arkiv Network
          y genera un pasaporte de cumplimiento que cualquiera puede verificar.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="primary" size="lg" asChild>
            <Link href="/register">Crear cuenta gratis</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Acceder</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Anclaje inmutable en Arkiv · Pasaporte PDF verificable · Auditable por terceros
        </p>
      </section>
      {/* Pegar aquí el resto de secciones de v0: problema/solución, #features, #como-funciona, #arkiv, CTA final */}
    </>
  );
}
```

- [ ] **Step 4: Crear la nueva landing en `app/page.tsx`**

`app/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LandingHeader } from '@/components/landing/landing-header';
import { LandingSections } from '@/components/landing/landing-sections';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata: Metadata = {
  title: 'VendorPass — Cumplimiento de proveedores verificable en blockchain',
  description:
    'Centralizá los documentos de tus proveedores, anclalos en Arkiv Network y compartí un pasaporte de cumplimiento verificable e inmutable.',
};

export default async function LandingPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader authenticated={!!user} />
      <main className="flex-1">
        <LandingSections />
      </main>
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 5: Verify types and tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc no output; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/landing/
git commit -m "feat: public commercial landing page at / with Acceder CTA in header"
```

---

## Task 5: Verificación end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar la app**

Run: `npm run dev` (o el script de dev del proyecto). Esperar a que compile.

- [ ] **Step 2: Verificar la landing pública sin sesión (Playwright MCP)**

- Navegar a `http://localhost:3000/` (ajustar puerto).
- Confirmar que renderiza la landing (hero "El cumplimiento de tus proveedores, verificable en blockchain"), NO el dashboard ni redirección a `/login`.
- Confirmar que el header muestra el botón **"Acceder"** (link a `/login`) y "Crear cuenta" (link a `/register`).
- Tomar screenshot para revisión visual.

- [ ] **Step 3: Verificar el routing del dashboard**

- Navegar a `http://localhost:3000/dashboard` sin sesión → debe redirigir a `/login?next=/dashboard`.
- Iniciar sesión con un usuario válido → debe aterrizar en `/dashboard` y mostrar el dashboard (KPIs, proveedores).
- Con sesión activa, navegar a `/` → la landing debe mostrar el botón **"Ir al panel"** (→`/dashboard`) en vez de "Acceder".

- [ ] **Step 4: Verificar navegación interna**

- En el dashboard, el item "Dashboard"/"Inicio" del sidebar y bottom-nav debe apuntar a `/dashboard` y marcarse activo allí.
- Click en "Acceder" desde la landing (en ventana sin sesión) lleva a `/login`.

- [ ] **Step 5: Suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; toda la suite verde.

---

## Self-Review (completado por el autor del plan)

- **Spec coverage:** Landing con estilo y contenido comercial (Task 3 prompt v0 + Task 4 integración) ✓ · Aplicada como home/landing a visualizar en `/` (Task 4 `app/page.tsx`, Task 1 middleware público) ✓ · Header con opción "Acceder" (Task 4 `LandingHeader`) ✓ · Uso del MCP de v0 (Task 3) ✓.
- **Routing colateral:** dashboard movido y todos los enlaces conocidos actualizados (Task 2 + grep de barrido en Step 5) ✓.
- **Placeholders:** el único bloque "pegar aquí" es la salida de v0 (Task 4 Step 3), que es inherente a la generación en runtime; se incluye un envoltorio hero completo y reglas de adaptación concretas como red de seguridad.
- **Type/Prop consistency:** `LandingHeader` recibe `authenticated: boolean`; `app/page.tsx` lo pasa como `!!user`. Variants de `Button` (`primary`/`ghost`/`outline`/`link`) confirmados en `components/vendor-pass/button.tsx`.
