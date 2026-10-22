import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAPABILITIES } from '../api/capabilities';
import { buildEnergyLedger,projectEnergy } from '../lib/energy-estimate';
import { syncEnergyLogs } from '../lib/energy-log-sync';
import type { TornObservation } from '../lib/personal-data';
import type { DataEntry } from '../lib/connected-data';
import HomeDashboard from '../components/HomeDashboard';
const base=1800000000,ms=base*1000;
const observation=(path:string,payload:unknown,at=base):TornObservation=>({endpoint_id:CAPABILITIES.find(c=>c.path===path)!.id,payload,fetched_at:new Date(at*1000).toISOString(),parameters:{},next_parameters:null});
const bar=(current=40)=>observation('/user/bars',{bars:{energy:{current,maximum:100,increment:5,interval:600,tick_time:120}}});
const event=(id:string,timestamp:number,data:object,title='Activity')=>({id,timestamp,data,details:{title}});
const entries=(current=40,logs:unknown[]=[])=>({bars:{observation:bar(current)},logs:{observation:observation('/user/log',{log:logs})}} satisfies Record<string,DataEntry>);
const value=(rows:Record<string,DataEntry>,seconds:number)=>projectEnergy(buildEnergyLedger(rows,(base+seconds)*1000),(base+seconds)*1000);
describe('energy clock and structured activity reconciliation',()=>{
 it('uses observed tick phase locally and caps natural regeneration',()=>{
  expect(value(entries(),119).value).toBe(40);expect(value(entries(),120).value).toBe(45);expect(value(entries(),720).value).toBe(50);expect(value(entries(),20000).value).toBe(100);
 });
 it('preserves stacked energy and resumes regeneration only below the maximum',()=>{
  expect(value(entries(150),720).value).toBe(150);
  expect(value(entries(150,[event('a',base+200,{energy_used:75})]),720).value).toBe(80);
 });
 it('applies gains and costs chronologically with regeneration between them',()=>{
  const rows=entries(40,[event('b',base+700,{energy_used:25}),event('a',base+200,{energy_increased:100})]);
  expect(value(rows,720).value).toBe(120);expect(value(rows,720).events).toBe(2);
 });
 it('deduplicates overlapping pages and ignores logs already covered by the snapshot',()=>{
  const logs=[event('old',base,{energy_used:30}),event('a',base+50,{energy_used:10})],rows=entries(40,logs);
  rows['page' as keyof typeof rows]={observation:observation('/user/log',{log:logs})};
  expect(value(rows,100).value).toBe(30);expect(value(rows,100).events).toBe(1);
 });
 it.each([
  [event('a',base+50,{},'Gym training')],
  [event('a',base+50,{energy:20})],
  [event('a',base+50,{energy_used:-10})],
  [event('a',base+50,{energy_used:50})],
  [event('a',base+50,{energy_used:10}),event('a',base+50,{energy_used:20})],
  [event('a',base+50,{energy_used:10}),event('b',base+50,{energy_used:10})],
 ])('pauses ambiguous, conflicting or impossible energy events: %j',(...logs)=>{
  expect(value(entries(40,logs),100).value).toBeNull();expect(value(entries(40,logs),100).reason).toBeTruthy();
 });
 it('rejects missing timers, future observations, stale baselines and backwards clocks',()=>{
  const rows=entries();rows.bars.observation=observation('/user/bars',{bars:{energy:{current:10,maximum:100}}});expect(value(rows,100).value).toBeNull();
  expect(value(entries(),-1).value).toBeNull();expect(value(entries(),86401).value).toBeNull();
  expect(projectEnergy(buildEnergyLedger(entries(40,[event('a',base+50,{energy_used:5})]),(base+100)*1000),ms).value).toBeNull();
 });
 it('uses the newest confirmed bar across cache parameters',()=>{
  const rows:Record<string,DataEntry>=entries(40,[event('a',base+50,{energy_used:5})]);
  rows.new={observation:{...bar(80),fetched_at:new Date((base+100)*1000).toISOString(),parameters:{timestamp:String(base+100)}}};
  expect(value(rows,110).value).toBe(80);expect(value(rows,110).events).toBe(0);
 });
 it('labels estimates and falls back to the confirmed value for incomplete log windows',()=>{
  const now=Date.now(),rows=entries();rows.bars.observation.fetched_at=new Date(now).toISOString();
  const html=renderToStaticMarkup(<HomeDashboard entries={rows} energyCoverage={{baseline:rows.bars.observation.fetched_at,from:0,to:0,pages:1,complete:false}}/>);
  expect(html).toContain('40 / 100');expect(html).toContain('log window is incomplete');expect(html).not.toContain('Estimated now');
 });
});
describe('bounded energy log checks',()=>{
 const baseline=new Date(ms).toISOString(),signal=new AbortController().signal;
 const page=(next:Record<string,string>|null=null)=>({...observation('/user/log',{log:[]}),next_parameters:next});
 it('checks incrementally with overlap and keeps the range fixed across pages',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(page({to:String(base+50),nanostamp:'2'})).mockResolvedValueOnce(page()),pause=vi.fn(async()=>{}),onPage=vi.fn();
  const result=await syncEnergyLogs({baseline,since:base+20,now:(base+100)*1000,signal,fetch,pause,onPage});
  expect(fetch.mock.calls[0][0]).toEqual({from:String(base+19),to:String(base+100),limit:'100'});
  expect(fetch.mock.calls[1][0]).toEqual({from:String(base+19),to:String(base+50),nanostamp:'2',limit:'100'});
  expect(result.complete).toBe(true);expect(onPage).toHaveBeenCalledTimes(2);expect(pause).toHaveBeenCalledTimes(1);
 });
 it('stops after two pages without claiming coverage',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(page({to:String(base+90)})).mockResolvedValueOnce(page({to:String(base+80)}));
  const result=await syncEnergyLogs({baseline,now:(base+100)*1000,signal,fetch,pause:async()=>{},onPage:()=>{}});
  expect(result.complete).toBe(false);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('rejects stale baselines and aborts without applying late responses',async()=>{
  const fetch=vi.fn(async()=>page()),onPage=vi.fn();
  await expect(syncEnergyLogs({baseline,now:(base+90000)*1000,signal,fetch,pause:async()=>{},onPage})).rejects.toThrow('too old');expect(fetch).not.toHaveBeenCalled();
  const controller=new AbortController();fetch.mockImplementation(async()=>{controller.abort();return page();});
  await expect(syncEnergyLogs({baseline,now:(base+100)*1000,signal:controller.signal,fetch,pause:async()=>{},onPage})).rejects.toThrow('Cancelled');expect(onPage).not.toHaveBeenCalled();
 });
});
