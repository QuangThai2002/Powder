// Powder 20.10.0 shared client for server-side callers.
// Canonical write handlers should be registered in mutation_contracts_v20100 and expose
// (p_user uuid, p_payload jsonb) returns jsonb. Do not call the 20.9 split BEGIN/COMMIT
// protocol around a 20.10 atomic gateway transaction.
export type MutationScope='economy'|'inventory'|'reward'|'mail'|'event'|'purchase'|'support';
export async function executeAtomicMutation(db:any,userId:string,args:{scope:MutationScope;action:string;txKey:string;payload?:unknown}){
  const {data,error}=await db.rpc('powder_mutation_execute_v20100',{p_user:userId,p_scope:args.scope,p_action:args.action,p_tx_key:args.txKey,p_payload:args.payload??{}});
  if(error)throw error;
  if(data?.ok===false){const e:any=new Error(String(data?.message||data?.error||'MUTATION_20100_FAILED'));e.code=data?.error||'MUTATION_20100_FAILED';e.result=data;throw e;}
  return data;
}
