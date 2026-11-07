// Full genesis hashes, not truncated CAIP-2 chain references.
// Source: solana-labs/solana sdk/src/genesis_config.rs, confirmed against Devnet RPC.
export const MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export function assertClusterIdentity(cluster:'localnet'|'devnet',genesis:string,host:string){
  if(genesis===MAINNET_GENESIS||(cluster==='devnet'&&genesis!==DEVNET_GENESIS)
    ||(cluster==='localnet'&&(!['127.0.0.1','localhost'].includes(host)||genesis===DEVNET_GENESIS)))
    throw new Error('cluster_identity_mismatch');
}
