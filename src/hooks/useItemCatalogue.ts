import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { parseItemCatalogue,type CatalogueItem } from '../lib/item-catalogue';
export type SavedItemCatalogue={items:CatalogueItem[];item_count:number;fetched_at:string|null};
export function readSavedCatalogue(value:unknown):SavedItemCatalogue{
 const data=value as SavedItemCatalogue|null;
 if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.item_count)||data.item_count<0)throw new Error('Unable to read the saved item catalogue.');
 const items=data.items.length?parseItemCatalogue(data):[];
 if(items.length!==data.item_count)throw new Error('The saved item catalogue is incomplete.');
 return {items,item_count:items.length,fetched_at:typeof data.fetched_at==='string'?data.fetched_at:null};
}
export function useItemCatalogue(){
 return useQuery({queryKey:['item-catalogue'],staleTime:Infinity,gcTime:Infinity,retry:false,queryFn:async()=>{
  const r=await supabase.rpc('get_torn_item_catalogue');if(r.error)throw r.error;return readSavedCatalogue(r.data);
 }});
}
