import { syncDocumentsToArkiv } from '@/lib/arkiv/sync';

async function main() {
  const result = await syncDocumentsToArkiv();
  for (const d of result.errors) {
    console.error('failed', d.documentId, d.message);
  }
  console.log(`backfill complete: ${result.synced}/${result.total}`);
  if (result.failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
