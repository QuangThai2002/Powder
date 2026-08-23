export const RECONCILIATION_VERSION='20.12.0';

export type ResourceEffectV20120={
  effectKey:string;
  resourceType:'currency'|'inventory'|'mail'|'reward'|'pow'|'progress'|'entitlement'|'other';
  resourceKey:string;
  deltaNumeric?:number|null;
  beforeState?:unknown;
  afterState?:unknown;
  metadata?:Record<string,unknown>;
};

// Call from the same canonical server mutation after the business result is known.
// The database function is idempotent by (user, scope, txKey, effectKey) and rejects
// a reused effectKey whose normalized effect hash changed.
export async function recordResourceEffectsV20120(db:any,args:{
  userId:string;scope:string;txKey:string;action:string;requestSha256?:string;resultSha256?:string;
  source?:'canonical_handler'|'legacy_bridge'|'atomic_handler'|'reconciliation_import';effects:ResourceEffectV20120[];
}){
  const receipts=[];
  for(const effect of args.effects||[]){
    const {data,error}=await db.rpc('powder_resource_effect_record_v20120',{
      p_user:args.userId,p_scope:args.scope,p_tx_key:args.txKey,p_action:args.action,
      p_effect_key:effect.effectKey,p_resource_type:effect.resourceType,p_resource_key:effect.resourceKey,
      p_delta_numeric:effect.deltaNumeric??null,p_before_state:effect.beforeState??null,p_after_state:effect.afterState??null,
      p_request_sha256:args.requestSha256||'',p_result_sha256:args.resultSha256||'',p_source:args.source||'canonical_handler',p_metadata:effect.metadata||{}
    });
    if(error)throw error;
    receipts.push(data);
  }
  return receipts;
}
