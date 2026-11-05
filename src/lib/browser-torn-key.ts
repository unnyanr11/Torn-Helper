export type BrowserTornKey={version:1;ownerId:string;tornId:number;key:string;savedAt:string};
export const BROWSER_KEY_EVENT='torn:browser-key-change';
export const browserKeySlot=(ownerId:string)=>`tcc:torn-key:v1:${ownerId}`;
type KeyStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
/** Local-only: never obtains, synchronizes or downloads credentials from a server. */
export function readBrowserTornKey(storage:KeyStorage,ownerId:string):BrowserTornKey|null{
 const raw=storage.getItem(browserKeySlot(ownerId));if(!raw)return null;
 try{
  const value=JSON.parse(raw);
  if(value?.version!==1||value.ownerId!==ownerId||!Number.isSafeInteger(value.tornId)||value.tornId<=0||typeof value.key!=='string'||!/^[A-Za-z0-9]{16}$/.test(value.key)||typeof value.savedAt!=='string'||!Number.isFinite(Date.parse(value.savedAt)))return null;
  return {version:1,ownerId,tornId:value.tornId,key:value.key,savedAt:value.savedAt};
 }catch{return null;}
}
export function removeBrowserTornKey(storage:KeyStorage,ownerId:string){storage.removeItem(browserKeySlot(ownerId));if(storage.getItem(browserKeySlot(ownerId))!==null)throw new Error('Browser storage did not remove the local copy.');}
export function writeBrowserTornKey(storage:KeyStorage,ownerId:string,tornId:number,key:string,now=Date.now()){
 if(!ownerId||!Number.isSafeInteger(tornId)||tornId<=0||!/^[A-Za-z0-9]{16}$/.test(key))throw new Error('A verified account and valid Torn key are required.');
 const record:BrowserTornKey={version:1,ownerId,tornId,key,savedAt:new Date(now).toISOString()};
 const raw=JSON.stringify(record);storage.setItem(browserKeySlot(ownerId),raw);
 if(storage.getItem(browserKeySlot(ownerId))!==raw)throw new Error('Browser storage did not save the local copy.');
}
/** Call only after successful server verification. Account changes must never save another user's key. */
export async function commitVerifiedBrowserKey(options:{ownerId:string;tornId:number;key:string;persist:boolean},activeOwner:()=>Promise<string|null>,storage:()=>KeyStorage){
 if(await activeOwner()!==options.ownerId)throw new Error('Your account changed before the browser copy could be updated.');
 const local=storage();if(options.persist)writeBrowserTornKey(local,options.ownerId,options.tornId,options.key);else removeBrowserTornKey(local,options.ownerId);
}
export function notifyBrowserKeyChange(ownerId:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(BROWSER_KEY_EVENT,{detail:{ownerId}}));}
