import { test } from 'node:test';
import assert from 'node:assert/strict';
import { address, generateKeyPairSigner, lamports } from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS, getInitializeMintInstruction, getMintSize, getMintToInstruction,
  getCreateAssociatedTokenInstructionAsync, findAssociatedTokenPda, getTransferCheckedInstruction } from '@solana-program/token';
import { VaultClient, bytes32, type Binding } from '../../packages/solana/client.js';

test('actual local vault enforces signer, recipient, mint, limits, approvals, replay, revocation and owner withdrawal', { timeout: 120000 }, async t => {
  assert.ok(process.env.SOLANA_RPC_URL && process.env.SOLANA_PROGRAM_ID, 'Use npm run test:solana');
  const client = new VaultClient(process.env.SOLANA_RPC_URL, address(process.env.SOLANA_PROGRAM_ID));
  const owner = await generateKeyPairSigner(), agent = await generateKeyPairSigner(), service = await generateKeyPairSigner(), attacker = await generateKeyPairSigner();
  await client.rpc.requestAirdrop(owner.address, lamports(5_000_000_000n)).send();
  await client.rpc.requestAirdrop(agent.address, lamports(2_000_000_000n)).send();
  for (let i=0;i<50;i++) {
    if ((await client.rpc.getBalance(owner.address, { commitment:'confirmed' }).send()).value > 0n) break;
    await new Promise(r=>setTimeout(r,100));
  }
  const mint = await generateKeyPairSigner();
  await client.send(owner, [getCreateAccountInstruction({ payer:owner, newAccount:mint,
    lamports:await client.rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())).send(), space:BigInt(getMintSize()), programAddress:TOKEN_PROGRAM_ADDRESS }),
    getInitializeMintInstruction({ mint:mint.address, decimals:0, mintAuthority:owner.address })]);
  const ata = async (wallet: typeof owner) => {
    const ix = await getCreateAssociatedTokenInstructionAsync({ payer:owner, owner:wallet.address, mint:mint.address });
    await client.send(owner,[ix]);
    return (await findAssociatedTokenPda({ owner:wallet.address, mint:mint.address, tokenProgram:TOKEN_PROGRAM_ADDRESS }))[0];
  };
  const source = await ata(owner), recipient = await ata(service), badRecipient = await ata(attacker);
  await client.send(owner,[getMintToInstruction({ mint:mint.address, token:source, mintAuthority:owner, amount:100n })]);
  const created = await client.create(owner,mint.address,agent.address,service.address,bytes32('local-test'), '100','60','30',BigInt(Math.floor(Date.now()/1000)+600));
  const b: Binding = { program:client.program, ...created, mint:mint.address, recipient, owner:owner.address, agent:agent.address, version:1 };
  await client.deposit(owner,b,source,'100');
  const balance = async () => (await client.rpc.getTokenAccountBalance(b.vault,{commitment:'confirmed'}).send()).value.amount;
  const scope = bytes32('paid reference dataset');
  const buy = async (id:string, amount:string, binding=b, signer=agent, exception?: typeof b.policy) => client.send(signer,[await client.purchaseInstruction(signer,binding,bytes32(id),amount,scope,exception)]);

  await t.test('permitted transfer and immutable receipt', async()=>{
    await buy('allowed','20'); assert.equal(await balance(),'80');
    const receipt=await client.receipt(b,bytes32('allowed'),'confirmed'); assert.equal(receipt?.amount,'20');
  });
  await t.test('replay and unauthorized direct token transfer are blocked',async()=>{
    await assert.rejects(buy('allowed','20'));
    await assert.rejects(client.send(agent,[getTransferCheckedInstruction({ source:b.vault,mint:b.mint,destination:b.recipient,authority:agent,amount:1n,decimals:0 })]));
    assert.equal(await balance(),'80');
  });
  await t.test('wrong signer, recipient, version and mint are blocked',async()=>{
    await assert.rejects(buy('signer','1',b,owner));
    await assert.rejects(buy('recipient','1',{...b,recipient:badRecipient}));
    await assert.rejects(buy('version','1',{...b,version:2}));
    await assert.rejects(buy('mint','1',{...b,mint:source}));
    assert.equal(await balance(),'80');
  });
  await t.test('owner exception is exact and cannot override hard limits',async()=>{
    await assert.rejects(buy('exception','40'));
    const exception=await client.exception(owner,b,bytes32('exception'),'40',scope);
    await assert.rejects(buy('exception','41',b,agent,exception));
    await assert.rejects(client.send(agent,[await client.purchaseInstruction(agent,b,bytes32('exception'),'40',bytes32('tampered scope'),exception)]));
    await assert.rejects(client.exception(owner,b,bytes32('hard-limit'),'61',scope));
    await buy('exception','40',b,agent,exception); assert.equal(await balance(),'40');
  });
  await t.test('competing purchases cannot exceed remaining allowance',async()=>{
    const results=await Promise.allSettled([buy('race-a','30'),buy('race-b','30')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(await balance(),'10');
    await assert.rejects(client.exception(owner,b,bytes32('total'),'20',scope));
  });
  await t.test('revocation stops spending while the owner can withdraw',async()=>{
    await assert.rejects(client.withdraw(agent,b,recipient,'10'));
    await client.revoke(owner,b); await assert.rejects(buy('revoked','1'));
    await client.withdraw(owner,b,source,'10'); assert.equal(await balance(),'0');
  });
  await t.test('expired policies cannot be created',async()=>{
    await assert.rejects(client.create(owner,mint.address,agent.address,service.address,bytes32('expired'),'10','10','10',1n));
  });
});
