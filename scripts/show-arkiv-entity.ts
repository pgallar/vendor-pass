/** Muestra una entidad Arkiv por documentId. Uso: node --env-file=.env tsx scripts/show-arkiv-entity.ts <documentId> */
import { createPublicClient, http } from '@arkiv-network/sdk';
import { braga } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { ENTITY_TYPE } from '@/lib/arkiv/client';

const documentId = process.argv[2] ?? '0a5657e3-9394-4dbe-ad44-94f264d07511';

const pub = createPublicClient({
  chain: braga,
  transport: http(process.env.ARKIV_RPC_URL || braga.rpcUrls.default.http[0]),
});

const r = await pub.buildQuery()
  .where([eq('entityType', ENTITY_TYPE), eq('documentId', documentId)])
  .withPayload(true)
  .fetch();

const e = r.entities[0];
if (!e) {
  console.error('No encontrada:', documentId);
  process.exit(1);
}

console.log(JSON.stringify({
  entityKey: e.key,
  attributes: e.attributes,
  payload: e.toJson(),
}, null, 2));
