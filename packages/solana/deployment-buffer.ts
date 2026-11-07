import { address, getAddressDecoder, type KeyPairSigner } from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import { VaultClient, readonly, signing, writable, u32, u64 } from './client.js';
export const UPGRADEABLE_LOADER=address('BPFLoaderUpgradeab1e11111111111111111111111');

/** Mirrors solana-loader-v3-interface 3.0.0's bincode InitializeBuffer/Write instructions. */
export async function uploadDeploymentBuffer(client:VaultClient,owner:KeyPairSigner,buffer:KeyPairSigner,binary:Buffer){
  await client.assertCluster('devnet');
  let info=(await client.rpc.getAccountInfo(buffer.address,{encoding:'base64',commitment:'confirmed'}).send()).value;
  if(!info){
    await client.send(owner,[getCreateAccountInstruction({payer:owner,newAccount:buffer,
      lamports:await client.rpc.getMinimumBalanceForRentExemption(BigInt(binary.length+37)).send(),space:BigInt(binary.length+37),programAddress:UPGRADEABLE_LOADER}),
      {programAddress:UPGRADEABLE_LOADER,accounts:[writable(buffer.address),readonly(owner.address)],data:u32(0)}]);
    info=(await client.rpc.getAccountInfo(buffer.address,{encoding:'base64',commitment:'confirmed'}).send()).value;
  }
  if(!info||info.owner!==UPGRADEABLE_LOADER)throw new Error('Invalid deployment buffer owner.');
  const data=Buffer.from(info.data[0],'base64');
  if(data.length!==binary.length+37||data.readUInt32LE(0)!==1||data[4]!==1||getAddressDecoder().decode(data.subarray(5,37))!==owner.address)throw new Error('Deployment buffer authority or size mismatch.');
  const existing=data.subarray(37),chunkSize=800;
  let writes=0;
  for(let offset=0;offset<binary.length;offset+=chunkSize){
    const chunk=binary.subarray(offset,offset+chunkSize);
    if(!existing.subarray(offset,offset+chunkSize).equals(chunk)){
      for(let attempt=0;;attempt++){
        try{await client.send(owner,[{programAddress:UPGRADEABLE_LOADER,accounts:[writable(buffer.address),signing(owner)],data:Buffer.concat([u32(1),u32(offset),u64(BigInt(chunk.length)),chunk])}]);break;}
        catch(error){
          const observed=(await client.rpc.getAccountInfo(buffer.address,{encoding:'base64',commitment:'confirmed'}).send()).value;
          if(observed&&Buffer.from(observed.data[0],'base64').subarray(37+offset,37+offset+chunk.length).equals(chunk))break;
          if(attempt>=2)throw error;
          console.log('Buffer write not yet observed; waiting before an idempotent retry.');
          await new Promise(resolve=>setTimeout(resolve,5000));
        }
      }
      writes++;
    }
    if(offset%(chunkSize*20)===0)console.log(`Deployment buffer ${Math.floor(100*offset/binary.length)}% checked; ${writes} sequential writes confirmed.`);
  }
  const final=(await client.rpc.getAccountInfo(buffer.address,{encoding:'base64',commitment:'confirmed'}).send()).value;
  if(!final||!Buffer.from(final.data[0],'base64').subarray(37,37+binary.length).equals(binary))throw new Error('Deployment buffer verification failed.');
  console.log(`Deployment buffer verified byte-for-byte; ${writes} new writes.`);
}
