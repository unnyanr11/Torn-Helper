import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import LiveStockPrices from '../components/LiveStockPrices';
import type {StockForecast} from '../lib/stock-forecast';
const mocked=vi.hoisted(()=>({rows:[] as any[]}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:async()=>({data:{provider_at:new Date(Math.floor(Date.now()/60000)*60000).toISOString(),window_minutes:1440,stocks:[{stock_id:1,open:99},{stock_id:2,open:99}]},error:null}),from:()=>({select:()=>({eq:()=>({order:async()=>({data:mocked.rows,error:null})})})})}}));
const flatten=(node:any):string=>typeof node==='string'?node:Array.isArray(node)?node.map(flatten).join(''):node?flatten(node.children):'';
it('keeps compact cards to the name, action, price and comparison movement',async()=>{
 vi.stubGlobal('document',{documentElement:{dataset:{motion:'reduced'}}});
 const now=Math.floor(Date.now()/60000)*60,at=new Date(now*1000).toISOString();
 const base:StockForecast={points:[],last:{timestamp:now,price:100},cadence:60,targetTime:now+60,supported:false,lower:99,upper:101,predictedPrice:100,predictedReturn:0,tests:80,mae:.0021,baselineMae:.002,directionAccuracy:.44,validation:[]};
 mocked.rows=[1,2].map(stock_id=>({stock_id,price:100,source:'Torn API',observed_at:at}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),selected=vi.fn();let root:ReactTestRenderer|undefined;
 try{
  await act(async()=>{root=create(<QueryClientProvider client={client}><LiveStockPrices at={at} connected now={now} onSelect={selected} analyses={{1:{...base,model:'No change'} as StockForecast,2:base}}/></QueryClientProvider>);await new Promise(r=>setTimeout(r,30));});
  await act(async()=>{await new Promise(r=>setTimeout(r,20));});
  const text=flatten(root!.toJSON());
  expect(text).toContain('0 Buy · 0 Sell · 2 Wait');const cards=root!.root.findAllByProps({className:'live-stock-quote'});
  expect(text).not.toContain('44.0%');
  expect(text).toContain('Why all stocks show Wait');
  expect(text).toContain('1 stock: No advantage over an unchanged price');
  expect(text).toContain('1 stock: Past predictions not reliable enough');
  expect(root!.root.findByType('details').props.open).toBeUndefined();
  expect(cards.every(card=>card.findAllByType('li').length===0)).toBe(true);
  expect(JSON.stringify(root!.toJSON())).toContain('+1.01%');
  expect(cards[0].props.title).toContain('no-change baseline');
  expect(cards[1].props.title).toContain('Historical checks failed');
  expect(root!.root.findAllByProps({className:'stock-window-range'})).toHaveLength(0);
  act(()=>root!.root.findAllByType('button')[0].props.onClick());expect(selected).toHaveBeenCalledWith('1');
 }finally{act(()=>root?.unmount());client.clear();vi.unstubAllGlobals();}
});
