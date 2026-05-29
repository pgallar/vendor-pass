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

La app requiere **iniciar sesión o registrarse** (`/login`, `/register`). El stack Docker incluye **GoTrue** en el puerto 54321 (`/auth/v1/`).

**Verificación de cuenta:** tras registrarte, debes confirmar tu correo. Los emails de auth (confirmación y recuperación de contraseña) se capturan en desarrollo con **Mailpit**: http://localhost:8025

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

## Verificación pública (Arkiv)

Cada documento tiene una página de verificación sin login:

- **UI:** `/verify/{documentId}` — estado, fechas, entity key, hash SHA-256 del archivo
- **API:** `GET /api/verify/{documentId}` — JSON para integraciones

El dashboard y `/expirations` leen vencimientos desde Arkiv (o memoria local si no hay credenciales).

## Subida de evidencia (S3 / MinIO)

Al crear un documento puedes subir PDF o imagen:

1. `POST /api/upload` (multipart: `file`, `vendorId`) → `{ fileUrl, fileHash }`
2. El hash SHA-256 se guarda en Postgres y se replica en Arkiv
3. En `/verify` se muestra el hash certificado al momento del registro

Bucket por defecto: `vendor-pass-evidence` (lectura pública en Docker local).

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
