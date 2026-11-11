import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {clearBrowserTornKeys,purgeLegacyBrowserKeys,browserKeySlot,readBrowserTornKey,writeBrowserTornKey,removeBrowserTornKey,commitVerifiedBrowserKey} from '../lib/browser-torn-key';
import BrowserTornKeyCard from '../components/BrowserTornKeyCard';
import KeyDisclosure from '../components/KeyDisclosure';
const data=vi.hoisted(()=>({items:new Map<string,string>()}));
const storage={getItem:(k:string)=>data.items.get(k)??null,setItem:(k:string,v:string)=>{data.items.set(k,v);},removeItem:(k:string)=>{data.items.delete(k);}};
vi.mock('../hooks/useBrowserTornKey',async()=>{const module=await import('../lib/browser-torn-key');return {useBrowserTornKey:(owner:string)=>({ownerId:owner,copy:module.readBrowserTornKey({getItem:(k:string)=>data.items.get(k)??null,setItem:()=>{},removeItem:()=>{}},owner),error:false})};});
const key='AbCdEf0123456789';
beforeEach(()=>{data.items.clear();clearBrowserTornKeys();});
describe('browser key copies stay separate from encrypted server credentials',()=>{
 it('persists only the verified user-entered key in that account’s browser slot',async()=>{
  await commitVerifiedBrowserKey({ownerId:'owner-a',tornId:4317919,key,persist:true},async()=>'owner-a',()=>storage);
  expect(readBrowserTornKey(storage,'owner-a')?.key).toBe(key);expect(readBrowserTornKey(storage,'owner-b')).toBeNull();
 });
 it('rejects an account switch before touching browser storage',async()=>{
  const getStorage=vi.fn(()=>storage);
  await expect(commitVerifiedBrowserKey({ownerId:'owner-a',tornId:4317919,key,persist:true},async()=>'owner-b',getStorage)).rejects.toThrow('account changed');
  expect(getStorage).not.toHaveBeenCalled();expect(data.items.size).toBe(0);
 });
 it('can remove one account’s copy while preserving another account',()=>{
  writeBrowserTornKey(storage,'owner-a',1,key);writeBrowserTornKey(storage,'owner-b',2,'1234567890AbCdEf');removeBrowserTornKey(storage,'owner-a');
  expect(readBrowserTornKey(storage,'owner-a')).toBeNull();expect(readBrowserTornKey(storage,'owner-b')?.tornId).toBe(2);
 });
 it('removes the old local copy when browser retention is not requested',async()=>{
  writeBrowserTornKey(storage,'owner-a',1,key);
  await commitVerifiedBrowserKey({ownerId:'owner-a',tornId:1,key,persist:false},async()=>'owner-a',()=>storage);expect(readBrowserTornKey(storage,'owner-a')).toBeNull();
 });
 it('keeps keys only in memory even when persistent writes are blocked',async()=>{
  const blocked={...storage,setItem:()=>{throw new Error('Never persist');}};
  await commitVerifiedBrowserKey({ownerId:'owner-a',tornId:1,key,persist:true},async()=>'owner-a',()=>blocked);
  expect(data.items.size).toBe(0);expect(readBrowserTornKey(storage,'owner-a')?.key).toBe(key);
  clearBrowserTornKeys();expect(readBrowserTornKey(storage,'owner-a')).toBeNull();
 });
 it('purges all legacy plaintext key slots without deleting unrelated settings',()=>{
  storage.setItem(browserKeySlot('owner-a'),key);storage.setItem(browserKeySlot('owner-b'),key);storage.setItem('tcc-theme','dark');
  const legacy={...storage,get length(){return data.items.size;},key:(i:number)=>[...data.items.keys()][i]??null,clear:()=>data.items.clear()};
  purgeLegacyBrowserKeys(legacy);expect([...data.items.keys()]).toEqual(['tcc-theme']);
 });
 it('does not display malformed or mismatched account records',()=>{
  for(const value of ['not json',JSON.stringify({version:1,ownerId:'owner-b',tornId:1,key,savedAt:new Date().toISOString()}),JSON.stringify({version:1,ownerId:'owner-a',tornId:1,key:'invalid',savedAt:'invalid'})]){
   storage.setItem(browserKeySlot('owner-a'),value);expect(readBrowserTornKey(storage,'owner-a')).toBeNull();
  }
 });
 it('masks the browser copy by default and never substitutes a different account’s key',()=>{
  writeBrowserTornKey(storage,'owner-a',4317919,key);
  const html=renderToStaticMarkup(<BrowserTornKeyCard ownerId="owner-a"/>);expect(html).toContain('type="password"');expect(html).toContain('Show session copy');expect(html).toContain('backend key is never fetched');
  const other=renderToStaticMarkup(<BrowserTornKeyCard ownerId="owner-b"/>);expect(other).not.toContain(key);expect(other).toContain('No usable key copy');
 });
 it('does not request any credential from the backend while saving or reading a local copy',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  try{await commitVerifiedBrowserKey({ownerId:'owner-a',tornId:1,key,persist:true},async()=>'owner-a',()=>storage);readBrowserTornKey(storage,'owner-a');renderToStaticMarkup(<BrowserTornKeyCard ownerId="owner-a"/>);expect(fetch).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
 });
 it('discloses mandatory backend retention independently of the optional browser copy',()=>{
  const html=renderToStaticMarkup(<KeyDisclosure persist browserCopy={false} requiredBackend/>);
  expect(html).toContain('required while the app account is active');expect(html).toContain('will not retain a browser copy');expect(html).toContain('Account deletion removes the backend key');
 });
 it('discloses both locations and keeps request-only forms separate from saved copies',()=>{
  const both=renderToStaticMarkup(<KeyDisclosure persist browserCopy/>);expect(both).toContain('held in page memory');expect(both).toContain('backend copy is encrypted');expect(both).toContain('never downloaded');
  const temporary=renderToStaticMarkup(<KeyDisclosure persist={false}/>);expect(temporary).toContain('Session copies entered separately in Settings are unchanged');
 });
});
