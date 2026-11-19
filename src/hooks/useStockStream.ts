import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';

export type StockCollectionStatus={quote_source?:string;last_attempt:string|null;last_success:string|null;provider_at:string|null;rows_written:number;message:string;backfilled_stocks:number};
export function useStockStream(){
 const client=useQueryClient(),[connected,setConnected]=useState(false);
 const status=useQuery({
  queryKey:['stock-minute-status'],staleTime:10000,refetchInterval:30000,retry:1,
  queryFn:async()=>{
   const result=await supabase.from('stock_collection_status').select('last_attempt,last_success,provider_at,rows_written,message,backfilled_stocks,quote_source').eq('id',1).single();
   if(result.error)throw result.error;
   return result.data as StockCollectionStatus;
  },
 });
 useEffect(()=>{
  let active=true;
  const channel=supabase.channel('stock-price-stream')
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'stock_collection_status',filter:'id=eq.1'},()=>{
    // Read the committed batch marker once, then refresh prices and history together.
    void client.invalidateQueries({queryKey:['stock-minute-status']});
   })
   .subscribe(state=>{
    if(!active)return;
    setConnected(state==='SUBSCRIBED');
    if(state==='SUBSCRIBED')void client.invalidateQueries({queryKey:['stock-minute-status']});
   });
  return()=>{active=false;void supabase.removeChannel(channel);};
 },[client]);
 return {status,connected};
}
