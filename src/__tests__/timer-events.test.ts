import {describe,it,expect,vi} from 'vitest';
import {affectedTimerEndpoints,nextTimerLogParameters,runTimerJob,type TimerBaseline,type TimerJob} from '../../supabase/functions/_shared/timer-events';
const now=1800000060000,base=1800000000;
const baseline=(id:string,at=base):TimerBaseline=>({endpoint_id:id,payload:{},deadlines:{},observed_at:new Date(at*1000).toISOString()});
const event=(title:string,at=base+10,data={})=>({id:title+at,timestamp:at,details:{title},data});
const page=(log:any[],prev:string|null=null)=>({log,_metadata:{links:{prev,next:null}}});
const job:TimerJob={user_id:'owner',token:'lease',cursor_to:base,scan_to:null,next_parameters:null,pending_endpoints:[]};
describe('activity-triggered timer refresh',()=>{
 it('targets changed sections without guessing new cooldown durations',()=>{
  expect(affectedTimerEndpoints(event('Drug use'))).toContain('v2-user-cooldowns');
  expect(affectedTimerEndpoints(event('Travel initiate'))).toEqual(['v2-user-travel','v2-user-profile']);
  expect(affectedTimerEndpoints(event('Gym train'))).toEqual(['v2-user-bars']);
  expect(affectedTimerEndpoints(event('Education complete'))).toContain('v2-user-education');
  expect(affectedTimerEndpoints(event('Money receive'))).toEqual([]);
 });
 it('makes one log request and zero timer requests when nothing changed',async()=>{
  const loadLogs=vi.fn(async()=>page([])),refresh=vi.fn();
  const result=await runTimerJob(job,{baselines:[baseline('v2-user-cooldowns')],loadLogs,refresh,now});
  expect(loadLogs).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled();expect(result.cursor_to).toBe(base+55);expect(result.error).toBeNull();
 });
 it('refreshes a cooldown once for several new events, without refreshing travel',async()=>{
  const refresh=vi.fn(async()=>{});await runTimerJob(job,{baselines:[baseline('v2-user-cooldowns'),baseline('v2-user-travel')],loadLogs:async()=>page([event('Drug use'),event('Medical item use')]),refresh,now});
  expect(refresh.mock.calls).toEqual([['v2-user-cooldowns']]);
 });
 it('ignores events already covered by a newer baseline',async()=>{
  const refresh=vi.fn(async()=>{});await runTimerJob(job,{baselines:[baseline('v2-user-cooldowns',base+30)],loadLogs:async()=>page([event('Drug use')]),refresh,now});expect(refresh).not.toHaveBeenCalled();
 });
 it('retries failed affected sections on the next job even without another event',async()=>{
  const result=await runTimerJob(job,{baselines:[baseline('v2-user-cooldowns')],loadLogs:async()=>page([event('Drug use')]),refresh:async()=>{throw new Error('Outage');},now});
  expect(result.pending_endpoints).toEqual(['v2-user-cooldowns']);expect(result.cursor_to).toBe(base+55);
  const refresh=vi.fn(async()=>{});const recovered=await runTimerJob({...job,...result},{baselines:[baseline('v2-user-cooldowns')],loadLogs:async()=>page([]),refresh,now:now+60000});expect(refresh).toHaveBeenCalledWith('v2-user-cooldowns');expect(recovered.pending_endpoints).toEqual([]);
 });
 it('holds coverage and preserves continuation when more than two pages exist',async()=>{
  const loadLogs=vi.fn().mockResolvedValueOnce(page([event('Money receive')],`https://api.torn.com/v2/user/log?to=${base+40}`)).mockResolvedValueOnce(page([],`https://api.torn.com/v2/user/log?to=${base+20}`));
  const result=await runTimerJob(job,{baselines:[],loadLogs,refresh:async()=>{},now});expect(result.cursor_to).toBe(base);expect(result.scan_to).toBe(base+55);expect(result.next_parameters?.to).toBe(String(base+20));expect(loadLogs).toHaveBeenCalledTimes(2);
 });
 it('backs off denied logs and does not repeatedly fetch every timer as a fallback',async()=>{
  const refresh=vi.fn();const result=await runTimerJob(job,{baselines:[baseline('v2-user-cooldowns')],loadLogs:async()=>{throw {code:7};},refresh,now});expect(result.retry_seconds).toBe(3600);expect(refresh).not.toHaveBeenCalled();expect(result.cursor_to).toBe(base);
 });
 it('does not automatically refresh optional timers, including old pending work',async()=>{
  const refresh=vi.fn(async()=>{});
  const result=await runTimerJob({...job,pending_endpoints:['v2-faction-chain','v2-user-races','v2-user-education']},{baselines:[baseline('v2-faction-chain'),baseline('v2-user-races'),baseline('v2-user-education')],loadLogs:async()=>page([event('Chain increase'),event('Racing start'),event('Education complete')]),refresh,now});
  expect(refresh).not.toHaveBeenCalled();expect(result.pending_endpoints).toEqual([]);
 });
 it('validates log cursors, windows, and same-second continuation without exporting keys',()=>{
  const params={from:String(base),to:String(base+55),limit:'100'};
  expect(nextTimerLogParameters(page([]),params)).toBeNull();
  expect(()=>nextTimerLogParameters(page([],`https://evil.test/v2/user/log?to=${base+10}`),params)).toThrow();
  const next=nextTimerLogParameters({log:Array(100).fill(event('Activity')),_metadata:{links:{prev:null,next:null},nanostamp:'1234567890'}},params);expect(next?.nanostamp).toBe('1234567890');expect(next?.to).toBeUndefined();
  expect(()=>nextTimerLogParameters({log:Array(100).fill({}),_metadata:{links:{prev:null,next:null}}},params)).toThrow();
 });
});
