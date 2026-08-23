export const ADMIN_SECURITY_VERSION_V20160='20.16.0';

type GuardInput={
  req:Request;db:any;jwt:string;userId:string;email:string;role:string;functionName:string;action:string;
};

const b64url=(s:string)=>{let x=s.replace(/-/g,'+').replace(/_/g,'/');while(x.length%4)x+='=';return x};
export const decodeAdminClaimsV20160=(jwt:string)=>{try{return JSON.parse(atob(b64url(String(jwt).split('.')[1]||'')))}catch{return{}}};
export const hashAdminTokenV20160=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');

export async function enforceAdminAccessV20160(x:GuardInput){
  const c=decodeAdminClaimsV20160(x.jwt),iat=Math.trunc(Number(c?.iat)||0),exp=Math.trunc(Number(c?.exp)||0);
  const rawAal=String(c?.aal||'');
  const aal=rawAal||(Array.isArray(c?.amr)&&c.amr.some((v:any)=>String(v?.method||v).toLowerCase()==='totp')?'aal2':'');
  const tokenHash=await hashAdminTokenV20160(x.jwt);
  const origin=String(x.req.headers.get('Origin')||'').trim().slice(0,300);
  const {data,error}=await x.db.rpc('powder_security_admin_access_v20160',{
    p_user:x.userId,p_email:x.email,p_role:x.role,p_function:x.functionName,p_action:String(x.action||'state').slice(0,120),p_origin:origin,
    p_token_sha256:tokenHash,p_token_iat:iat,p_token_exp:exp,p_aal:aal
  });
  if(error)throw Object.assign(new Error(`Security 20.16 guard unavailable: ${String(error.message||error)}`),{status:503,code:'SEC20160_GUARD_UNAVAILABLE'});
  if(data?.allowed!==true){
    const code=String(data?.code||'SEC20160_DENIED'),status=/TOKEN|SESSION/.test(code)?401:403;
    throw Object.assign(new Error(code==='SEC20160_AAL2_REQUIRED'?'Thao tác bảo mật cao yêu cầu Owner đăng nhập với MFA/AAL2.':code==='SEC20160_ORIGIN_DENIED'?'Origin Admin chưa nằm trong allowlist 20.16.':'Security & Permission 20.16 đã chặn request.'),{status,code});
  }
  return data;
}
