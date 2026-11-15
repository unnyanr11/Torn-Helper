import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FOREIGN_SHOP_PRICES, type SavedShopPrice } from '../lib/travel-profit';
export const foreignPricesKey = ['foreign-shop-references'];
export function useForeignShopPrices() {
 const query = useQuery({queryKey:foreignPricesKey,staleTime:30000,refetchInterval:60000,retry:1,queryFn:async()=>{
  const {data,error}=await supabase.from('foreign_shop_references').select('country,shop,item_id,item_name,item_type,buy_price,observed_on,source').limit(1000);
  if(error)throw error;
  return (data??[]).map(r=>({id:r.item_id,name:r.item_name,type:r.item_type,country:r.country,shop:r.shop,buy_price:Number(r.buy_price),observed_on:r.observed_on,source:r.source})) as SavedShopPrice[];
 }});
 const merged=new Map(FOREIGN_SHOP_PRICES.map(r=>[`${r.country}:${r.shop}:${r.id}`,r]));
 for(const r of query.data??[])merged.set(`${r.country}:${r.shop}:${r.id}`,r);
 return {...query,prices:[...merged.values()]};
}
