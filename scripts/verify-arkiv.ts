import { auditArkivParity } from '@/lib/arkiv/verify-parity';

async function main() {
  const result = await auditArkivParity();

  console.log('--- Arkiv parity audit ---');
  console.log(`Postgres documents: ${result.postgresCount}`);
  console.log(`Arkiv entities:     ${result.arkivCount}`);
  console.log(`Missing in Arkiv:   ${result.missingInArkiv.length}`);
  console.log(`Orphan in Arkiv:    ${result.orphanInArkiv.length}`);
  console.log(`Status mismatches:  ${result.mismatches.length}`);

  if (result.missingInArkiv.length) {
    console.log('\nMissing:');
    result.missingInArkiv.forEach(id => console.log(`  - ${id}`));
  }
  if (result.orphanInArkiv.length) {
    console.log('\nOrphans:');
    result.orphanInArkiv.forEach(id => console.log(`  - ${id}`));
  }
  if (result.mismatches.length) {
    console.log('\nMismatches:');
    result.mismatches.forEach(m => console.log(`  - ${m.documentId}: postgres=${m.postgres} arkiv=${m.arkiv}`));
  }

  console.log(result.ok ? '\nOK: Postgres and Arkiv are in sync.' : '\nFAIL: discrepancies found.');
  if (!result.ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
