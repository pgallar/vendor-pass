import { syncDocumentsToArkiv } from '@/lib/arkiv/sync';

async function main() {
  const started = new Date().toISOString();
  console.log(`[${started}] arkiv sync started`);
  const result = await syncDocumentsToArkiv();
  for (const d of result.errors) {
    console.error(`[${started}] failed`, d.documentId, d.message);
  }
  console.log(`[${started}] arkiv sync complete: ${result.synced}/${result.total} (${result.failed} failed)`);
  if (result.failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
