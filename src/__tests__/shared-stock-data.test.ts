import {afterEach,expect,it,vi} from 'vitest';
import {sharedStockData,isPublicStockEndpoint} from '../../supabase/functions/_shared/shared-stock-data';

function setup(cache:any=null,claimed:string|null='shared-lease'){
 const rpc=vi.fn(async(name:string)=>{
  if(name==='get_shared_stock_provider')return {data:{api_key:'backend-only-test-key',budget_owner:'shared-provider-owner'},error:null};
  if(name==='claim_stock_public_refresh')return {data:claimed,error:null};
  if(name==='consume_torn_data_budget')return {data:true,error:null};
  return {data:'slot-lease',error:null};
 });
 const update=vi.fn(()=>({eq:()=>({eq:async()=>({error:null})})}));
 const from=vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:cache,error:null})})}),update}));
 return {admin:{rpc,from} as any,rpc,update};
}
afterEach(()=>vi.useRealTimers());
it('uses the backend provider quota and strips caller cache-bypass parameters',async()=>{
 const {admin,rpc}=setup();
 const fetcher=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({stocks:[{id:1,market:{price:100}}]}));
 const result=await sharedStockData(admin,'/torn/stocks?timestamp=999&comment=caller',fetcher as typeof fetch);
 expect(fetcher).toHaveBeenCalledTimes(1);
 const requested=new URL(String(fetcher.mock.calls[0][0]));
 expect(requested.origin+requested.pathname).toBe('https://api.torn.com/v2/torn/stocks');
 expect(requested.searchParams.get('timestamp')).not.toBe('999');
 expect(requested.searchParams.get('comment')).toBe('TornHelperSharedStocks');
 expect((fetcher.mock.calls[0] as any)[1].headers.Authorization).toBe('ApiKey backend-only-test-key');
 expect(rpc).toHaveBeenCalledWith('consume_torn_data_budget',{owner_id:'shared-provider-owner',cost:1});
 expect(JSON.stringify(result)).not.toContain('backend-only-test-key');
});
it('shares a fresh observation across callers without another upstream call',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-19T15:00:20Z'));
 const {admin,rpc}=setup({payload:{stocks:[]},fetched_at:'2026-11-19T15:00:10Z'});
 const fetcher=vi.fn();
 const result=await sharedStockData(admin,'/torn/stocks',fetcher);
 expect(result.cached).toBe(true);expect(rpc).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
});
it('retains older shared data during an in-flight refresh and restricts the key to public stocks',async()=>{
 const {admin}=setup({payload:{stocks:[]},fetched_at:'2020-01-01T00:00:00Z'},null);
 const result=await sharedStockData(admin,'/torn/2/stocks');
 expect(result.stale).toBe(true);
 expect(isPublicStockEndpoint('/user/stocks')).toBe(false);
 await expect(sharedStockData(admin,'/user/stocks')).rejects.toThrow('supported public stocks');
});

it('normalizes a generic stocks-only selection to the same public cache',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-19T15:00:20Z'));
 const {admin}=setup({payload:{stocks:[]},fetched_at:'2026-11-19T15:00:10Z'});
 const result=await sharedStockData(admin,'/torn?selections=stocks&timestamp=123&comment=caller');
 expect(result.cached).toBe(true);
 await expect(sharedStockData(admin,'/torn?selections=stats')).rejects.toThrow('supported public stocks');
});
