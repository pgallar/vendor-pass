import { formatE2eTarget } from './config';

export default async function globalSetup(): Promise<void> {
  // Banner visible en la consola para confirmar el target antes de abrir el navegador.
  console.log(`\n[E2E] Target: ${formatE2eTarget()}\n`);
}
