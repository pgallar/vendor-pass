import { sendExpirationNotifications } from '@/lib/notifications/expirations';

async function main() {
  const started = new Date().toISOString();
  console.log(`[${started}] expiration emails started`);
  const result = await sendExpirationNotifications();
  console.log(
    `[${started}] complete: sent=${result.sent} skipped=${result.skipped} errors=${result.errors.length}`,
  );
  if (result.errors.length) {
    for (const e of result.errors) console.error(e);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
