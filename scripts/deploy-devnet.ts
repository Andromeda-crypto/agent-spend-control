import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { address, generateKeyPairSigner, getAddressDecoder } from '@solana/kit';
import { uploadDeploymentBuffer } from '../packages/solana/deployment-buffer.js';
import { VaultClient, loadSigner } from '../packages/solana/client.js';

// This command is deliberately fixed to Devnet. It cannot select mainnet or a paid RPC.
const rpc='https://api.devnet.solana.com';
const programPath=resolve('.local/program-keypair.json'),deployerPath=resolve('.local/devnet-deployer.wallet.json');
const source=await readFile('programs/spending-vault/src/lib.rs','utf8');
const program=address(source.match(/declare_id!\("([^"]+)"\)/)![1]);
const binary=await readFile('target/deploy/spending_vault.so');
const programSigner=await loadSigner(programPath),deployer=await loadSigner(deployerPath);
if(programSigner.address!==program)throw new Error('Program keypair does not match declare_id.');
const client=new VaultClient(rpc,program);await client.assertCluster('devnet');
const balance=(await client.rpc.getBalance(deployer.address,{commitment:'finalized'}).send()).value;
const minimumRent=await client.rpc.getMinimumBalanceForRentExemption(BigInt(binary.length+45)).send();
const programRent=await client.rpc.getMinimumBalanceForRentExemption(36n).send();
const fundingFloor=minimumRent+programRent+10_000_000n;
const bufferPath=resolve('.local/devnet-buffer.wallet.json');
let bufferInfo;
try{const signer=await loadSigner(bufferPath);bufferInfo=(await client.rpc.getAccountInfo(signer.address,{encoding:'base64',commitment:'confirmed'}).send()).value;}catch{}
console.log(JSON.stringify({cluster:'devnet',program,deployer:deployer.address,upgradeAuthority:deployer.address,
  deployerLamports:balance.toString(),existingBufferLamports:bufferInfo?.lamports.toString()??'0',programDataRentLamports:minimumRent.toString(),minimumFundingFloorLamports:fundingFloor.toString(),
  note:'Free test SOL only. Account/buffer rent and network fees are separate from purchase budgets.'},null,2));
if(!process.argv.includes('--deploy'))process.exit(0);
const existing=(await client.rpc.getAccountInfo(program,{encoding:'base64',commitment:'confirmed'}).send()).value;
if(!existing?.executable){
  if(balance+(bufferInfo?.lamports??0n)<fundingFloor)throw new Error('Deployer plus its existing buffer need additional free Devnet test SOL. No deployment was attempted.');
  try{await access(bufferPath);}catch{
    const buffer=await generateKeyPairSigner(true);
    const seed=Buffer.from(await crypto.subtle.exportKey('pkcs8',buffer.keyPair.privateKey)).subarray(-32);
    const pub=Buffer.from(await crypto.subtle.exportKey('raw',buffer.keyPair.publicKey));
    await writeFile(bufferPath,JSON.stringify([...seed,...pub]),{mode:0o600});
  }
  const cli=join(process.env.SOLANA_BIN??join(homedir(),'.local/share/solana/install/active_release/bin'),'solana');
  try{
    await uploadDeploymentBuffer(client,deployer,await loadSigner(bufferPath),binary);
    const binaryArgs:string[]=[];
    console.log('Finalizing the verified deployment buffer.');
    await promisify(execFile)(cli,['program','deploy',...binaryArgs,'--url',rpc,
      '--keypair',deployerPath,'--fee-payer',deployerPath,'--program-id',programPath,'--buffer',bufferPath,
      '--upgrade-authority',deployerPath,'--with-compute-unit-price','0','--max-sign-attempts','2','--use-quic','--use-rpc','--output','json'],{maxBuffer:1024*1024});
  }catch(error){
    const details=error as {stderr?:string};
    await writeFile('.local/devnet-deploy-error.log',details.stderr??(error instanceof Error?error.message:'Deployment failed without diagnostics.'),{mode:0o600});
    throw new Error('Devnet deployment failed or is uncertain. The explicit local buffer keypair is retained; inspect chain state and test-SOL funding before retrying. No new buffer keypair is generated on retry. Diagnostics: .local/devnet-deploy-error.log');
  }
}
let info;
for(let i=0;i<60;i++){
  info=(await client.rpc.getAccountInfo(program,{encoding:'base64',commitment:'finalized'}).send()).value;
  if(info?.executable)break;
  await new Promise(resolve=>setTimeout(resolve,1000));
}
const loader=address('BPFLoaderUpgradeab1e11111111111111111111111');
if(!info||!info.executable||info.owner!==loader)throw new Error('Deployment not yet verified at finalized commitment.');
const programData=Buffer.from(info.data[0],'base64');
if(programData.readUInt32LE(0)!==2)throw new Error('Unexpected program loader state.');
const dataAddress=getAddressDecoder().decode(programData.subarray(4,36));
const dataInfo=(await client.rpc.getAccountInfo(dataAddress,{encoding:'base64',commitment:'finalized'}).send()).value;
if(!dataInfo||dataInfo.owner!==loader)throw new Error('Program data missing.');
const data=Buffer.from(dataInfo.data[0],'base64');
if(data.readUInt32LE(0)!==3||data[12]!==1||getAddressDecoder().decode(data.subarray(13,45))!==deployer.address
  ||!data.subarray(45,45+binary.length).equals(binary))throw new Error('Deployed binary or upgrade authority does not match this checkpoint. No automatic upgrade was attempted.');
const receipt={cluster:'devnet',program,programData:dataAddress,upgradeAuthority:deployer.address,
  binarySha256:createHash('sha256').update(binary).digest('hex'),explorer:`https://explorer.solana.com/address/${program}?cluster=devnet`,verifiedAt:new Date().toISOString()};
await mkdir('docs/deployments',{recursive:true});await writeFile('docs/deployments/devnet.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
