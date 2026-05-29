# Verificación de Integridad del Archivo (Hash) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el circuito de `file_hash` en la página pública de verificación: además de **mostrar** el hash SHA-256 ya registrado, permitir que cualquiera **suba el PDF/imagen que tiene en mano** y comprobar activamente si es **el mismo archivo** que se registró. Resultado claro: **coincide / no coincide / no hay hash registrado**. La fuente de verdad del hash es la validación anclada en Arkiv.

**Architecture:** Una librería de hashing con **funciones puras** (`lib/crypto/file-hash.ts`): `sha256Hex(buffer)` en Node y `hashFileBrowser(file)` con Web Crypto (`crypto.subtle`) en el cliente — testeables con vectores conocidos (TDD). Un endpoint **público** `POST /api/verify/[documentId]/check-hash` que lee el `fileHash` esperado vía `resolveValidationLookup` (Arkiv primero, Postgres como respaldo) y compara contra (a) un archivo recibido por multipart o (b) el `fileUrl` descargado en el servidor (límite 10MB, timeout). Un componente cliente `hash-verify-panel.tsx` integrado en `app/verify/[documentId]/page.tsx` que hashea en el navegador (privacidad: el archivo no sale del equipo si se usa el camino cliente) y, si no hay archivo registrado, muestra "no verificable" sin romper el resto de la página. La ruta `/verify/*` ya es pública en el middleware. Rate limit por IP en memoria para el endpoint de comprobación.

**Tech Stack:** Next.js 16.2.6 (App Router, route handlers con `params: Promise<…>`), Node `crypto` (`createHash`), Web Crypto (`crypto.subtle.digest`) en el cliente, Arkiv (`@/lib/arkiv/lookup` → `resolveValidationLookup`), `lib/storage/s3.ts` (`MAX_BYTES`, `isAllowedMime`), TypeScript, Vitest. Sin dependencias nuevas.

**Dependencias:** Feature 2 (lifecycle+anchor): el hash se fija al anclar y no debe cambiar post-anchor. Campos inmutables tras anchor: `issued_at`, `expires_at`, `file_hash`, `document_type`. Esta feature **asume** ese invariante y, como nota de integración, declara que el anchor debe exigir `file_hash` cuando hay `file_url` (ver Task 6 — nota, no implementación). No se espera migración nueva para esta feature.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/crypto/file-hash.ts` (crear) | Hashing SHA-256: `sha256Hex(buffer)` (Node) + `hashFileBrowser(file)` (Web Crypto) + `normalizeHash` — funciones puras/testeables |
| `tests/file-hash.test.ts` (crear) | Tests TDD con vectores conocidos: match, mismatch, normalización |
| `app/api/verify/[documentId]/check-hash/route.ts` (crear) | `POST` público: lee hash esperado de Arkiv; compara contra archivo subido o `fileUrl` descargado; rate limit por IP |
| `lib/crypto/rate-limit.ts` (crear) | Rate limiter por IP en memoria (ventana fija), reutilizable; funciones puras testeables |
| `components/vendor-pass/hash-verify-panel.tsx` (crear) | UI cliente: subir archivo → hashear en navegador → comparar → match/mismatch/sin hash |
| `app/verify/[documentId]/page.tsx` (modificar) | Integrar `<HashVerifyPanel>` debajo del hash mostrado |
| `tests/check-hash-route.test.ts` (crear) | Tests del rate limiter y de la lógica de comparación (vectores) |

---

## Task 1: Librería de hashing (TDD)

Funciones puras de hashing. **Primero los tests**, luego la implementación.

**Files:**
- Create: `lib/crypto/file-hash.ts`
- Test: `tests/file-hash.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Vectores conocidos de SHA-256 (verificables con `echo -n "abc" | sha256sum`):
- `""` (cadena vacía) → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `"abc"` → `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`

Create `tests/file-hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sha256Hex, normalizeHash, hashesMatch } from '@/lib/crypto/file-hash';

const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256Hex', () => {
  it('hashea la cadena vacía con el vector conocido', () => {
    expect(sha256Hex(Buffer.from(''))).toBe(EMPTY);
  });
  it('hashea "abc" con el vector conocido', () => {
    expect(sha256Hex(Buffer.from('abc', 'utf8'))).toBe(ABC);
  });
  it('devuelve 64 chars hex en minúscula', () => {
    expect(sha256Hex(Buffer.from('vendorpass'))).toMatch(/^[a-f0-9]{64}$/);
  });
  it('un byte distinto cambia el hash (mismatch)', () => {
    expect(sha256Hex(Buffer.from('abc'))).not.toBe(sha256Hex(Buffer.from('abd')));
  });
});

describe('normalizeHash', () => {
  it('pasa a minúscula y recorta espacios', () => {
    expect(normalizeHash(`  ${ABC.toUpperCase()}  `)).toBe(ABC);
  });
  it('quita el prefijo sha256: si está presente', () => {
    expect(normalizeHash(`sha256:${ABC}`)).toBe(ABC);
  });
  it('devuelve null para entradas vacías o nulas', () => {
    expect(normalizeHash('')).toBeNull();
    expect(normalizeHash(null)).toBeNull();
    expect(normalizeHash('   ')).toBeNull();
  });
});

describe('hashesMatch', () => {
  it('compara de forma insensible a mayúsculas y prefijos', () => {
    expect(hashesMatch(ABC, ABC.toUpperCase())).toBe(true);
    expect(hashesMatch(`sha256:${ABC}`, ABC)).toBe(true);
  });
  it('detecta mismatch', () => {
    expect(hashesMatch(ABC, EMPTY)).toBe(false);
  });
  it('es false si alguno es null/vacío', () => {
    expect(hashesMatch(null, ABC)).toBe(false);
    expect(hashesMatch(ABC, '')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/file-hash.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/crypto/file-hash'".

- [ ] **Step 3: Implementar**

`hashFileBrowser` usa Web Crypto (`crypto.subtle`), disponible en el navegador; se incluye en este módulo porque es parte del contrato de hashing, pero **solo se importa desde código cliente**. `sha256Hex`/`normalizeHash`/`hashesMatch` son las que cubren los tests (Node).

Create `lib/crypto/file-hash.ts`:

```typescript
import { createHash } from 'crypto';

/** SHA-256 de un buffer en hex minúscula (64 chars). Fuente de verdad del hashing en servidor. */
export function sha256Hex(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Normaliza un hash para comparar: minúscula, sin espacios, sin prefijo `sha256:`. */
export function normalizeHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const trimmed = hash.trim().toLowerCase().replace(/^sha256:/, '');
  return trimmed.length ? trimmed : null;
}

/** Compara dos hashes de forma tolerante (mayúsculas/prefijo). false si alguno falta. */
export function hashesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeHash(a);
  const nb = normalizeHash(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Calcula el SHA-256 de un File en el navegador usando Web Crypto.
 * IMPORTANTE: solo usar desde componentes cliente; `crypto.subtle` no existe en el server.
 */
export async function hashFileBrowser(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/file-hash.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/file-hash.ts tests/file-hash.test.ts
git commit -m "feat(crypto): hashing SHA-256 (Node + navegador) con tests de vectores conocidos"
```

---

## Task 2: Rate limiter por IP (TDD)

Limitador en memoria (ventana fija) para el endpoint público de comprobación. Función pura para testear sin tiempo real (se inyecta `now`).

**Files:**
- Create: `lib/crypto/rate-limit.ts`
- Test: `tests/check-hash-route.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/check-hash-route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '@/lib/crypto/rate-limit';

describe('createRateLimiter', () => {
  it('permite hasta el límite y luego bloquea dentro de la ventana', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    let now = 0;
    const ip = '1.2.3.4';
    expect(limiter.check(ip, now).allowed).toBe(true);
    expect(limiter.check(ip, now).allowed).toBe(true);
    expect(limiter.check(ip, now).allowed).toBe(true);
    const blocked = limiter.check(ip, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('reinicia la cuenta al pasar la ventana', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    const ip = '5.6.7.8';
    expect(limiter.check(ip, 0).allowed).toBe(true);
    expect(limiter.check(ip, 500).allowed).toBe(false);
    expect(limiter.check(ip, 1001).allowed).toBe(true);
  });

  it('aísla los contadores por IP', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/check-hash-route.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/crypto/rate-limit'".

- [ ] **Step 3: Implementar**

Create `lib/crypto/rate-limit.ts`:

```typescript
export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter de ventana fija en memoria. `now` es inyectable para testear sin reloj real.
 * Nota: el estado es por instancia de proceso (suficiente para protección básica en dev/SSR).
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  function check(key: string, now: number = Date.now()): RateLimitResult {
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.limit - 1, retryAfterMs: 0 };
    }
    if (bucket.count >= options.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
    }
    bucket.count += 1;
    return { allowed: true, remaining: options.limit - bucket.count, retryAfterMs: 0 };
  }

  return { check };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/check-hash-route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/rate-limit.ts tests/check-hash-route.test.ts
git commit -m "feat(crypto): rate limiter por IP en memoria con tests"
```

---

## Task 3: Endpoint público `POST /api/verify/[documentId]/check-hash`

Lee el hash esperado vía `resolveValidationLookup` (Arkiv primero, Postgres de respaldo). Compara contra (a) archivo recibido por multipart o (b) `fileUrl` descargado en el servidor. Público (sin auth, igual que `/api/verify/[documentId]`). Rate limit por IP.

**Files:**
- Create: `app/api/verify/[documentId]/check-hash/route.ts`

- [ ] **Step 1: Crear el endpoint**

Respuesta uniforme:
- `{ result: 'no_hash_registered', expectedHash: null }` si la entidad no tiene `fileHash`.
- `{ result: 'match' | 'mismatch', expectedHash, computedHash, source }` tras comparar.
- `source: 'arkiv' | 'postgres'` según de dónde salió el hash esperado (la fuente de verdad es Arkiv; si vino de Postgres se marca para reflejar posible desincronización).

Create `app/api/verify/[documentId]/check-hash/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { resolveValidationLookup } from '@/lib/arkiv/lookup';
import { getStoreSource } from '@/lib/arkiv/validations';
import { normalizeEvidenceUrl } from '@/lib/storage/evidence-url';
import { sha256Hex, normalizeHash, hashesMatch } from '@/lib/crypto/file-hash';
import { createRateLimiter } from '@/lib/crypto/rate-limit';
import { MAX_BYTES, isAllowedMime } from '@/lib/storage/s3';

export const dynamic = 'force-dynamic';

// 10 comprobaciones por IP cada 60s (estado por proceso).
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const DOWNLOAD_TIMEOUT_MS = 15_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function hashFromUpload(file: File): Promise<{ hash: string } | { error: NextResponse }> {
  if (file.size > MAX_BYTES) {
    return { error: NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 }) };
  }
  if (file.type && !isAllowedMime(file.type)) {
    return { error: NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 }) };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { hash: sha256Hex(buffer) };
}

async function hashFromUrl(fileUrl: string): Promise<{ hash: string } | { error: NextResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(fileUrl, { signal: controller.signal });
    if (!res.ok) {
      return { error: NextResponse.json({ error: 'No se pudo descargar la evidencia' }, { status: 502 }) };
    }
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length && length > MAX_BYTES) {
      return { error: NextResponse.json({ error: 'La evidencia excede el máximo de 10 MB' }, { status: 400 }) };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return { error: NextResponse.json({ error: 'La evidencia excede el máximo de 10 MB' }, { status: 400 }) };
    }
    return { hash: sha256Hex(buffer) };
  } catch {
    return { error: NextResponse.json({ error: 'Tiempo de espera agotado al descargar la evidencia' }, { status: 504 }) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const rate = limiter.check(clientIp(req));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas comprobaciones. Esperá unos segundos e intentá de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  const { documentId } = await params;
  const lookup = await resolveValidationLookup(documentId);
  if (!lookup) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const expectedHash = normalizeHash(lookup.entity.fileHash);
  const source = lookup.resolvedFrom === 'postgres' ? 'postgres' : getStoreSource();

  if (!expectedHash) {
    return NextResponse.json({
      result: 'no_hash_registered',
      expectedHash: null,
      computedHash: null,
      source,
    });
  }

  // Camino A: archivo subido (multipart). Camino B: descargar fileUrl en el servidor.
  const contentType = req.headers.get('content-type') ?? '';
  let computed: { hash: string } | { error: NextResponse };

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    computed = await hashFromUpload(file);
  } else {
    const fileUrl = normalizeEvidenceUrl(lookup.entity.fileUrl);
    if (!fileUrl) {
      return NextResponse.json({ error: 'No hay evidencia registrada para descargar' }, { status: 400 });
    }
    computed = await hashFromUrl(fileUrl);
  }

  if ('error' in computed) return computed.error;

  const computedHash = computed.hash;
  return NextResponse.json({
    result: hashesMatch(expectedHash, computedHash) ? 'match' : 'mismatch',
    expectedHash,
    computedHash,
    source,
  });
}
```

> **Verificado:** `resolveValidationLookup` (en `@/lib/arkiv/lookup`) devuelve `{ entity, entityKey, resolvedFrom }`, con `entity.fileHash` y `entity.fileUrl`. `normalizeEvidenceUrl` vive en `@/lib/storage/evidence-url` (ya usado por la verify page). `MAX_BYTES`/`isAllowedMime` se exportan de `@/lib/storage/s3`. La ruta `/verify/*` es pública en `middleware.ts`, y `/api/*` pasa derecho (no exige sesión).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/verify/[documentId]/check-hash/route.ts"
git commit -m "feat(api): check-hash público (multipart o descarga server-side) con rate limit"
```

---

## Task 4: Panel de verificación de integridad (UI cliente)

Componente cliente que hashea el archivo en el navegador (privacidad) y compara contra el hash esperado que ya tiene la página. Tres estados visibles: **coincide**, **no coincide**, **no verificable**.

**Files:**
- Create: `components/vendor-pass/hash-verify-panel.tsx`

- [ ] **Step 1: Crear el componente**

Recibe `expectedHash` (el `fileHash` de la entidad, ya renderizado en la página) y `desync` (true si Arkiv y Postgres divergen). El hashing es 100% en el navegador con `hashFileBrowser`; no se sube el archivo a ningún lado en este camino.

Create `components/vendor-pass/hash-verify-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { FileInput } from '@/components/vendor-pass/form-field';
import { hashFileBrowser, hashesMatch } from '@/lib/crypto/file-hash';
import { ShieldCheck, ShieldAlert, AlertCircle, Hash } from 'lucide-react';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'hashing' }
  | { kind: 'match'; computed: string }
  | { kind: 'mismatch'; computed: string }
  | { kind: 'error'; message: string };

export function HashVerifyPanel({
  expectedHash,
  desync = false,
}: {
  expectedHash: string | null;
  desync?: boolean;
}) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  if (!expectedHash) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
        <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          No hay hash registrado para este documento; la integridad del archivo no es verificable.
        </p>
      </div>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ kind: 'hashing' });
    try {
      const computed = await hashFileBrowser(file);
      setState(
        hashesMatch(expectedHash, computed)
          ? { kind: 'match', computed }
          : { kind: 'mismatch', computed },
      );
    } catch {
      setState({ kind: 'error', message: 'No se pudo calcular el hash del archivo.' });
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-primary shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Comprobar integridad</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Subí el archivo que tenés en mano. Se calcula su hash SHA-256 en tu navegador (no se envía a
        ningún servidor) y se compara con el registrado.
      </p>

      {desync && (
        <div className="flex items-start gap-2 text-xs text-amber-600">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          Atención: el hash de la base de datos no coincide con el anclado en Arkiv (posible
          desincronización). La comparación usa el de Arkiv.
        </div>
      )}

      <FileInput
        id="hash_check_file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={handleFile}
        dropLabel="Seleccionar el archivo a comprobar"
      />

      {state.kind === 'hashing' && (
        <p className="text-sm text-muted-foreground">Calculando hash…</p>
      )}

      {state.kind === 'match' && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary border border-border">
          <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">El archivo coincide</p>
            <p className="text-xs text-muted-foreground">
              Es el mismo archivo que se registró. Su integridad está verificada.
            </p>
          </div>
        </div>
      )}

      {state.kind === 'mismatch' && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary border border-destructive">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-destructive">El archivo NO coincide</p>
              <p className="text-xs text-muted-foreground">
                Este archivo es distinto del que se registró. No uses esta copia como evidencia válida.
              </p>
            </div>
          </div>
          <code className="text-[11px] font-mono break-all text-muted-foreground">
            Calculado: {state.computed}
          </code>
        </div>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
    </section>
  );
}
```

> **Verificado:** `FileInput` se exporta de `@/components/vendor-pass/form-field` y acepta `id`, `accept`, `onChange`, `dropLabel`. `hashFileBrowser`/`hashesMatch` vienen de Task 1. Los tokens de color (`bg-secondary`, `text-destructive`, `text-primary`, `border-border`) son los del design system usado en la verify page.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/hash-verify-panel.tsx
git commit -m "feat(ui): panel de comprobación de integridad (hash en navegador)"
```

---

## Task 5: Integrar el panel en la página de verificación

Insertar `<HashVerifyPanel>` justo debajo del bloque que ya muestra el hash. La página es Server Component; pasa el `fileHash` y una bandera de desincronización (Arkiv vs Postgres) al panel cliente.

**Files:**
- Modify: `app/verify/[documentId]/page.tsx`

- [ ] **Step 1: Importar el panel**

In `app/verify/[documentId]/page.tsx`, después de la línea 9 (`import { CopyVerifyLink } ...`), agregar:

```typescript
import { HashVerifyPanel } from '@/components/vendor-pass/hash-verify-panel';
```

- [ ] **Step 2: Renderizar el panel debajo del hash**

El bloque del hash termina en la línea 143 (el `</div>` que cierra el `{entity.fileHash && (...)}`). Justo **después** de ese bloque (antes del `{evidenceUrl && (...)}` de la línea 145), insertar:

```tsx
          <HashVerifyPanel expectedHash={entity.fileHash} />
```

> **Nota sobre `desync`:** la verify page resuelve un único `lookup` (Arkiv-primero), así que en esta vista no tiene ambos hashes a la vez para comparar. Se deja `desync` con su default `false`. La detección real de desincronización DB↔Arkiv ya la cubre la auditoría de paridad (`auditArkivParity`) y el endpoint server-side de Task 3 marca `source`. No se añade lógica nueva acá.

El resultado del fragmento editado queda así:

```tsx
          {entity.fileHash && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash size={11} aria-hidden="true" /> Hash SHA-256 del archivo
              </span>
              <code className="text-xs font-mono bg-secondary px-2 py-1.5 rounded-md break-all">{entity.fileHash}</code>
              <p className="text-[11px] text-muted-foreground">
                Integridad del archivo certificada al momento del registro.
              </p>
            </div>
          )}

          <HashVerifyPanel expectedHash={entity.fileHash} />

          {evidenceUrl && (
```

> **Verificado:** `entity.fileHash` es `string | null` (de `ValidationEntity`), que es exactamente la firma que espera `HashVerifyPanel`. El panel maneja internamente el caso `null` mostrando "no verificable", así que se renderiza siempre (cumple 3.3: no bloquea el resto del verify).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "app/verify/[documentId]/page.tsx"
git commit -m "feat(verify): integrar panel de comprobación de integridad en la página pública"
```

---

## Task 6: Nota de integración con anchor (Feature 2) y pasaporte (Feature 1)

Esta tarea **no escribe código**: documenta los invariantes que las otras features deben respetar para que la verificación de hash sea confiable. Sirve como checklist para quien implemente Feature 2.

**Files:** ninguno (solo verificación/notas)

- [ ] **Step 1: Confirmar el invariante del anchor (Feature 2)**

Al anclar un documento (transición `pending_anchor → anchored`), si el documento tiene `file_url`, el anchor **debe** exigir `file_hash` no nulo y persistirlo en la `ValidationEntity` (`fileHash`). Una vez anclado, `file_hash` es **inmutable** (junto con `issued_at`, `expires_at`, `document_type`). Verificar que el código de anchor de Feature 2 rechace anclar con `file_url` presente y `file_hash` nulo.

- [ ] **Step 2: Confirmar el hash en upload (ya existe)**

`app/api/upload/route.ts` ya calcula `createHash('sha256').update(buffer).digest('hex')` y devuelve `{ fileUrl, fileHash }`. La feature de hash-verify **consume** ese valor; no lo recalcula al subir. Confirmar que el flujo de alta de documento persiste el `fileHash` recibido.

- [ ] **Step 3: Nota para Feature 1 (pasaporte y PDF)**

Cuando se implemente el pasaporte/PDF: el QR del documento debe apuntar a `/verify/{documentId}` (que ya incluye la sección de hash y el panel de comprobación de Task 5). El PDF debe imprimir el hash abreviado (p. ej. primeros 12 chars) y la leyenda "Verificar en {url}". No se implementa acá; queda declarado como punto de integración.

- [ ] **Step 4: Sin commit**

No hay cambios de archivos. Esta tarea es un gate de revisión.

---

## Task 7: Verificación end-to-end

**Files:** ninguno (verificación manual + suite)

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: verde, incluyendo `tests/file-hash.test.ts` y `tests/check-hash-route.test.ts` (vectores conocidos de SHA-256 y rate limiter).

- [ ] **Step 2: Arrancar el dev server**

Run: `npm run dev`
Expected: `http://localhost:3000`.

- [ ] **Step 3: Comprobación en el navegador (camino cliente)**

1. Abrí `http://localhost:3000/verify/{documentId}` de un documento con `fileHash` registrado (sin login: la ruta es pública).
2. Confirmá que se ve el "Hash SHA-256 del archivo" y, debajo, el panel **Comprobar integridad**.
3. Subí **el archivo original** → debe mostrar **"El archivo coincide"**.
4. Alterá un byte del archivo (p. ej. `printf 'x' >> copia.pdf`) y subilo → debe mostrar **"El archivo NO coincide"** con el hash calculado.

- [ ] **Step 4: Documento sin hash (3.3)**

Abrí la verify de un documento **sin** `fileHash`. Expected: el panel muestra "No hay hash registrado… no es verificable" y el **resto de la página sigue funcionando** (datos, enlace público, etc.).

- [ ] **Step 5: Endpoint server-side con curl**

```bash
# Comparar contra un archivo subido (multipart):
curl -s -X POST http://localhost:3000/api/verify/{documentId}/check-hash \
  -F "file=@/ruta/al/original.pdf"
# Comparar descargando la evidencia registrada (sin body):
curl -s -X POST http://localhost:3000/api/verify/{documentId}/check-hash
```
Expected: el primero `{"result":"match",...}` con el original; un archivo distinto → `"mismatch"`. El segundo descarga `fileUrl` y compara contra Arkiv (`"source":"arkiv"` o `"postgres"` según resolución).

- [ ] **Step 6: Hash mostrado == Arkiv tras anchor**

Para un documento ya anclado, confirmá que el hash que muestra la verify page (`entity.fileHash`) es idéntico al que devuelve `/api/verify/{documentId}` (campo `validation.fileHash`) — ambos salen de la misma `ValidationEntity` de Arkiv.

- [ ] **Step 7: Rate limit**

Disparar >10 POST a `/api/verify/{documentId}/check-hash` desde la misma IP en <60s. Expected: a partir del 11º, `HTTP 429` con header `Retry-After`.

- [ ] **Step 8: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(verify): ajustes finales tras verificación end-to-end de integridad"
```

---

## Criterios de aceptación

- [ ] **Archivo idéntico al registrado → match.** Subir el original en el panel (Task 4) o por curl multipart (Task 7 Step 5) devuelve `match`.
- [ ] **Byte alterado → mismatch.** Cualquier modificación del archivo produce `mismatch` (Task 7 Step 3/5), garantizado por SHA-256 (Task 1, vector `abc` ≠ `abd`).
- [ ] **Hash mostrado coincide con Arkiv tras anchor.** El `fileHash` de la verify page sale de la misma `ValidationEntity` que `/api/verify` (Task 7 Step 6); el invariante de inmutabilidad post-anchor es responsabilidad de Feature 2 (Task 6 Step 1).
- [ ] **Funciona en ruta pública sin auth.** `/verify/{documentId}` y `POST /api/verify/{documentId}/check-hash` no exigen sesión (middleware verificado; Task 3/Task 7 Steps 3–5).
- [ ] **Sin hash registrado → no verificable, sin bloquear el resto.** Task 4 (estado "no verificable") + Task 5 (panel renderizado siempre) + endpoint `no_hash_registered` (Task 3).
- [ ] **Rate limit por IP en la comprobación.** Task 2 (limiter testeado) + Task 3 (10/60s, `429` + `Retry-After`).

---

## Self-Review

**1. Cobertura de la especificación (Feature 3):**
- ✅ 3.1 Verificación en página pública: muestra hash (ya existía, se mantiene en Task 5) + zona "Comprobar integridad" con hashing en cliente (Web Crypto) y resultado match/mismatch/no_hash_registered → Task 4.
- ✅ 3.2 Verificación server-side recomendada: `POST /api/verify/{id}/check-hash` lee `fileHash` de Arkiv; con archivo en body hashea el subido, sin body descarga `fileUrl` (límite 10MB + timeout); respuesta `{ result, expectedHash, computedHash, source }` → Task 3.
- ✅ 3.3 Sin archivo en registro: `fileHash` null → "No hay hash registrado; integridad no verificable", sin bloquear el resto → Task 3 (`no_hash_registered`) + Task 4 (estado) + Task 5 (panel siempre presente).
- ✅ 3.4 Pasaporte/PDF: declarado como integración, no implementado → Task 6 Step 3.
- ✅ Lib funciones puras testeables (`sha256Hex`, `hashFileBrowser`, `normalizeHash`, `hashesMatch`) con vectores conocidos → Task 1.
- ✅ API `check-hash` (multipart o descarga) → Task 3. UI `hash-verify-panel.tsx` integrado en verify → Tasks 4–5.
- ✅ Tests con vectores conocidos, match y mismatch → Task 1 (`tests/file-hash.test.ts`). Rate limit testeado → Task 2 (`tests/check-hash-route.test.ts`).
- ✅ Seguridad: rate limit por IP en verify check → Tasks 2–3.
- ✅ Nota de dependencia: anchor exige `file_hash` si hay `file_url` → Task 6 Step 1.

**2. Placeholders:** sin TODOs ni placeholders. Todo el código está completo y listo para pegar.

**3. Consistencia de tipos/nombres:** `sha256Hex`/`normalizeHash`/`hashesMatch`/`hashFileBrowser` (Task 1) se consumen idénticos en el endpoint (Task 3) y el panel (Tasks 4–5). `createRateLimiter` con firma `check(key, now?)` (Task 2) se usa en Task 3 con `Date.now()` por defecto. El endpoint lee `lookup.entity.fileHash`/`fileUrl` y `lookup.resolvedFrom` — exactamente lo que devuelve `resolveValidationLookup` (verificado en `@/lib/arkiv/lookup`). `entity.fileHash: string | null` (de `ValidationEntity`) coincide con la prop `expectedHash: string | null` de `HashVerifyPanel`. `MAX_BYTES`/`isAllowedMime` se importan de `@/lib/storage/s3` (verificado export). `normalizeEvidenceUrl` de `@/lib/storage/evidence-url` (ya usado por la verify page). `FileInput` de `@/components/vendor-pass/form-field` (verificado: acepta `id`/`accept`/`onChange`/`dropLabel`). La ruta del archivo de tests del rate limiter (`tests/check-hash-route.test.ts`) cubre la lógica pura del limiter; la lógica de comparación está cubierta por `tests/file-hash.test.ts` (vectores). El endpoint vive en `app/api/verify/[documentId]/check-hash/route.ts`, consistente con el `documentId` de los params (`Promise<{ documentId: string }>`).

---

## Stretch opcional (fuera del MVP)

- **Comparación en streaming server-side:** hashear el `fileUrl` por chunks (sin cargar 10MB en memoria) para soportar límites mayores.
- **Persistir intentos de verificación:** registrar match/mismatch (sin guardar el archivo) para auditoría de quién verificó qué documento y cuándo.
- **Rate limit distribuido:** mover el limiter en memoria a un store compartido (p. ej. Upstash/Redis) si la app corre en múltiples instancias.
- **Botón "verificar la evidencia registrada" en la UI:** invocar el camino server-side (sin body) desde el panel para comparar el `fileUrl` almacenado contra Arkiv, además del archivo en mano.
