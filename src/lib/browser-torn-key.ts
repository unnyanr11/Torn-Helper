export type BrowserTornKey={version:1;ownerId:string;tornId:number;key:string;savedAt:string};
export const BROWSER_KEY_EVENT='torn:browser-key-change';
export const browserKeySlot=(ownerId:string)=>`tcc:torn-key:v1:${ownerId}`;
type KeyStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const memoryKeys=new Map<string,BrowserTornKey>();
export function clearBrowserTornKeys(){memoryKeys.clear();}
/** Remove legacy plaintext copies on startup without reading their contents. */
export function purgeLegacyBrowserKeys(storage:Storage){
 const slots:string[]=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('tcc:torn-key:v1:'))slots.push(key);}
 for(const slot of slots)storage.removeItem(slot);
 if(slots.some(slot=>storage.getItem(slot)!==null))throw new Error('Clear this site’s browser storage to remove legacy key copies.');
}
/** Session memory only; storage is used solely to delete legacy plaintext records. */
export function readBrowserTornKey(storage:KeyStorage,ownerId:string):BrowserTornKey|null{
 storage.removeItem(browserKeySlot(ownerId));
 const record=memoryKeys.get(ownerId);return record?{...record}:null;
}
export function removeBrowserTornKey(storage:KeyStorage,ownerId:string){memoryKeys.delete(ownerId);storage.removeItem(browserKeySlot(ownerId));}
export function writeBrowserTornKey(storage:KeyStorage,ownerId:string,tornId:number,key:string,now=Date.now()){
 if(!ownerId||!Number.isSafeInteger(tornId)||tornId<=0||!/^[A-Za-z0-9]{16}$/.test(key))throw new Error('A verified account and valid Torn key are required.');
 storage.removeItem(browserKeySlot(ownerId));
 memoryKeys.set(ownerId,{version:1,ownerId,tornId,key,savedAt:new Date(now).toISOString()});
}
/** Call only after successful server verification. No key is written to browser storage. */
export async function commitVerifiedBrowserKey(options:{ownerId:string;tornId:number;key:string;persist:boolean},activeOwner:()=>Promise<string|null>,storage:()=>KeyStorage){
 if(await activeOwner()!==options.ownerId)throw new Error('Your account changed before the session copy could be updated.');
 const local=storage();if(options.persist)writeBrowserTornKey(local,options.ownerId,options.tornId,options.key);else removeBrowserTornKey(local,options.ownerId);
}
export function notifyBrowserKeyChange(ownerId:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(BROWSER_KEY_EVENT,{detail:{ownerId}}));}
