import {adminClient,json,preflight} from '../_shared/http.ts';
import {fingerprint,LoginError} from '../_shared/torn-login.ts';
import {tornEncryptionSecret} from '../_shared/torn-key-storage.ts';
import {registrationBody,registerWithTorn} from '../_shared/torn-register.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const input=await registrationBody(req),admin=adminClient();
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown';
  const limiterSecret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const limited=await admin.rpc('consume_torn_login_budget',{ip_fingerprint:await fingerprint(ip,limiterSecret),key_fingerprint:await fingerprint(input.apiKey,limiterSecret)});
  if(limited.error)throw new Error('Limiter unavailable');
  if(limited.data!==true)return json({error:'Too many attempts. Wait a minute and retry.'},429);
  const secret=await tornEncryptionSecret(admin,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
  return json(await registerWithTorn(admin,input,secret));
 }catch(error){return json({error:error instanceof LoginError?error.message:'Registration is temporarily unavailable. Try again later.'},error instanceof LoginError?error.status:503);}
});
