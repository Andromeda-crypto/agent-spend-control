import { SpendingClient,PendingRequestError } from '../../packages/sdk/src/index.js';
import { referenceTool } from './reference-tool.js';
const required=(name:string)=>{const value=process.env[name];if(!value)throw Error(`Configure ${name} privately.`);return value;};
try{
 const client=new SpendingClient(required('SPEND_GATEWAY_URL'),required('SPEND_AGENT_TOKEN'));
 const task=required('SPEND_TASK_ID'),operationId=required('AGENT_OPERATION_ID');
 const dataset=process.argv[2]??'basic';if(dataset!=='basic'&&dataset!=='premium')throw Error('Choose basic or premium.');
 const result=await referenceTool(client,task)({operationId,dataset,topic:'Safe spending on Solana'},
   {onApproval:id=>console.log(`Purchase ${id} needs owner approval in the private console. Waiting; no approval sent by this agent.`)});
 console.log(JSON.stringify({request:result.request.id,state:result.request.state,charged:result.usage?.charged_amount??null,delivery:result.usage?.delivery??null,receipt:result.usage?.receipt??null},null,2));
 if(result.request.state!=='succeeded')process.exitCode=1;
}catch(error){
 if(error instanceof PendingRequestError)console.error(`Purchase ${error.requestId} is pending. Rerun with the SAME operation ID and input to resume; do not pay again.`);
 else console.error(error instanceof Error?error.message:'Agent tool request failed.');
 process.exitCode=1;
}
