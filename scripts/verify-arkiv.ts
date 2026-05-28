import { supabaseAdmin } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

async function main() {
  const sb = supabaseAdmin();
  const { data: docs, error } = await sb.from('documents').select('*');
  if (error) throw error;

  const store = getStore();
  const arkivEntities = await store.listAll();
  const arkivById = new Map(arkivEntities.map(e => [e.documentId, e]));

  const postgresDocs = (docs ?? []) as VendorDocument[];
  const mismatches: string[] = [];
  const missingInArkiv: string[] = [];
  const orphanInArkiv: string[] = [];

  for (const doc of postgresDocs) {
    const expected = documentStatus(doc);
    const arkiv = arkivById.get(doc.id);
    if (!arkiv) {
      missingInArkiv.push(doc.id);
      continue;
    }
    if (arkiv.status !== expected) {
      mismatches.push(`${doc.id}: postgres=${expected} arkiv=${arkiv.status}`);
    }
    arkivById.delete(doc.id);
  }

  for (const [documentId] of arkivById) {
    orphanInArkiv.push(documentId);
  }

  console.log('--- Arkiv parity audit ---');
  console.log(`Postgres documents: ${postgresDocs.length}`);
  console.log(`Arkiv entities:     ${arkivEntities.length}`);
  console.log(`Missing in Arkiv:   ${missingInArkiv.length}`);
  console.log(`Orphan in Arkiv:    ${orphanInArkiv.length}`);
  console.log(`Status mismatches:  ${mismatches.length}`);

  if (missingInArkiv.length) {
    console.log('\nMissing:');
    missingInArkiv.forEach(id => console.log(`  - ${id}`));
  }
  if (orphanInArkiv.length) {
    console.log('\nOrphans:');
    orphanInArkiv.forEach(id => console.log(`  - ${id}`));
  }
  if (mismatches.length) {
    console.log('\nMismatches:');
    mismatches.forEach(m => console.log(`  - ${m}`));
  }

  const ok = missingInArkiv.length === 0 && orphanInArkiv.length === 0 && mismatches.length === 0;
  console.log(ok ? '\nOK: Postgres and Arkiv are in sync.' : '\nFAIL: discrepancies found.');
  if (!ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
