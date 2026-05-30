# Documentación Oficial (`/docs`) con v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una sección de documentación oficial de producto en `/docs` (pública, estilada con la marca, su UI generada con el MCP de v0) y exponer su acceso desde la landing (header + footer) con un link "Documentación".

**Architecture:** Sección `/docs` dentro de la app Next.js (App Router), pública vía middleware. Un `app/docs/layout.tsx` provee el chrome de docs (top bar con logo + "Acceder", sidebar de navegación responsive) reutilizando componentes en `components/docs/`. La UI del chrome y los primitivos de documentación (callouts, pasos, tarjetas, prosa) se **generan con el MCP de v0** (`mcp__v0__createChat`) y se adaptan a los tokens oklch del proyecto. El contenido es **producto/usuario** (cómo usar VendorPass) en páginas TSX curadas — sin dependencias de MDX/markdown (Next 16 modificado; evitamos config riesgosa). Acceso desde la landing: link "Documentación" en `LandingHeader` (nav) y `LandingFooter`.

**Tech Stack:** Next.js 16 (App Router, server components), Tailwind v4 con tokens oklch (`app/globals.css`), lucide-react, MCP de v0 (`mcp__v0__*`), Vitest, Playwright (verificación). Sin nuevas dependencias npm.

---

## Decisiones (confirmadas con el usuario)

- **Contenido:** documentación de producto/usuario (no técnica).
- **Acceso desde la landing:** header **y** footer.
- **UI:** generada con el MCP de v0, adaptada a la marca; páginas TSX curadas (sin MDX).

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `lib/auth/public-paths.ts` | Agregar `/docs` a `PUBLIC_PREFIXES` | Modificar |
| `tests/public-paths.test.ts` | Test de que `/docs` es público | Modificar |
| `components/docs/doc-nav.ts` | Fuente única de las secciones de docs (label, href, descripción) | Crear |
| `components/docs/docs-header.tsx` | Top bar de docs: logo (→`/`) + link "Acceder"/"Ir al panel" | Crear |
| `components/docs/docs-sidebar.tsx` | Navegación lateral de secciones, responsive, item activo | Crear |
| `components/docs/doc-primitives.tsx` | Primitivos visuales: `DocCallout`, `DocSteps`, `DocCard`, `DocPageHeader` | Crear |
| `app/docs/layout.tsx` | Layout de la sección docs (header + sidebar + contenedor de prosa) | Crear |
| `app/docs/page.tsx` | Índice de documentación (overview + tarjetas a cada sección) | Crear |
| `app/docs/proveedores/page.tsx` | Guía: gestión de proveedores y estados | Crear |
| `app/docs/documentos/page.tsx` | Guía: documentos de cumplimiento + extracción IA | Crear |
| `app/docs/anclaje-arkiv/page.tsx` | Guía: anclaje en Arkiv e inmutabilidad | Crear |
| `app/docs/pasaporte/page.tsx` | Guía: pasaporte de cumplimiento y verificación | Crear |
| `app/docs/portal/page.tsx` | Guía: portal de proveedores | Crear |
| `app/docs/alertas/page.tsx` | Guía: alertas y vencimientos | Crear |
| `components/landing/landing-header.tsx` | Agregar link "Documentación" al nav | Modificar |
| `components/landing/landing-footer.tsx` | Agregar link "Documentación" | Modificar |

---

## Task 1: Hacer `/docs` público (middleware)

**Files:**
- Modify: `lib/auth/public-paths.ts`
- Modify: `tests/public-paths.test.ts`

- [ ] **Step 1: Write the failing test**

En `tests/public-paths.test.ts`, agregar dentro del `describe('isPublicPath', ...)`:
```ts
  it('treats the docs section as public', () => {
    expect(isPublicPath('/docs')).toBe(true);
    expect(isPublicPath('/docs/proveedores')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/public-paths.test.ts`
Expected: FAIL — `/docs` aún no está en los prefijos públicos.

- [ ] **Step 3: Write minimal implementation**

En `lib/auth/public-paths.ts`, agregar `'/docs'` al array `PUBLIC_PREFIXES`:
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
  '/docs',
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/public-paths.test.ts`
Expected: PASS (incluye el nuevo caso).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/public-paths.ts tests/public-paths.test.ts
git commit -m "feat: make /docs section publicly accessible"
```

---

## Task 2: Generar la UI de docs con el MCP de v0

**Files:** ninguno del repo — solo se invoca v0 y se guarda el output para el Task 3.

- [ ] **Step 1: Crear el chat de v0 con el prompt de la UI de docs**

Invocar `mcp__v0__createChat` con estos parámetros exactos:

- `modelId`: `"v0-1.5-lg"`
- `modelConfiguration`: `{ "modelId": "v0-1.5-lg", "thinking": true, "imageGenerations": false }`
- `chatPrivacy`: `"private"`
- `system`:
```
Generás la UI de una sección de documentación para un SaaS B2B en español rioplatense (voseo). Stack: Next.js App Router + Tailwind CSS + lucide-react. Usá solo Tailwind utility classes; nada de imágenes externas. Diseño limpio tipo docs (estilo Stripe/Vercel docs): top bar, sidebar de navegación a la izquierda en desktop (colapsable en mobile), y un área de contenido con prosa legible (ancho máximo ~720px). Paleta: primario indigo (#4f46e5), neutros slate, fondo slate-50, tarjetas blancas. Tipografía Inter. Mobile-first y accesible (roles/aria). Devolvé componentes separados y reutilizables.
```
- `message`:
```
Creá la UI (sin contenido real, solo el armazón y primitivos) para una sección de documentación de "VendorPass". Necesito estos componentes, cada uno exportado por nombre:

1. DocsHeader: top bar sticky con el logo de VendorPass (ícono escudo + nombre) a la izquierda y a la derecha un botón "Acceder". En mobile, un botón hamburguesa que abre/cierra el sidebar.

2. DocsSidebar: navegación lateral con una lista de secciones (recibe por props un array de items {label, href} y el pathname activo). Resalta el item activo. En desktop es fija a la izquierda; en mobile es un panel deslizable.

3. DocLayout: combina DocsHeader + DocsSidebar + un <main> con el contenido centrado (max-w-3xl) y buena tipografía de prosa para docs (títulos, párrafos, listas, links).

4. Primitivos de contenido:
   - DocPageHeader: título grande + descripción de la página.
   - DocCallout: bloque destacado con variante "info" | "tip" | "warning" (ícono lucide + texto), colores suaves.
   - DocSteps: lista numerada de pasos con círculos numerados y título+descripción por paso.
   - DocCard: tarjeta con ícono, título, descripción y link (para el índice de docs).

Texto de ejemplo en español rioplatense. Componentes tipados con TypeScript. No incluyas el contenido de las guías; solo el armazón y los primitivos reutilizables.
```

- [ ] **Step 2: Recuperar el código generado**

La respuesta de `createChat` incluye el `id` del chat y el código. Si no viene completo, llamar `mcp__v0__getChat` con ese `chatId`. Guardar el JSX/TSX de los componentes (`DocsHeader`, `DocsSidebar`, `DocLayout`, `DocPageHeader`, `DocCallout`, `DocSteps`, `DocCard`) para integrarlos en el Task 3.

- [ ] **Step 3:** (Sin commit) — este task no toca el repo.

---

## Task 3: Integrar la UI de docs (layout + primitivos)

**Files:**
- Create: `components/docs/doc-nav.ts`
- Create: `components/docs/docs-header.tsx`
- Create: `components/docs/docs-sidebar.tsx`
- Create: `components/docs/doc-primitives.tsx`
- Create: `app/docs/layout.tsx`

Reglas de adaptación del output de v0 (aplican a todos los componentes de este task):
- Reemplazar colores hex/arbitrarios por tokens del proyecto: `bg-primary`, `text-primary`, `text-primary-foreground`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-background`, `bg-secondary`, `border-border`. (El primario del proyecto ya es indigo.)
- Reemplazar cualquier `<a>` de navegación interna por `Link` de `next/link`.
- Reusar el `Button` del proyecto (`@/components/vendor-pass/button`, variants `primary | ghost | outline`) para el botón "Acceder".
- Para resaltar el item activo del sidebar, usar `usePathname()` (`next/navigation`) → el componente del sidebar debe ser `'use client'`.

- [ ] **Step 1: Crear la fuente única de navegación de docs**

`components/docs/doc-nav.ts`:
```ts
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Users, FileCheck2, Link2, BadgeCheck, UserPlus, BellRing } from 'lucide-react';

export type DocNavItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export const DOC_NAV: DocNavItem[] = [
  { label: 'Introducción', href: '/docs', description: 'Qué es VendorPass y conceptos clave.', icon: BookOpen },
  { label: 'Proveedores', href: '/docs/proveedores', description: 'Alta, gestión y estados de proveedores.', icon: Users },
  { label: 'Documentos', href: '/docs/documentos', description: 'Carga de documentos y extracción con IA.', icon: FileCheck2 },
  { label: 'Anclaje en Arkiv', href: '/docs/anclaje-arkiv', description: 'Inmutabilidad y verificación en blockchain.', icon: Link2 },
  { label: 'Pasaporte', href: '/docs/pasaporte', description: 'Pasaporte de cumplimiento verificable.', icon: BadgeCheck },
  { label: 'Portal de proveedores', href: '/docs/portal', description: 'Autogestión y aprobación.', icon: UserPlus },
  { label: 'Alertas', href: '/docs/alertas', description: 'Notificaciones de vencimiento.', icon: BellRing },
];
```

- [ ] **Step 2: Crear `docs-header.tsx`**

`components/docs/docs-header.tsx` (server component salvo que el toggle mobile requiera estado; si v0 usó estado para el sidebar mobile, ese estado vive en `docs-sidebar.tsx` o en un wrapper cliente — mantené el header simple y sin estado, con el logo y el botón "Acceder"):
```tsx
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck size={20} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-foreground">VendorPass</span>
          <span className="text-sm font-medium text-muted-foreground">Docs</span>
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Acceder</Link>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Crear `docs-sidebar.tsx`** (client, item activo)

`components/docs/docs-sidebar.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DOC_NAV } from './doc-nav';

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Secciones de documentación">
      {DOC_NAV.map(item => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Crear `doc-primitives.tsx`** (adaptado del output de v0)

`components/docs/doc-primitives.tsx`: pegar los primitivos de v0 adaptados a tokens. Debe exportar `DocPageHeader`, `DocCallout`, `DocSteps`, `DocCard` con estas firmas:
```tsx
import Link from 'next/link';
import { Info, Lightbulb, AlertTriangle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DocPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{description}</p>
    </div>
  );
}

const calloutStyles = {
  info: { icon: Info, cls: 'border-primary/30 bg-accent/50 text-foreground' },
  tip: { icon: Lightbulb, cls: 'border-[var(--status-vigente-ring)]/30 bg-[var(--status-vigente-bg)] text-[var(--status-vigente-text)]' },
  warning: { icon: AlertTriangle, cls: 'border-[var(--status-por-vencer-ring)]/30 bg-[var(--status-por-vencer-bg)] text-[var(--status-por-vencer-text)]' },
} as const;

export function DocCallout({ variant = 'info', children }: { variant?: keyof typeof calloutStyles; children: React.ReactNode }) {
  const { icon: Icon, cls } = calloutStyles[variant];
  return (
    <div className={cn('my-5 flex gap-3 rounded-xl border p-4 text-sm', cls)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="[&>p]:m-0">{children}</div>
    </div>
  );
}

export function DocSteps({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <ol className="my-6 flex flex-col gap-5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{s.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocCard({ icon: Icon, title, description, href }: { icon: LucideIcon; title: string; description: string; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30">
      <Icon size={22} className="text-primary" aria-hidden="true" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
```

- [ ] **Step 5: Crear `app/docs/layout.tsx`**

`app/docs/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { DocsHeader } from '@/components/docs/docs-header';
import { DocsSidebar } from '@/components/docs/docs-sidebar';

export const metadata: Metadata = {
  title: 'Documentación — VendorPass',
  description: 'Guía de uso de VendorPass: proveedores, documentos, anclaje en Arkiv y pasaporte de cumplimiento.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DocsHeader />
      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <DocsSidebar />
          </div>
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">{children}</main>
      </div>
    </div>
  );
}
```

Nota mobile: si el output de v0 incluyó un sidebar colapsable con botón hamburguesa, integrá ese wrapper cliente envolviendo `DocsSidebar` y colocá el botón en `DocsHeader`. Si se prefiere simplicidad para el MVP, dejar el sidebar `hidden md:block` (como arriba) es aceptable; documentar la omisión.

- [ ] **Step 6: Verify types and tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sin output; suite verde.

- [ ] **Step 7: Commit**

```bash
git add components/docs/ app/docs/layout.tsx
git commit -m "feat: docs section UI (layout, sidebar, primitives) generated with v0"
```

---

## Task 4: Escribir las páginas de documentación de producto

**Files:**
- Create: `app/docs/page.tsx` (índice)
- Create: `app/docs/proveedores/page.tsx`
- Create: `app/docs/documentos/page.tsx`
- Create: `app/docs/anclaje-arkiv/page.tsx`
- Create: `app/docs/pasaporte/page.tsx`
- Create: `app/docs/portal/page.tsx`
- Create: `app/docs/alertas/page.tsx`

Cada página usa `DocPageHeader` y los primitivos. El contenido es real (abajo se da el contenido concreto por página). Todas son server components estáticas.

- [ ] **Step 1: Índice `app/docs/page.tsx`**

```tsx
import { DocPageHeader, DocCard } from '@/components/docs/doc-primitives';
import { DOC_NAV } from '@/components/docs/doc-nav';

export default function DocsIndexPage() {
  const sections = DOC_NAV.filter(i => i.href !== '/docs');
  return (
    <>
      <DocPageHeader
        title="Documentación de VendorPass"
        description="Aprendé a gestionar el cumplimiento de tus proveedores con respaldo verificable en blockchain."
      />
      <p className="text-sm text-muted-foreground">
        VendorPass centraliza los documentos de cumplimiento de tus proveedores (seguros, certificados,
        habilitaciones), calcula su estado de vigencia automáticamente y los ancla en Arkiv Network para
        que cualquiera pueda verificar su autenticidad e inmutabilidad.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map(s => (
          <DocCard key={s.href} icon={s.icon} title={s.label} description={s.description} href={s.href} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: `app/docs/proveedores/page.tsx`**

Contenido (escribir con `DocPageHeader`, párrafos, `DocSteps`, `DocCallout`):
- Header: título "Proveedores", descripción "Dá de alta y gestioná tus proveedores y su estado de cumplimiento."
- Sección "Estados de cumplimiento": explicar los tres estados que VendorPass calcula automáticamente a partir de los documentos: **Vigente** (todo en regla), **Por vencer** (algún documento vence pronto), **Vencido/Bloqueado** (documento vencido). El estado del proveedor es el peor estado entre sus documentos.
- `DocSteps` "Dar de alta un proveedor": 1. Entrá a "Proveedores" → "Nuevo proveedor". 2. Completá nombre y datos de contacto. 3. Guardá: el proveedor aparece con estado inicial según sus documentos.
- `DocCallout` variant="tip": "El estado se recalcula solo cada vez que agregás, renovás o vence un documento — no hay que actualizarlo a mano."

- [ ] **Step 3: `app/docs/documentos/page.tsx`**

- Header: título "Documentos de cumplimiento", descripción "Cargá documentos con fecha de vencimiento y dejá que la IA precargue los datos."
- Sección "Tipos de documento": seguros, certificados, habilitaciones u otros, cada uno con fecha de vencimiento que determina su vigencia.
- `DocSteps` "Subir un documento": 1. Desde el proveedor, "Agregar documento". 2. Subí el PDF o imagen. 3. La IA extrae tipo, fechas y datos clave y precarga el formulario. 4. Revisá y confirmá.
- Sección "Extracción con IA": explicar que al subir un PDF/foto, VendorPass usa IA de visión para leer el documento y precargar tipo, fecha de emisión/vencimiento y número de póliza; el humano siempre confirma antes de guardar.
- `DocCallout` variant="info": "La IA acelera la carga, pero los datos siempre quedan sujetos a tu confirmación."

- [ ] **Step 4: `app/docs/anclaje-arkiv/page.tsx`**

- Header: título "Anclaje en Arkiv", descripción "Hacé que tus documentos sean inmutables y verificables en blockchain."
- Sección "¿Qué es anclar?": al anclar un documento, VendorPass registra su huella (hash) y metadatos en Arkiv Network. Queda una prueba criptográfica de su existencia y contenido en un momento dado, imposible de alterar.
- Sección "Ciclo de vida": borrador → pendiente de anclaje → anclado. Una vez anclado, el documento es inmutable (sus campos clave no se pueden modificar).
- `DocSteps` "Anclar un documento": 1. El documento debe tener su archivo y huella calculados. 2. Aprobá/anclá desde la ficha del documento. 3. VendorPass registra la entidad en Arkiv y guarda la referencia.
- `DocCallout` variant="warning": "El anclaje es irreversible: un documento anclado no puede editarse. Para cambios, se genera una nueva versión que reemplaza a la anterior."

- [ ] **Step 5: `app/docs/pasaporte/page.tsx`**

- Header: título "Pasaporte de cumplimiento", descripción "Compartí un resumen verificable del estado de un proveedor."
- Sección "Qué incluye": el pasaporte es un PDF con el estado del proveedor, sus documentos vigentes y un enlace/QR de verificación pública respaldado por Arkiv.
- Sección "Verificación pública": cualquier tercero puede verificar el pasaporte sin tener cuenta en VendorPass, contrastando la huella contra Arkiv.
- `DocSteps` "Generar y compartir": 1. Desde el proveedor, abrí la pestaña "Pasaporte". 2. Generá el PDF. 3. Compartí el enlace o el QR con quien lo necesite.

- [ ] **Step 6: `app/docs/portal/page.tsx`**

- Header: título "Portal de proveedores", descripción "Dejá que tus proveedores carguen y renueven sus propios documentos."
- Sección "Cómo funciona": invitás a un proveedor por correo; este accede a un portal de autogestión donde sube documentos que luego revisás y aprobás (y opcionalmente anclás).
- `DocSteps` "Invitar a un proveedor": 1. Desde el proveedor, "Portal" → "Invitar". 2. Ingresá el correo del contacto. 3. El proveedor recibe un enlace para acceder y cargar documentos. 4. Revisás y aprobás lo que envía.
- `DocCallout` variant="info": "Los documentos enviados por el portal entran como 'enviados' y requieren tu aprobación antes de contar para el estado de cumplimiento."

- [ ] **Step 7: `app/docs/alertas/page.tsx`**

- Header: título "Alertas y vencimientos", descripción "Enterate antes de que un documento venza."
- Sección "Vencimientos": VendorPass marca los documentos "Por vencer" según su fecha y los lista en la sección Vencimientos.
- Sección "Notificaciones por correo": se envían avisos automáticos cuando un documento está por vencer o ya venció.
- `DocCallout` variant="tip": "Revisá la sección Vencimientos del panel para ver de un vistazo todo lo que requiere atención."

- [ ] **Step 8: Verify types and tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sin output; suite verde.

- [ ] **Step 9: Commit**

```bash
git add app/docs/
git commit -m "docs: add product/user documentation pages under /docs"
```

---

## Task 5: Exponer el acceso a docs desde la landing

**Files:**
- Modify: `components/landing/landing-header.tsx`
- Modify: `components/landing/landing-footer.tsx`

- [ ] **Step 1: Agregar "Documentación" al nav del header**

En `components/landing/landing-header.tsx`, dentro del `<nav>` (después del link "Arkiv", línea ~23-25), agregar:
```tsx
          <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Documentación
          </Link>
```
(El archivo ya importa `Link` de `next/link`. Los `#features`/`#como-funciona`/`#arkiv` son anclas internas y siguen como `<a>`; "Documentación" es navegación de ruta, por eso usa `Link`.)

- [ ] **Step 2: Agregar "Documentación" al footer**

En `components/landing/landing-footer.tsx`, dentro del `<div>` de links (líneas 17-24), agregar antes de "Acceder":
```tsx
          <Link href="/docs" className="hover:text-foreground">
            Documentación
          </Link>
```

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sin output; suite verde.

- [ ] **Step 4: Commit**

```bash
git add components/landing/landing-header.tsx components/landing/landing-footer.tsx
git commit -m "feat: link to /docs from landing header and footer"
```

---

## Task 6: Verificación end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar la app**

Run: `npm run dev`. Esperar a que compile.

- [ ] **Step 2: Verificar acceso desde la landing (Playwright MCP, sin sesión)**

- Navegar a `http://localhost:3000/`.
- Confirmar que el header muestra el link **"Documentación"** y el footer también.
- Click en "Documentación" → debe navegar a `/docs` sin pedir login (ruta pública).

- [ ] **Step 3: Verificar la sección de docs**

- En `/docs`: se ve el índice (tarjetas de secciones), el sidebar con las 7 secciones, y el top bar con "Acceder".
- Navegar a cada sección (`/docs/proveedores`, `/docs/documentos`, `/docs/anclaje-arkiv`, `/docs/pasaporte`, `/docs/portal`, `/docs/alertas`): cada una renderiza su contenido y el item activo del sidebar se resalta.
- Click en "Acceder" del top bar → va a `/login`.
- Tomar screenshot del índice y de una página de sección para revisión visual.

- [ ] **Step 4: Verificar que sigue protegido lo privado**

- Navegar a `/dashboard` sin sesión → redirige a `/login?next=/dashboard` (no afectado por los cambios).

- [ ] **Step 5: Suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; toda la suite verde.

---

## Self-Review (completado por el autor del plan)

- **Spec coverage:** Documentación oficial creada (Tasks 3-4, sección `/docs` con índice + 6 guías de producto) ✓ · Acceso desde la landing (Task 5, header + footer) ✓ · Uso del MCP de v0 (Task 2 genera la UI; Task 3 la integra) ✓.
- **Routing:** `/docs` público vía middleware con test (Task 1) ✓; no se toca la protección de `/dashboard` ni otras rutas.
- **Sin dependencias nuevas:** páginas TSX curadas; se evita MDX por el Next 16 modificado (AGENTS.md) ✓.
- **Placeholders:** el único bloque generado en runtime es el output de v0 (Task 2→3), inherente a la generación; se incluyen firmas completas y un fallback de primitivos como red de seguridad. El contenido de las 6 guías está especificado con texto real por sección (Task 4), no como "TODO".
- **Type/Prop consistency:** `DocNavItem` (label/href/description/icon) consumido por `DocsSidebar`, `DocCard` (índice) y `doc-nav.ts`. `DocCallout` variants `info|tip|warning` usados consistentemente en las guías. `DocsSidebar` es `'use client'` por `usePathname()`. `Button` variants (`primary|ghost|outline`) confirmados en `components/vendor-pass/button.tsx`.
