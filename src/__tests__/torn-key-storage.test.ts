import {describe,it,expect,vi} from 'vitest';
import {encrypt} from '../../supabase/functions/_shared/crypto';
import {tornEncryptionSecret,decryptBackendTornKey} from '../../supabase/functions/_shared/torn-key-storage';
const vault=btoa(String.fromCharCode(...new Uint8Array(32).fill(6))),environment=btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
describe('server-only Torn credential encryption',()=>{
 it('uses a valid environment key without a Vault call',async()=>{const admin={rpc:vi.fn()};expect(await tornEncryptionSecret(admin,environment)).toBe(environment);expect(admin.rpc).not.toHaveBeenCalled();});
 it('falls back to Vault and reuses the service lookup within a request',async()=>{const admin={rpc:vi.fn(async()=>({data:vault,error:null}))};expect(await tornEncryptionSecret(admin,undefined)).toBe(vault);expect(await tornEncryptionSecret(admin,'invalid-config')).toBe(vault);expect(admin.rpc).toHaveBeenCalledTimes(1);});
 it('decrypts existing environment records and new Vault records without deleting either',async()=>{const admin={rpc:vi.fn(async()=>({data:vault,error:null}))},old=await encrypt('old-key',environment),fresh=await encrypt('new-key',vault);expect(await decryptBackendTornKey(admin,old,environment)).toBe('old-key');expect(await decryptBackendTornKey(admin,fresh,environment)).toBe('new-key');});
 it('fails closed when no service-side encryption material is available',async()=>{const admin={rpc:vi.fn(async()=>({data:null,error:{message:'denied'}}))};await expect(tornEncryptionSecret(admin)).rejects.toThrow('unavailable');});
});
