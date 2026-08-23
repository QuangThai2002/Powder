// Powder 20.9.0 shared helper for server-authoritative resource mutations.
// Use BEGIN -> authoritative DB mutation -> COMMIT. Never commit before the mutation succeeds.
export type TxScope='economy'|'inventory'|'reward'|'mail'|'event'|'purchase'|'support';
export type TxBegin={execute:boolean;idempotent?:boolean;inFlight?:boolean;status:string;txKey:string;leaseToken?:string;result?:unknown;retryAfterMs?:number};

export async function beginTransaction(db:any,userId:string,args:{scope:TxScope;operation:string;txKey:string;payload?:unknown;leaseSeconds?:number}):Promise<TxBegin>{
  const {data,error}=await db.rpc('powder_transaction_begin_v2090',{p_user:userId,p_scope:args.scope,p_operation:args.operation,p_tx_key:args.txKey,p_payload:args.payload??{},p_lease_seconds:args.leaseSeconds??45});
  if(error)throw error;
  return data as TxBegin;
}
export async function commitTransaction(db:any,userId:string,args:{scope:TxScope;txKey:string;leaseToken:string;result?:unknown}){
  const {data,error}=await db.rpc('powder_transaction_commit_v2090',{p_user:userId,p_scope:args.scope,p_tx_key:args.txKey,p_lease_token:args.leaseToken,p_result:args.result??{}});if(error)throw error;return data;
}
export async function failTransaction(db:any,userId:string,args:{scope:TxScope;txKey:string;leaseToken:string;code:string;message:string;retryable?:boolean}){
  const {data,error}=await db.rpc('powder_transaction_fail_v2090',{p_user:userId,p_scope:args.scope,p_tx_key:args.txKey,p_lease_token:args.leaseToken,p_error_code:args.code,p_error_message:args.message,p_retryable:!!args.retryable});if(error)throw error;return data;
}
export async function withTransaction<T>(db:any,userId:string,args:{scope:TxScope;operation:string;txKey:string;payload?:unknown},work:()=>Promise<T>):Promise<{result:T;idempotent:boolean}>{
  const begin=await beginTransaction(db,userId,args);
  if(!begin.execute){
    if(begin.status==='committed')return{result:begin.result as T,idempotent:true};
    const e:any=new Error('TX_2090_IN_FLIGHT');e.status=409;e.retryAfterMs=begin.retryAfterMs||500;throw e;
  }
  const lease=String(begin.leaseToken||'');if(!lease)throw new Error('TX_2090_LEASE_MISSING');
  try{const result=await work();await commitTransaction(db,userId,{scope:args.scope,txKey:args.txKey,leaseToken:lease,result});return{result,idempotent:false};}
  catch(e:any){const status=Number(e?.status||0),retryable=!status||status===408||status===425||status===429||status>=500;try{await failTransaction(db,userId,{scope:args.scope,txKey:args.txKey,leaseToken:lease,code:String(e?.code||status||'MUTATION_FAILED'),message:String(e?.message||e),retryable})}catch(_){}throw e;}
}
