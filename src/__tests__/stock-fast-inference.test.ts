import {expect,it,vi} from 'vitest';
import {forecastMinuteStock} from '../lib/minute-forecast';
import {inferStockMinute} from '../../supabase/functions/_shared/stock-inference';
const points=Array.from({length:1000},(_,i)=>({timestamp:1794000000+i*60,price:100*Math.exp(.00003*i+Math.sin(i/8)*.0004)}));
it('replays fitted predictions for all horizons without refitting the model',()=>{
 const now=points.at(-1)!.timestamp+10;
 for(const horizon of [1,5,15,60] as const){
  const fitted=forecastMinuteStock(points,now,horizon);
  const result=inferStockMinute(fitted,points.slice(-180),now,horizon);
  expect(result.predictedPrice).toBeCloseTo(fitted.predictedPrice,9);
  expect(result.lower).toBeCloseTo(fitted.lower,9);
  expect(result.fitted).toBe(fitted.fitted);
  expect(result.tests).toBe(fitted.tests);
  expect(result.last).toEqual(points.at(-1));
 }
});
it('uses fresh prices, preserves the fit date, and rejects expired models',()=>{
 const now=points.at(-1)!.timestamp+10,fitted=forecastMinuteStock(points,now,5);
 const next={timestamp:points.at(-1)!.timestamp+60,price:points.at(-1)!.price*.999};
 const result=inferStockMinute(fitted,[...points.slice(-180),next],now+60,5);
 expect(result.last).toEqual(next);expect(result.targetTime).toBe(next.timestamp+300);expect(result.fitted?.trainedAt).toBe(now);
 expect(inferStockMinute(fitted,[...points.slice(-180),next],now+1801,5).issue).toContain('refreshed');
});
it('retains weekly training in the existing scheduled trainer endpoint',async()=>{
 const {readFileSync}=await import('node:fs');
 const ts=await import('typescript');
 const {analyzeStockHistory,STOCK_ANALYSIS_VERSION}=await import('../../supabase/functions/_shared/stock-analysis');
 const source=readFileSync('supabase/functions/analyze-stock-prices/index.ts','utf8').replace(/^import .*\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 let handler:((req:Request)=>Promise<Response>)|undefined;
 const calls:{name:string;args:any}[]=[];
 const admin={rpc:async(name:string,args:any)=>{
  calls.push({name,args});
  if(name==='claim_stock_analysis')return {data:{lease:'test-lease',provider_at:new Date(points.at(-1)!.timestamp*1000).toISOString()},error:null};
  if(name==='read_stock_chart_history')return {data:{points:points.map(p=>[p.timestamp,p.price])},error:null};
  if(name==='finish_stock_analysis')return {data:true,error:null};
  throw new Error(`Unexpected RPC: ${name}`);
 }};
 new Function('Deno','adminClient','json','preflight','scheduled','readJsonObject','analyzeStockHistory','STOCK_ANALYSIS_VERSION',js)(
  {serve:(fn:typeof handler)=>{handler=fn;}},()=>admin,(body:unknown,status=200)=>new Response(JSON.stringify(body),{status}),()=>null,async()=>true,async()=>({stock_id:1}),analyzeStockHistory,STOCK_ANALYSIS_VERSION);
 const clock=vi.spyOn(Date,'now').mockReturnValue((points.at(-1)!.timestamp+10)*1000);
 let response:Response;try{response=await handler!(new Request('https://example.test',{method:'POST'}));}finally{clock.mockRestore();}
 expect(response.status).toBe(200);
 const saved=calls.find(c=>c.name==='finish_stock_analysis')!.args.p_results;
 expect(saved.map((r:any)=>r.horizon)).toEqual([1,5,15,60]);
 expect(saved.every((r:any)=>r.forecast.fitted&&r.forecast.observations===1000)).toBe(true);
 expect(calls.map(c=>c.name)).toEqual(['claim_stock_analysis','read_stock_chart_history','finish_stock_analysis']);
});
