import { encrypt } from './crypto.ts';
import { LoginError, verifiedTornIdentity } from './torn-login.ts';

export interface Registration {
 username: string; tornId: number; apiKey: string; email: string; password: string; persist: true;
}
export async function registrationBody(req: Request): Promise<Registration> {
 const reader=req.body?.getReader(); if(!reader)throw new LoginError(400,'Registration details required.');
 const chunks:Uint8Array[]=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();throw new LoginError(413,'Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new LoginError(400,'Invalid registration details.');}
 const username=typeof body?.username==='string'?body.username.trim():'';
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 const tornId=typeof body?.tornId==='string'&&/^\d+$/.test(body.tornId)?Number(body.tornId):body?.tornId;
 if(!/^[A-Za-z0-9_-]{3,30}$/.test(username))throw new LoginError(400,'Username must contain 3–30 letters, numbers, underscores or hyphens.');
 if(!Number.isSafeInteger(tornId)||tornId<1)throw new LoginError(400,'Enter a valid Torn ID.');
 if(typeof body.apiKey!=='string'||!/^[A-Za-z0-9]{16}$/.test(body.apiKey))throw new LoginError(400,'Enter a valid 16-character Torn API key.');
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('.invalid'))throw new LoginError(400,'Enter a valid email address.');
 if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new LoginError(400,'Use a password between 12 and 128 characters.');
 if(body.persist!==true)throw new LoginError(400,'Acknowledge encrypted backend key storage to register.');
 return {username,email,tornId,apiKey:body.apiKey,password:body.password,persist:true};
}

// Injectable dependencies keep ownership checks, races and credential handling testable.
export async function registerWithTorn(admin:any, input:Registration, secret:string, fetcher:typeof fetch=fetch){
 const identity=await verifiedTornIdentity(input.apiKey,fetcher);
 if(identity.id!==input.tornId)throw new LoginError(400,'The API key does not belong to the supplied Torn ID.');
 let ciphertext:string;try{ciphertext=await encrypt(input.apiKey,secret);}catch{throw new LoginError(503,'Encrypted key storage is not configured.');}
 const lookup=await admin.from('linked_torn_accounts').select('user_id').eq('torn_id',identity.id).maybeSingle();
 if(lookup.error)throw lookup.error;
 if(lookup.data)throw new LoginError(409,'This Torn player already has an account. Use Continue with Torn to access your existing data.');
 const created=await admin.auth.admin.createUser({email:input.email,password:input.password,email_confirm:false,user_metadata:{username:input.username},app_metadata:{identity_provider:'torn',torn_id:identity.id,registration:'email'}});
 if(created.error||!created.data.user)throw new LoginError(409,'Unable to register with these details. If you already registered, confirm your email or sign in.');
 const userId=created.data.user.id;
 let complete;
 try{complete=await admin.rpc('complete_torn_login',{player_id:identity.id,proposed_user:userId,player_name:identity.name,access_level:identity.access,persist_key:true,ciphertext});}
 catch{throw new LoginError(503,'Registration could not be completed. Contact the site owner before retrying.');}
 if(complete.error){
  // Delete only when PostgreSQL confirms rollback; a transport failure may follow a commit.
  if(typeof complete.error.code==='string'&&/^[0-9A-Z]{5}$/.test(complete.error.code))await admin.auth.admin.deleteUser(userId);
  throw new LoginError(503,'Registration could not be completed. Contact the site owner before retrying.');
 }
 if(complete.data!==userId){await admin.auth.admin.deleteUser(userId);throw new LoginError(409,'This Torn player already has an account. Use Continue with Torn.');}
 const sent=await admin.auth.resend({type:'signup',email:input.email});
 return {registered:true,confirmation_sent:!sent.error,message:sent.error?'Account created. The confirmation email could not be sent. Use Resend confirmation below.':'Account created. Check your email to confirm your address, then sign in.'};
}
