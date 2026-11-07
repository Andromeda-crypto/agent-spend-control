import { address } from '@solana/kit';
import { createReferenceService } from './service.js';
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`missing_${name}`);return value;};
const cluster=required('SOLANA_CLUSTER');if(!['localnet','devnet'].includes(cluster))throw new Error('unsupported_cluster');
createReferenceService({rpc:required('SOLANA_RPC_URL'),program:address(required('SOLANA_PROGRAM_ID')),mint:address(required('REFERENCE_MINT')),
 recipientWallet:address(required('REFERENCE_RECIPIENT')),cluster:cluster as 'localnet'|'devnet'}).listen(Number(process.env.REFERENCE_PORT??3002),'127.0.0.1');
