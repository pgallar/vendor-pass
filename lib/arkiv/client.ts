import {
  createPublicClient,
  createWalletClient,
  http,
  jsonToPayload,
  type PublicArkivClient,
  type WalletArkivClient,
} from '@arkiv-network/sdk';
import { braga } from '@arkiv-network/sdk/chains';
import { privateKeyToAccount } from 'viem/accounts';

let publicClient: PublicArkivClient | null = null;
let walletClient: WalletArkivClient | null = null;

function transport() {
  const url = process.env.ARKIV_RPC_URL;
  return http(url || braga.rpcUrls.default.http[0]);
}

export function arkivPublicClient(): PublicArkivClient {
  if (!publicClient) {
    publicClient = createPublicClient({ chain: braga, transport: transport() });
  }
  return publicClient;
}

export function arkivWalletClient(): WalletArkivClient {
  if (!walletClient) {
    const key = process.env.ARKIV_PRIVATE_KEY as `0x${string}`;
    walletClient = createWalletClient({
      chain: braga,
      transport: transport(),
      account: privateKeyToAccount(key),
    });
  }
  return walletClient;
}

export { jsonToPayload };

export const ENTITY_TYPE = 'vendor_document_validation';
