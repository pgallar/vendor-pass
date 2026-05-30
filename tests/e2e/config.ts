export type E2eEnvName = 'local' | 'prod';

const URLS: Record<E2eEnvName, string> = {
  local: 'http://localhost:3000',
  prod: 'https://vendor-pass.vercel.app',
};

/** Resuelve el entorno E2E. Requiere E2E_ENV=local|prod (sin default silencioso). */
export function resolveE2eEnvName(): E2eEnvName {
  const raw = process.env.E2E_ENV?.trim();
  if (raw === 'prod' || raw === 'local') return raw;
  throw new Error(
    'E2E_ENV debe ser "local" o "prod". Usá npm run e2e:local / e2e:prod (o e2e:docs:local / e2e:docs:prod).',
  );
}

export function getE2eBaseUrl(name: E2eEnvName = resolveE2eEnvName()): string {
  return URLS[name];
}

export function formatE2eTarget(name: E2eEnvName = resolveE2eEnvName()): string {
  return `${name} → ${URLS[name]}`;
}
