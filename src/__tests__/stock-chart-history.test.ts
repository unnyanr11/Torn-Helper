import {expect,it,vi} from 'vitest';
vi.mock('../lib/supabase',()=>({supabase:{}}));
import {mergeChartHistory} from '../hooks/useStockChartHistory';
it('merges current minutes into chart history without analysis timestamps or duplicate points',()=>{
 const old={provider_at:'old',points:[{timestamp:1794000000,price:100},{timestamp:1794000060,price:101}]};
 const next=mergeChartHistory(old,{provider_at:'new',points:[[1794000060,102],[1794000120,103]]});
 expect(next.points).toEqual([{timestamp:1794000000,price:100},{timestamp:1794000060,price:102},{timestamp:1794000120,price:103}]);
 expect(next.provider_at).toBe('new');
});
