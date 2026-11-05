import {decrypt} from './crypto.ts';
import {encryptionSecretConfigured} from './torn-key-policy.ts';
type KeyAdmin={rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const secrets=new WeakMap<object,Promise<string>>();
async function vaultSecret(admin:KeyAdmin){
 let value=secrets.get(admin);if(!value){value=(async()=>{const result=await admin.rpc('get_torn_key_encryption_secret');if(result.error||typeof result.data!=='string'||!encryptionSecretConfigured(result.data))throw new Error('Encrypted backend storage is unavailable.');return result.data;})();secrets.set(admin,value);value.catch(()=>{secrets.delete(admin);});}
 return value;
}
/** Service-role-only secret lookup; no encryption material is sent in frontend responses. */
export async function tornEncryptionSecret(admin:KeyAdmin,environmentSecret?:string){return encryptionSecretConfigured(environmentSecret)?environmentSecret!:await vaultSecret(admin);}
/** Preserve legacy environment-encrypted keys while supporting the server-only Vault key. */
export async function decryptBackendTornKey(admin:KeyAdmin,ciphertext:string,environmentSecret?:string){
 if(environmentSecret){try{return await decrypt(ciphertext,environmentSecret);}catch{/* Try the Vault key without replacing legacy ciphertext. */}}
 return await decrypt(ciphertext,await vaultSecret(admin));
}
