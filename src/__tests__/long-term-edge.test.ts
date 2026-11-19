import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {forecastLongTermStock} from '../lib/long-term-stock';
function endpoint(authorized:boolean,rpc:ReturnType<typeof vi.fn>){
 const source=readFileSync('supabase/functions/analyze-long-term-stocks/index.ts','utf8').replace(/^import .*\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 let handler:(req:Request)=>Promise<Response>;
 new Function('Deno','adminClient','json','preflight','scheduled','forecastLongTermStock',js)({serve:(fn:typeof handler)=>{handler=fn;}},()=>({rpc}),(body:unknown,status=200)=>new Response(JSON.stringify(body),{status}),()=>null,async()=>authorized,forecastLongTermStock);
 return (req:Request)=>handler(req);
}
const request=()=>new Request('https://example.test',{method:'POST'});
it('does no work without scheduled-job authorization',async()=>{
 const rpc=vi.fn();expect((await endpoint(false,rpc)(request())).status).toBe(403);expect(rpc).not.toHaveBeenCalled();
});
it('analyses and saves all 35 stocks in one batch under ten seconds',async()=>{
 const at=Math.floor(Date.now()/3600000)*3600-60;
 const points=Array.from({length:720},(_,i)=>[at-(719-i)*3600,100+i*.02]);
 const input={provider_at:new Date(at*1000).toISOString(),stocks:Object.fromEntries(Array.from({length:35},(_,i)=>[i+1,points]))};
 const rpc=vi.fn(async(name:string)=>name==='read_stock_long_term_input'?{data:input,error:null}:{data:true,error:null});
 const clock=vi.spyOn(Date,'now').mockReturnValue((at+20)*1000),start=performance.now();
 try{
  const response=await endpoint(true,rpc)(request());expect(response.status).toBe(200);expect(performance.now()-start).toBeLessThan(10000);
  expect(rpc).toHaveBeenCalledTimes(2);const saved=rpc.mock.calls[1] as unknown as [string,{p_results:any[]}];
  expect(saved[0]).toBe('publish_stock_long_term');expect(saved[1].p_results).toHaveLength(35);expect(saved[1].p_results.every(r=>r.forecast.tests>=24&&r.forecast.targetTime===at+86400)).toBe(true);
 }finally{clock.mockRestore();}
});
it('retains the previous cache when current history is incomplete',async()=>{
 const rpc=vi.fn(async()=>({data:{provider_at:new Date().toISOString(),stocks:{}},error:null}));
 expect((await endpoint(true,rpc)(request())).status).toBe(503);expect(rpc).toHaveBeenCalledTimes(1);
});
