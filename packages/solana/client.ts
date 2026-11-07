import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  address, AccountRole, appendTransactionMessageInstructions, createTransactionMessage,
  createDefaultRpcTransport, createSolanaRpcFromTransport, devnet, createKeyPairSignerFromBytes, getAddressEncoder, getAddressDecoder, getProgramDerivedAddress,
  getBase64EncodedWireTransaction, getSignatureFromTransaction, pipe,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners, type Address, type Instruction, type KeyPairSigner,
} from '@solana/kit';
import { pacedTransport } from './rpc-pacing.js';
import { assertClusterIdentity } from './cluster.js';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

export const SYSTEM = address('11111111111111111111111111111111');
export const bytes32 = (value: string) => createHash('sha256').update(value).digest();
export const discriminator = (name: string) => bytes32(`global:${name}`).subarray(0, 8);
export const u64 = (n: string | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
export const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
export const keyBytes = (key: Address) => Buffer.from(getAddressEncoder().encode(key));
export const readonly = (key: Address) => ({ address: key, role: AccountRole.READONLY });
export const writable = (key: Address) => ({ address: key, role: AccountRole.WRITABLE });
export const signing = (s: KeyPairSigner) => ({ address: s.address, role: AccountRole.WRITABLE_SIGNER, signer: s });
export async function loadSigner(path: string) {
  return createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(await readFile(path, 'utf8'))));
}
export type Binding = { program: Address; policy: Address; vault: Address; mint: Address; recipient: Address; owner: Address; agent: Address; version: number };
export class VaultClient {
  readonly rpc;
  constructor(readonly url: string, readonly program: Address) {
    const host = new URL(url).hostname;
    if (!['localhost','127.0.0.1','api.devnet.solana.com'].includes(host)) throw new Error('only_localnet_or_devnet_allowed');
    const transport=createDefaultRpcTransport({url:devnet(url)});
    this.rpc = createSolanaRpcFromTransport(host==='api.devnet.solana.com'?pacedTransport(transport,url):transport);
  }
  async assertCluster(cluster: 'localnet' | 'devnet') {
    const genesis=await this.rpc.getGenesisHash().send();
    assertClusterIdentity(cluster,genesis,new URL(this.url).hostname);
    return genesis;
  }
  async pda(...seeds: Uint8Array[]) { return (await getProgramDerivedAddress({ programAddress: this.program, seeds }))[0]; }
  instruction(name: string, accounts: NonNullable<Instruction['accounts']>, ...data: Uint8Array[]): Instruction {
    return { programAddress: this.program, accounts, data: Buffer.concat([discriminator(name), ...data]) };
  }
  async prepare(payer: KeyPairSigner, instructions: Instruction[]) {
    const { value: latest } = await this.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    const message = pipe(createTransactionMessage({ version: 0 }), m => setTransactionMessageFeePayerSigner(payer, m),
      m => setTransactionMessageLifetimeUsingBlockhash(latest, m), m => appendTransactionMessageInstructions(instructions, m));
    const tx = await signTransactionMessageWithSigners(message);
    return { signature: getSignatureFromTransaction(tx), wire: getBase64EncodedWireTransaction(tx), lastValidBlockHeight: latest.lastValidBlockHeight.toString() };
  }
  async send(payer: KeyPairSigner, instructions: Instruction[]) {
    const prepared = await this.prepare(payer, instructions);
    let accepted;
    try{accepted=await this.rpc.sendTransaction(prepared.wire, { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 10n }).send();}
    catch(error){throw new Error(`Transaction submission failed for ${payer.address} (${instructions.map(i=>i.programAddress).join(',')}): ${error instanceof Error?error.message:'RPC error'}`);}
    if (accepted !== prepared.signature) throw new Error('rpc_signature_mismatch');
    for (let i = 0; i < 60; i++) {
      const { value } = await this.rpc.getSignatureStatuses([prepared.signature], { searchTransactionHistory: true }).send();
      if (value[0]?.err) throw new Error('transaction_failed:' + JSON.stringify(value[0].err));
      if (value[0]?.confirmationStatus && value[0].confirmationStatus !== 'processed') return prepared.signature;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('transaction_pending:' + prepared.signature);
  }
  async createInstruction(owner: KeyPairSigner, mint: Address, agent: Address, recipientWallet: Address,
    taskId: Uint8Array, total: string, perPayment: string, approvalAbove: string, expiry: bigint) {
    const policy = await this.pda(Buffer.from('task'), keyBytes(owner.address), taskId);
    const vault = await this.pda(Buffer.from('vault'), keyBytes(policy));
    const expiryBytes = Buffer.alloc(8); expiryBytes.writeBigInt64LE(expiry);
    const ix = this.instruction('create', [signing(owner), writable(policy), readonly(mint), writable(vault), readonly(TOKEN_PROGRAM_ADDRESS), readonly(SYSTEM)],
      taskId, keyBytes(agent), keyBytes(recipientWallet), u64(total), u64(perPayment), u64(approvalAbove), expiryBytes);
    return { policy, vault, instruction: ix };
  }
  async create(owner: KeyPairSigner, mint: Address, agent: Address, recipientWallet: Address,
    taskId: Uint8Array, total: string, perPayment: string, approvalAbove: string, expiry: bigint) {
    const prepared=await this.createInstruction(owner,mint,agent,recipientWallet,taskId,total,perPayment,approvalAbove,expiry);
    await this.send(owner,[prepared.instruction]);
    return {policy:prepared.policy,vault:prepared.vault};
  }
  depositInstruction(owner: KeyPairSigner, b: Binding, source: Address, amount: string) {
    return this.instruction('deposit', [signing(owner), readonly(b.policy), readonly(b.mint), writable(source), writable(b.vault), readonly(TOKEN_PROGRAM_ADDRESS)], u64(amount));
  }
  deposit(owner: KeyPairSigner, b: Binding, source: Address, amount: string) {
    return this.send(owner, [this.depositInstruction(owner,b,source,amount)]);
  }
  async exception(owner: KeyPairSigner, b: Binding, purchaseId: Uint8Array, amount: string, scope: Uint8Array) {
    const exception = await this.pda(Buffer.from('exception'), keyBytes(b.policy), purchaseId);
    const existing = await this.rpc.getAccountInfo(exception, { encoding: 'base64', commitment: 'confirmed' }).send();
    if(existing.value){
      const d=Buffer.from(existing.value.data[0],'base64');
      if(existing.value.owner!==this.program||d.length!==116||!d.subarray(0,8).equals(bytes32('account:ScopedException').subarray(0,8))
        ||!d.subarray(8,40).equals(keyBytes(b.policy))||!d.subarray(40,72).equals(purchaseId)||d.readBigUInt64LE(72)!==BigInt(amount)
        ||!d.subarray(80,112).equals(scope)||d.readUInt32LE(112)!==b.version)throw new Error('exception_conflict');
    }
    if (!existing.value) await this.send(owner, [this.instruction('grant_exception', [signing(owner), readonly(b.policy), writable(exception), readonly(SYSTEM)], purchaseId, u64(amount), scope, u32(b.version))]);
    return exception;
  }
  async purchaseInstruction(agent: KeyPairSigner, b: Binding, purchaseId: Uint8Array, amount: string, scope: Uint8Array, exception?: Address) {
    const receipt = await this.pda(Buffer.from('purchase'), keyBytes(b.policy), purchaseId);
    return this.instruction('purchase', [signing(agent), writable(b.policy), readonly(b.mint), writable(b.vault), writable(b.recipient), writable(receipt),
      readonly(exception ?? this.program), readonly(TOKEN_PROGRAM_ADDRESS), readonly(SYSTEM)], purchaseId, u64(amount), scope, u32(b.version));
  }
  revoke(owner: KeyPairSigner, b: Binding) { return this.send(owner, [this.instruction('revoke', [signing(owner), writable(b.policy)])]); }
  withdraw(owner: KeyPairSigner, b: Binding, destination: Address, amount: string) {
    return this.send(owner, [this.instruction('withdraw', [signing(owner), readonly(b.policy), readonly(b.mint), writable(b.vault), writable(destination), readonly(TOKEN_PROGRAM_ADDRESS)], u64(amount))]);
  }
  async policy(policy: Address, commitment: 'confirmed' | 'finalized' = 'finalized') {
    const { value } = await this.rpc.getAccountInfo(policy, { encoding:'base64', commitment }).send();
    if (!value || value.owner !== this.program) throw new Error('invalid_policy_account');
    const d = Buffer.from(value.data[0], 'base64');
    if (d.length !== 214 || !d.subarray(0,8).equals(bytes32('account:TaskPolicy').subarray(0,8))) throw new Error('invalid_policy_data');
    const key = (offset:number) => getAddressDecoder().decode(d.subarray(offset,offset+32));
    return { taskId:d.subarray(136,168).toString('hex'),owner:key(8),agent:key(40),recipient:key(72),mint:key(104), total:d.readBigUInt64LE(168),
      perPayment:d.readBigUInt64LE(176),approvalAbove:d.readBigUInt64LE(184),expiresAt:d.readBigInt64LE(192),
      spent:d.readBigUInt64LE(200),version:d.readUInt32LE(208),revoked:!!d[212] };
  }
  async receipt(b: Binding, purchaseId: Uint8Array, commitment: 'confirmed' | 'finalized' = 'finalized') {
    const receipt = await this.pda(Buffer.from('purchase'), keyBytes(b.policy), purchaseId);
    const { value } = await this.rpc.getAccountInfo(receipt, { encoding: 'base64', commitment }).send();
    if (!value) return null;
    if (value.owner !== this.program) throw new Error('wrong_receipt_owner');
    const data = Buffer.from(value.data[0], 'base64');
    if (data.length !== 116 || !data.subarray(0,8).equals(bytes32('account:PurchaseReceipt').subarray(0,8))
      || !data.subarray(8,40).equals(keyBytes(b.policy)) || !data.subarray(40,72).equals(purchaseId)) throw new Error('invalid_chain_receipt');
    return { address: receipt, rentLamports:value.lamports.toString(), amount: data.readBigUInt64LE(72).toString(), scope: data.subarray(80,112).toString('hex'), version: data.readUInt32LE(112) };
  }
}
