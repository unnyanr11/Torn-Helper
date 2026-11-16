import {expect,it} from 'vitest';
import {foreignStocks} from '../../supabase/functions/_shared/foreign-stock';
import {travelCapacity} from '../lib/travel-capacity';
it('keeps sold-out reports and drops undated or future stock',()=>{
 const now=Date.now(),update=Math.floor(now/1000);
 const result=foreignStocks({stocks:{jap:{update,stocks:[{id:206,quantity:0,cost:650000}]},can:{update:update+9999,stocks:[{id:206,quantity:1,cost:1}]}}},now);
 expect(result).toHaveLength(1);expect(result[0]).toMatchObject({country:'Japan',quantity:0,cost:650000});
 expect(()=>foreignStocks({stocks:{jap:{stocks:[{id:206,quantity:1,cost:1}]}}})).toThrow();
});
it('uses the current base and applies category bonuses after the event multiplier',()=>{
 const perks={perks:{faction:['+ 10 travel items'],enhancer:['+ 3 travel items'],job:['+ 5 flowers']}};
 expect(travelCapacity(perks,'Standard','Drug')?.capacity).toBe(23);
 expect(travelCapacity(perks,'Airstrip','Flower',true)?.capacity).toBe(61);
 expect(travelCapacity(undefined,'Airstrip','Flower')).toBeNull();
});
