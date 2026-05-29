/**
 * Sincroniza Site URL, redirect allow list y plantillas HTML de auth en Supabase hosted.
 *
 * Requiere:
 *   SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF  — ref del proyecto (subdominio de *.supabase.co)
 *   APP_URL (opcional)    — default https://vendor-pass.vercel.app
 *
 * Uso: npx tsx scripts/sync-supabase-auth-config.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const APP_URL = (process.env.APP_URL ?? 'https://vendor-pass.vercel.app').replace(/\/$/, '');

const templatesDir = join(process.cwd(), 'docker/email-templates');

function readTemplate(name: string): string {
  return readFileSync(join(templatesDir, name), 'utf8');
}

function buildPayload() {
  const callback = `${APP_URL}/auth/callback`;
  return {
    site_url: APP_URL,
    uri_allow_list: `${APP_URL}/**,${callback},${callback}**`,
    mailer_subjects_confirmation: 'VendorPass: Confirma tu cuenta',
    mailer_subjects_recovery: 'VendorPass: Restablece tu contraseña',
    mailer_templates_confirmation_content: readTemplate('confirmation.html'),
    mailer_templates_recovery_content: readTemplate('recovery.html'),
  };
}

async function main() {
  if (!PROJECT_REF || !ACCESS_TOKEN) {
    console.error(
      'Faltan SUPABASE_PROJECT_REF y/o SUPABASE_ACCESS_TOKEN.\n\n' +
        'Configuración manual en el dashboard de Supabase:\n' +
        `  1. Authentication → URL Configuration → Site URL: ${APP_URL}\n` +
        `  2. Redirect URLs: ${APP_URL}/**, ${APP_URL}/auth/callback, ${APP_URL}/auth/callback/**\n` +
        '  3. Authentication → Email Templates → Confirm signup: pegar docker/email-templates/confirmation.html\n' +
        '  4. Authentication → Email Templates → Reset password: pegar docker/email-templates/recovery.html\n' +
        '  5. Vercel → NEXT_PUBLIC_APP_URL=' +
        APP_URL,
    );
    process.exit(1);
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildPayload()),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Error ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log(`Auth config actualizado para ${APP_URL}`);
  console.log('- site_url y redirect URLs');
  console.log('- plantillas confirmation y recovery (VendorPass)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
