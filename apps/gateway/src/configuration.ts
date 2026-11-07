import { address } from '@solana/kit';
import { VaultClient } from '../../../packages/solana/client.js';
import type { VaultConfiguration } from '../../../packages/solana/binding.js';
export function vaultConfiguration(env:NodeJS.ProcessEnv=process.env):VaultConfiguration|undefined{
  const {SOLANA_RPC_URL,SOLANA_PROGRAM_ID,SOLANA_CLUSTER,AGENT_PUBLIC_KEY,REFERENCE_RECIPIENT,REFERENCE_MINT}=env;
  if(!SOLANA_RPC_URL||!SOLANA_PROGRAM_ID||!AGENT_PUBLIC_KEY||!REFERENCE_RECIPIENT||!REFERENCE_MINT)return;
  if(SOLANA_CLUSTER!=='localnet'&&SOLANA_CLUSTER!=='devnet')throw new Error('unsupported_cluster');
  return {client:new VaultClient(SOLANA_RPC_URL,address(SOLANA_PROGRAM_ID)),cluster:SOLANA_CLUSTER,
    agent:address(AGENT_PUBLIC_KEY),recipientWallet:address(REFERENCE_RECIPIENT),mint:address(REFERENCE_MINT)};
}
