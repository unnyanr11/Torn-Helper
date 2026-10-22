import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { parseItemCatalogue } from '../lib/item-catalogue';
import ItemCatalogueLoader from '../components/ItemCatalogueLoader';
vi.mock('../lib/supabase',()=>({supabase:{}}));
describe('full official item catalogue',()=>{
 it('parses every returned item without a dropdown-size cap or requiring price details',()=>{
  const items=Array.from({length:1600},(_,i)=>({id:i+1,name:`Item ${i+1}`,type:i%2?'Medical':'Other'}));
  const parsed=parseItemCatalogue({items});
  expect(parsed).toHaveLength(1600);expect(new Set(parsed.map(i=>i.id)).size).toBe(1600);expect(parsed.find(i=>i.id===1600)?.name).toBe('Item 1600');expect(parsed[0]).not.toHaveProperty('price');
 });
 it('supports the official legacy dictionary shape without mistaking the key for an array offset',()=>{
  expect(parseItemCatalogue({items:{'206':{name:'Named item',type:'Drug'}}})).toEqual([{id:206,name:'Named item',type:'Drug'}]);
 });
 it('preserves separate IDs for items sharing a name',()=>{
  const result=parseItemCatalogue({items:[{id:1,name:'Same'},{id:2,name:'Same'}]});
  expect(result.map(i=>i.id)).toEqual([1,2]);expect(result[0].type).toBe('Uncategorized');
 });
 it('rejects malformed, empty or conflicting responses instead of accepting a partial catalogue',()=>{
  for(const payload of [{},{items:[]},{items:[{id:0,name:'Bad'}]},{items:[{id:1,name:''}]},{items:[{id:1,name:'First'},{id:1,name:'Conflicting'}]}])expect(()=>parseItemCatalogue(payload)).toThrow();
 });
 it('deduplicates identical records without changing their IDs',()=>{
  const item={id:123,name:'Named item',type:'Tool'};expect(parseItemCatalogue({items:[item,item]})).toEqual([item]);
 });
 it('offers an explicit full import using a request-only or encrypted saved key',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ItemCatalogueLoader/></QueryClientProvider>);
  expect(html).toContain('Load all Torn items');expect(html).toContain('Fetch all item names and IDs');expect(html).toContain('type="password"');expect(html).toContain('Public Only');expect(html).toContain('Used for this request only');expect(html).not.toContain('href="http');
 });
});
