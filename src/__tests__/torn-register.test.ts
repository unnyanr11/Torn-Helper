import {describe,it,expect,vi} from 'vitest';
import {registrationBody,registerWithTorn} from '../../supabase/functions/_shared/torn-register';
import {loginWithTorn} from '../../supabase/functions/_shared/torn-login';
import {decrypt} from '../../supabase/functions/_shared/crypto';
const input={username:'Player_1',tornId:123,apiKey:'AbCdEf0123456789',email:'player@example.com',password:'a strong password 123',persist:true as const};
const secret=btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const upstream=vi.fn(async(url:any)=>new Response(JSON.stringify(String(url).endsWith('/user/basic')?{profile:{id:123,name:'Player'}}:{info:{user:{id:123},access:{type:'Limited Access'}}}))) as unknown as typeof fetch;
function backend(existing=false){return {
 from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:existing?{user_id:'old'}:null,error:null})})})})),
 rpc:vi.fn(async()=>({data:'new',error:null})),
 auth:{resend:vi.fn(async()=>({error:null})),admin:{
 createUser:vi.fn(async()=>({data:{user:{id:'new'}},error:null})),deleteUser:vi.fn(async()=>({error:null})),
 getUserById:vi.fn(async()=>({data:{user:{id:'new',email:input.email,email_confirmed_at:null}},error:null})),generateLink:vi.fn()
 }}
};}
describe('verified Torn registration',()=>{
 it('bounds and validates public input before upstream calls',async()=>{
  const req=(body:unknown)=>new Request('https://app.invalid',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)});
  expect(await registrationBody(req({...input,email:' Player@Example.com ',tornId:'123'}))).toEqual(input);
  for(const body of ['x'.repeat(4097),'{}','{',{...input,persist:false},{...input,tornId:1.5},{...input,password:'short'},{...input,username:'<script>'},{...input,email:'bad'}])await expect(registrationBody(req(body))).rejects.toThrow();
 });
 it('rejects mismatched IDs and existing accounts before creating any credentials',async()=>{
  const admin=backend();await expect(registerWithTorn(admin,{...input,tornId:999},secret,upstream)).rejects.toThrow('does not belong');expect(admin.from).not.toHaveBeenCalled();
  const existing=backend(true);await expect(registerWithTorn(existing,input,secret,upstream)).rejects.toThrow('already has an account');expect(existing.auth.admin.createUser).not.toHaveBeenCalled();
 });
 it('requires email confirmation, encrypts the key and never returns credentials',async()=>{
  const admin=backend();const result=await registerWithTorn(admin,input,secret,upstream);
  expect(admin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({email_confirm:false,password:input.password,user_metadata:{username:input.username}}));
  const args=(admin.rpc.mock.calls[0] as any)[1];expect(await decrypt(args.ciphertext,secret)).toBe(input.apiKey);
  expect(admin.auth.resend).toHaveBeenCalledWith({type:'signup',email:input.email});expect(result.confirmation_sent).toBe(true);
  expect(JSON.stringify(result)).not.toContain(input.apiKey);expect(JSON.stringify(result)).not.toContain(input.password);
 });
 it('does not overwrite credentials of a concurrent winning account',async()=>{
  const admin=backend();admin.rpc.mockResolvedValueOnce({data:'winner',error:null});
  await expect(registerWithTorn(admin,input,secret,upstream)).rejects.toThrow('already has an account');
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('new');expect(admin.auth.resend).not.toHaveBeenCalled();
 });
 it('reports delivery failure without deleting a committed account',async()=>{
  const admin=backend();admin.auth.resend.mockResolvedValueOnce({error:new Error('delivery')} as any);
  const result=await registerWithTorn(admin,input,secret,upstream);expect(result.confirmation_sent).toBe(false);expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
 });
 it('does not auto-confirm a registered email through the Torn magic-link fallback',async()=>{
  const admin=backend(true);admin.rpc.mockResolvedValueOnce({data:'new',error:null});
  await expect(loginWithTorn(admin as any,input.apiKey,true,secret,upstream)).rejects.toThrow('Confirm your registration email');expect(admin.auth.admin.generateLink).not.toHaveBeenCalled();
 });
});
