# Deploy VendorPass DEMO — Arquitectura Vercel + Supabase

## Arquitectura Final

```text
Supabase Cloud (Free $0)         Vercel (Hobby Tier $0)
┌─────────────────────────┐      ┌────────────────────────────┐
│  PostgreSQL (managed)   │      │  Next.js Frontend (CDN)    │
│  PostgREST (/rest/v1)   │◄────►│                            │
│  GoTrue Auth (/auth/v1) │      │  Serverless Functions:     │
│  Storage (files)        │      │    ├── /api/mcp  (MCP)     │
└─────────────────────────┘      │    └── /api/v1/* (REST)    │
                                 ├────────────────────────────┤
                                 │  Vercel Cron Jobs          │
                                 │  (0 5 * * * — diario UTC)  │
                                 └────────────────────────────┘
                                 Costo total: $0/mes
```

> [!NOTE]
> - **Builds Seguros** — Vercel da 2GB de RAM para compilar (Render daba 512MB).
> - **Sin Servidores** — El backend corre 100% en AWS Lambda gestionado por Vercel.
> - **Cron Integrado** — El trabajo programado se invoca nativamente con un `vercel.json`.

---

## Paso 1 — Crear proyecto Supabase Cloud (Ya realizado)

Se mantiene exactamente igual. La base de datos y la autenticación ya están configuradas en Supabase.
Las 3 variables de entorno (`Project URL`, `anon public key`, `service_role secret key`) serán usadas en Vercel.

---

## Paso 2 — Configurar Cron Job en el Repositorio

Para que Vercel ejecute el Cron Job diario de sincronización con Arkiv, necesitamos crear un archivo en la raíz del proyecto.

**Archivo a crear: `vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/arkiv/sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```
*Este archivo le indica a Vercel que llame al endpoint `/api/arkiv/sync` todos los días a las 5:00 AM UTC.*

---

## Paso 3 — Desplegar en Vercel (Manual por parte del usuario)

Dado que Vercel requiere conectar tu cuenta personal de GitHub, este paso es el único que debes realizar manualmente (toma 2 minutos):

1. **Ingresar a Vercel**: 👉 [vercel.com/new](https://vercel.com/new)
2. **Importar Repositorio**: Seleccionar el repositorio `vendor-pass` desde GitHub.
3. **Configurar Framework**: Vercel detectará automáticamente que es un proyecto **Next.js**.
4. **Variables de Entorno**: En la sección de "Environment Variables", pegar las siguientes variables:

| Key | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | *(Tu URL de Supabase)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Tu Anon Key de Supabase)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Tu Service Role Key de Supabase)* |
| `NEXT_PUBLIC_APP_URL` | *(La URL temporal que te de Vercel)* |
| `ARKIV_RPC_URL` | `https://braga.hoodi.arkiv.network/rpc` |
| `ARKIV_PRIVATE_KEY` | `0x75e51c2ce96533c3eb8203a9f11a39b0dc1729e9003488aba8170401bab8c322` |
| `ARKIV_NAMESPACE` | `vendor_pass` |
| `ANCHOR_ON_SAVE` | `false` |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` |

### Almacenamiento S3 (evidencias y avatares)

La app sube PDFs/imágenes vía `/api/upload` usando el cliente S3 (`@aws-sdk/client-s3`). En **local** usa MinIO (Docker); en **prod** usa el **protocolo S3 de Supabase Storage**.

> **Error frecuente:** usar `NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`) como `S3_ENDPOINT`. Esa URL es REST/Auth, no S3. El SDK recibe JSON en lugar de XML y falla con `char '{' is not expected`.

**En Supabase (una sola vez):**

1. Dashboard → **Storage** → **Settings** → **S3 configuration**
2. Generar **S3 Access Keys** (Access Key ID + Secret Access Key)
3. Copiar **endpoint** y **region** de esa pantalla
4. Crear bucket `vendor-pass-evidence` (público para lectura, equivalente a MinIO local)

**Variables adicionales en Vercel (Production):**

| Key | Valor | Notas |
|---|---|---|
| `S3_ENDPOINT` | `https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3` | Subdominio **`storage`**, sufijo **`/storage/v1/s3`** |
| `S3_ACCESS_KEY` | *(S3 Access Key ID de Supabase Storage)* | No confundir con `anon` ni `service_role` |
| `S3_SECRET_KEY` | *(S3 Secret Access Key de Supabase Storage)* | |
| `S3_BUCKET` | `vendor-pass-evidence` | Debe existir en Supabase Storage |
| `S3_REGION` | *(región del proyecto, ej. `sa-east-1`)* | La misma que muestra S3 configuration |

Ejemplo (proyecto demo):

```env
S3_ENDPOINT=https://nfcddbdctsfkxwajjkxw.storage.supabase.co/storage/v1/s3
S3_BUCKET=vendor-pass-evidence
S3_REGION=sa-east-1
```

Tras cambiar estas variables, **redeploy** en Vercel. Verificación rápida:

```bash
# Subida + recorrido E2E completo contra prod
npm run e2e:prod
```

O manualmente: crear documento con PDF en prod y confirmar que aparece el hash SHA-256 antes de anclar.

5. **Clic en "Deploy"**: Vercel comenzará a compilar la app (esta vez con suficiente RAM) y publicará tu DEMO.

---

## Paso 4 — Limpieza de Render

Una vez que Vercel esté funcionando y hayas verificado que la DEMO carga correctamente:
1. Ir al Dashboard de Render.
2. Eliminar el **Web Service** (`vendor-pass-app`).
3. Eliminar el **Cron Job** (`vendor-pass-arkiv-cron`).
Esto asegurará que no te cobren los $8/mes.

---

## Resumen de Costos

| Servicio | Plataforma | Plan | Costo/mes |
|---|---|---|---|
| PostgreSQL + Auth + API | Supabase Cloud | Free | $0 |
| Next.js + Backend | Vercel | Hobby | $0 |
| Arkiv Sync Cron | Vercel Cron | Hobby | $0 |
| **Total** | | | **$0/mes** |
