import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertClusterIdentity, MAINNET_GENESIS, DEVNET_GENESIS } from '../packages/solana/cluster.js';
test('cluster guard uses full genesis hashes, rejects mainnet even behind localhost, and never accepts chain-ID prefixes',()=>{
  assert.doesNotThrow(()=>assertClusterIdentity('devnet',DEVNET_GENESIS,'api.devnet.solana.com'));
  assert.doesNotThrow(()=>assertClusterIdentity('localnet','GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC','127.0.0.1'));
  for(const cluster of ['devnet','localnet'] as const){
    assert.throws(()=>assertClusterIdentity(cluster,MAINNET_GENESIS,'127.0.0.1'),/cluster_identity_mismatch/);
    assert.throws(()=>assertClusterIdentity(cluster,DEVNET_GENESIS.slice(0,32),'api.devnet.solana.com'),/cluster_identity_mismatch/);
  }
  assert.throws(()=>assertClusterIdentity('localnet',DEVNET_GENESIS,'127.0.0.1'),/cluster_identity_mismatch/);
  assert.throws(()=>assertClusterIdentity('devnet','GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC','api.devnet.solana.com'),/cluster_identity_mismatch/);
});
