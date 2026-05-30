# VendorPass

Gestión de cumplimiento de proveedores: documentos con vencimiento, estados automáticos (Vigente / Por vencer / Vencido) y réplica verificable en Arkiv.

## Arranque rápido (Docker — recomendado)

Un solo comando levanta **Postgres + API REST + MinIO (S3) + Next.js**:

```bash
docker compose up
```

- **App:** http://localhost:3000  
- **API (compatible Supabase):** http://localhost:54321 (REST + Auth/GoTrue)  
- **MinIO API:** http://localhost:9010  
- **MinIO consola:** http://localhost:9011 (minioadmin / minioadmin)
- **Mailpit (correos):** http://localhost:8025

La primera vez instala dependencias npm dentro del contenedor (puede tardar unos minutos).

Reiniciar base de datos desde cero:

```bash
docker compose down -v
docker compose up
```

### Autenticación

Para probar la demo, puedes utilizar las siguientes credenciales de prueba:
- **Usuario:** `demo@moraiarkae.resend.app`
- **Contraseña:** `!DemoDemo`

URLs del sistema demo:
- **Home:** https://vendor-pass.vercel.app/
- **Dashboard:** https://vendor-pass.vercel.app/dashboard
- **Login:** https://vendor-pass.vercel.app/login

La app requiere **iniciar sesión o registrarse** (`/login`, `/register`). El stack Docker incluye **GoTrue** en el puerto 54321 (`/auth/v1/`).

**Verificación de cuenta:** tras registrarte, debes confirmar tu correo. Los emails de auth (confirmación y recuperación de contraseña) se capturan en desarrollo con **Mailpit**: http://localhost:8025

Las plantillas de correo usan la marca VendorPass (indigo/slate). En Docker, GoTrue las obtiene del servicio `email-templates` (`docker/email-templates/`). Con `npx supabase start`, las mismas plantillas se leen desde `supabase/config.toml`.

#### Producción (Supabase hosted + Vercel)

Si el correo de confirmación llega **sin diseño** o con `redirect_to=http://localhost:3000`:

1. **Vercel** → Environment Variables → `NEXT_PUBLIC_APP_URL=https://vendor-pass.vercel.app` (redeploy tras cambiarla).
2. **Supabase** → Authentication → URL Configuration:
   - **Site URL:** `https://vendor-pass.vercel.app`
   - **Redirect URLs:** `https://vendor-pass.vercel.app/**`, `https://vendor-pass.vercel.app/auth/callback`, `https://vendor-pass.vercel.app/auth/callback/**`
3. **Supabase** → Authentication → Email Templates: pegar el HTML de `docker/email-templates/confirmation.html` (Confirm signup) y `recovery.html` (Reset password).

Sincronización automática (Management API):

```bash
export SUPABASE_ACCESS_TOKEN="..."   # dashboard → Account → Access Tokens
export SUPABASE_PROJECT_REF="nfcddbdctsfkxwajjkxw"  # ref del proyecto
export APP_URL="https://vendor-pass.vercel.app"
npx tsx scripts/sync-supabase-auth-config.ts
```

La app envía `emailRedirectTo` usando el origen del navegador en el cliente (no depende de un build con localhost).

| Ruta | Uso |
|------|-----|
| `/register` | Alta de cuenta → revisa Mailpit y confirma el enlace |
| `/verify-email` | Reenviar correo de confirmación |
| `/forgot-password` | Solicitar enlace para restablecer contraseña |
| `/reset-password` | Definir nueva contraseña (tras el enlace del correo) |

Tras confirmar el correo, el **primer** acceso vincula los **3 proveedores de demostración** del seed (`claim_legacy_vendors`). Un segundo usuario confirmado empieza sin esos datos.

> **Puerto 54321:** Si tienes `npx supabase start` activo, deténlo antes: `npx supabase stop` (choca con PostgREST de Docker).

### Variables en Docker

No necesitas crear `.env` para Docker: se usa `.env.docker` (claves JWT de demo locales). MinIO y S3 se configuran en `docker-compose.yml`.

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador → `http://localhost:54321` |
| `SUPABASE_URL_INTERNAL` | Servidor Next.js → `http://postgrest:3000` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | JWT anon (demo) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT service_role (demo) |
| `S3_ENDPOINT` | Servidor → `http://minio:9000` |
| `S3_PUBLIC_URL` | Navegador → `http://localhost:9010` |

## Desarrollo sin Docker (Supabase CLI)

```bash
cp .env.example .env
npx supabase start
npx supabase db reset
npx supabase status -o env   # copiar ANON_KEY, SERVICE_ROLE_KEY, API_URL a .env
npm install
npm run backfill
npm run dev
```

Para subida de archivos sin Docker, levanta MinIO localmente o apunta `S3_*` a tu bucket.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `docker compose up` | Stack completo |
| `npm run dev` | Solo frontend (requiere API en .env) |
| `npm test` | Tests unitarios |
| `npm run backfill` | Supabase → store Arkiv (una vez) |
| `npm run sync:arkiv` | Mismo sync con log ISO (usado por el cron) |
| `npm run verify:arkiv` | Auditoría paridad Postgres ↔ Arkiv |

## Pruebas E2E (Playwright)

Recorrido integral, visible en el navegador, disparado por **un único test orquestador**.

```bash
# Local (requiere `docker compose up` o `npm run dev` en :3000)
npm run e2e:local

# Producción (https://vendor-pass.vercel.app)
npm run e2e:prod

# Modo UI interactivo (paso a paso)
npm run e2e:ui

# Reanudar desde un paso concreto (clave o índice)
E2E_ENV=local E2E_START_STEP=create-document npx playwright test

# Detener antes de logout (genera artefactos para reanudar sin invalidar sesión)
E2E_ENV=local E2E_END_STEP=settings npx playwright test

# Reporte HTML + screenshots/trace/video
npm run e2e:report   # ./tests/e2e/.report
```

- Credenciales por defecto: las del bloque "Autenticación" (sobreescribibles con `E2E_EMAIL` / `E2E_PASSWORD`).
- Pasos disponibles para `E2E_START_STEP`: `landing, login, dashboard, vendors-list, create-vendor, vendor-detail, create-document, expirations, public-verify, integrations, docs, settings, logout`.
- La reanudación usa `tests/e2e/.artifacts/{state.json, storageState.json}` (gitignored); no borres esa carpeta entre una corrida y su reanudación (evitá correr `logout` si querés retomar pasos autenticados).
- Capturas y evidencia visual en `tests/e2e/.artifacts/screenshots/`.
- **Local:** requiere la app en `:3000` con MinIO/S3 (`docker compose up`).
- **Prod:** `e2e:prod` apunta a `https://vendor-pass.vercel.app`; requiere S3 en Vercel (ver [deploy Vercel](docs/vercel-deployment-plan.md#almacenamiento-s3-evidencias-y-avatares)).

### Pruebas E2E de Importación + IA + Visualización de Documentos (`documents`)

Esta suite data-driven utiliza los 5 PDFs realistas en `tests/e2e/fixtures/` para validar la importación de archivos reales, la extracción de metadatos mediante IA (OpenRouter), y la visualización pública de la evidencia adjunta.

```bash
# Correr la suite de documentos (local)
npm run e2e:docs:local

# Correr la suite de documentos (producción)
npm run e2e:docs:prod

# Reporte HTML con trazas, videos y screenshots
npm run e2e:report
```

- **Cobertura plena**: requiere `OPENROUTER_API_KEY` (para extracción de IA) y `S3_ENDPOINT` (para subida/visualización). Si faltan, los tests correspondientes se auto-saltan mediante anotaciones controladas. Puedes forzar que fallen en vez de saltarse usando `E2E_REQUIRE_AI=1` y `E2E_REQUIRE_STORAGE=1`.
- **Inicio de sesión único**: usa `auth.setup.ts` para loguearse una sola vez y reutilizar la sesión a través de la configuración `storageState` de Playwright.
- **Capturas de pantalla**: las capturas generadas se guardan en `tests/e2e/.artifacts/documents/` (por ejemplo, `ai-filled-*.png`, `verify-with-evidence.png`).

## Verificación pública (Arkiv)

Cada documento tiene una página de verificación sin login:

- **UI:** `/verify/{documentId}` — estado, fechas, entity key, hash SHA-256 del archivo
- **API:** `GET /api/verify/{documentId}` — JSON para integraciones

El dashboard y `/expirations` leen vencimientos desde Arkiv (o memoria local si no hay credenciales).

## Servidor MCP (asistentes de IA)

VendorPass expone un **servidor MCP remoto** (transporte **Streamable HTTP**) para conectar asistentes de IA, IDEs o automatizaciones. No requiere instalar nada: solo la URL del endpoint y una API key.

- **Endpoint (producción):** `https://vendor-pass.vercel.app/api/mcp`
- **Endpoint (local):** `http://localhost:3000/api/mcp`
- **Guía interactiva en la app:** Integraciones → [Guía MCP](https://vendor-pass.vercel.app/integrations/mcp) (`/integrations/mcp`)

### 1. Obtener una API key

En [Integraciones](https://vendor-pass.vercel.app/integrations) (`/integrations`) generá una API key y copiala al crearla (solo se muestra una vez). La clave tiene el prefijo `vp_`.

### 2. Autenticación

Cada solicitud debe enviar la API key en el header `Authorization`:

```
Authorization: Bearer vp_tu_clave_secreta
```

Sin una clave válida el servidor responde `401`. Si revocás la clave en Integraciones, deja de funcionar de inmediato.

### 3. Configurar el cliente MCP

La mayoría de clientes MCP remotos aceptan una URL y headers personalizados:

```json
{
  "mcpServers": {
    "vendorpass": {
      "url": "https://vendor-pass.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer vp_tu_clave"
      }
    }
  }
}
```

Consultá la documentación de tu herramienta para saber dónde pegar este bloque (archivo de configuración MCP, panel de integraciones, variables de entorno, etc.) y reiniciá el cliente después de guardar.

### 4. Probar la conexión

Con el cliente conectado, pedile por ejemplo:

- «¿Qué proveedores tengo en estado de atención o bloqueados?»
- «Listá documentos por vencer.»
- «Generá un reporte de auditoría Arkiv.»
- «Dá de alta un proveedor y subí su póliza ART.»

### Herramientas disponibles

| Categoría | Herramientas |
|-----------|--------------|
| Lectura | `list_vendors`, `get_vendor`, `get_vendor_compliance`, `list_documents`, `list_expirations`, `verify_document`, `arkiv_audit`, `arkiv_report` |
| Proveedores | `create_vendor`, `update_vendor`, `delete_vendor` |
| Documentos | `create_document`, `create_document_with_file`, `create_document_from_file_with_ai`, `update_document`, `delete_document` |
| Archivos / IA | `upload_vendor_file`, `extract_document_fields` (extracción IA con OpenRouter) |

> **Desarrollo local con stdio:** existe un paquete opcional en `mcp-server/` para probar MCP vía proceso stdio. Para uso normal preferí el endpoint remoto `/api/mcp` descrito arriba. Ver [`mcp-server/README.md`](mcp-server/README.md).

## Subida de evidencia (S3 / MinIO)

Al crear un documento puedes subir PDF o imagen:

1. `POST /api/upload` (multipart: `file`, `vendorId`) → `{ fileUrl, fileHash }`
2. El hash SHA-256 se guarda en Postgres y se replica en Arkiv
3. En `/verify` se muestra el hash certificado al momento del registro

| Entorno | Backend S3 | `S3_ENDPOINT` |
|---------|--------------|---------------|
| Local (Docker) | MinIO | `http://127.0.0.1:9010` (automático en compose) |
| Prod (Vercel) | Supabase Storage (protocolo S3) | `https://<ref>.storage.supabase.co/storage/v1/s3` |

Bucket por defecto: `vendor-pass-evidence`. Configuración prod: [docs/vercel-deployment-plan.md](docs/vercel-deployment-plan.md#almacenamiento-s3-evidencias-y-avatares).

## Sync diario Postgres → Arkiv

Los estados (`vigente` / `por_vencer` / `vencido`) se recalculan en cada sync y se escriben en Arkiv con `updateEntity`. Sin esto, `/expirations` y el dashboard pueden quedar desactualizados.

El resultado del último sync se guarda en `.arkiv-last-sync.json` (gitignored) y se muestra en el banner del dashboard.

### Docker (automático)

Con `docker compose up` se levanta el servicio **`arkiv-cron`**, que ejecuta el sync **todos los días a las 05:00 UTC** (configurable):

```bash
docker compose up -d
docker compose logs -f arkiv-cron   # ver programación y log
docker exec vendor-pass-arkiv-cron-1 cat /var/log/arkiv-sync.log
```

Variables en `.env.docker` o `docker-compose.yml`:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ARKIV_SYNC_CRON` | `0 5 * * *` | Expresión cron (UTC) |
| `ARKIV_SYNC_ON_START` | `false` | Sync extra al arrancar el contenedor |

Ejemplo: sync a medianoche UTC → `ARKIV_SYNC_CRON=0 0 * * *`

### Sin Docker (crontab del sistema)

```bash
crontab -e
```

```cron
0 5 * * * cd /ruta/a/vendor-pass && node --env-file=.env ./node_modules/.bin/tsx scripts/sync-arkiv-status.ts >> logs/arkiv-sync.log 2>&1
```

Prueba manual:

```bash
npm run sync:arkiv
npm run verify:arkiv
```

## ARKIV x PunaTech Hackathon

VendorPass utiliza Arkiv como su capa de datos principal para la validación, estados de cumplimiento y trazabilidad de IA, alineándose con los requisitos de la hackaton:

- **PROJECT_ATTRIBUTE (`vendor-pass-2026`)**: Todas las entidades y consultas están particionadas usando este atributo único (`project`), asegurando que los datos no colisionen con otros proyectos en el mismo entorno.
- **Modelo de Entidades**:
  - `vendor_document_validation`: Representa el estado actual de cumplimiento de un documento (vigente, por vencer, vencido). Los atributos indexados incluyen `vendorId`, `documentType`, `status`, y las fechas convertidas a valores numéricos (`issuedAtMs`, `expiresAtMs`) que permiten realizar consultas de rango de manera eficiente.
  - `ai_audit_log`: Un registro inmutable generado cada vez que nuestra IA (OpenAI/OpenRouter) extrae datos de un documento. Cuenta con atributos como `model` y `confidence`. Esto ofrece trazabilidad real y transparente sobre las decisiones automatizadas de los agentes de IA.
- **Ownership y Wallet**: La aplicación actúa como un **Oráculo de cumplimiento**, operando a través de una wallet servidora (cuyas credenciales se manejan mediante variables de entorno). Esto asegura los registros mientras brinda una experiencia fluida al usuario final, que no necesita gestionar claves privadas, firmar transacciones ni entender conceptos de blockchain.
- **Ciclo de vida (expiresIn)**: Las entidades en Arkiv tienen un `expiresIn` que se calcula programáticamente de acuerdo con la fecha real de vencimiento del documento, y de 30 días para los registros de auditoría de la IA.

## Stack

Next.js 16, Postgres, PostgREST, Supabase JS, MinIO (S3), Arkiv (`@arkiv-network/sdk`), Vitest, Tailwind CSS.
