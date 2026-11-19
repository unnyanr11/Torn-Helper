import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import LiveStockPrices from '../components/LiveStockPrices';
import type {StockForecast} from '../lib/stock-forecast';
const mocked=vi.hoisted(()=>({rows:[] as any[]}));
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({order:async()=>({data:mocked.rows,error:null})})})})}}));
const flatten=(node:any):string=>typeof node==='string'?node:Array.isArray(node)?node.map(flatten).join(''):node?flatten(node.children):'';
it('shows distinct Wait causes, thresholds and counts on live stock cards',async()=>{
 vi.stubGlobal('document',{documentElement:{dataset:{motion:'reduced'}}});
 const now=Math.floor(Date.now()/60000)*60,at=new Date(now*1000).toISOString();
 const base:StockForecast={points:[],last:{timestamp:now,price:100},cadence:60,targetTime:now+60,supported:false,lower:99,upper:101,predictedPrice:100,predictedReturn:0,tests:80,mae:.0021,baselineMae:.002,directionAccuracy:.44,validation:[]};
 mocked.rows=[1,2].map(stock_id=>({stock_id,price:100,source:'Torn API',observed_at:at}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),selected=vi.fn();let root:ReactTestRenderer|undefined;
 try{
  await act(async()=>{root=create(<QueryClientProvider client={client}><LiveStockPrices at={at} connected now={now} onSelect={selected} analyses={{1:{...base,model:'No change'} as StockForecast,2:base}}/></QueryClientProvider>);await new Promise(r=>setTimeout(r,30));});
  await act(async()=>{await new Promise(r=>setTimeout(r,20));});
  const text=flatten(root!.toJSON());
  expect(text).toContain('0 Buy · 0 Sell · 2 Wait');expect(text).toContain('No predictive edge');expect(text).toContain('Historical checks failed');expect(text).toContain('44.0% / 55% required');
  act(()=>root!.root.findAllByType('button')[0].props.onClick());expect(selected).toHaveBeenCalledWith('1');
 }finally{act(()=>root?.unmount());client.clear();vi.unstubAllGlobals();}
});
