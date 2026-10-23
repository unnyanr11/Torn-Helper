import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { STARTER_TARGETS } from '../data/levelling-targets';
import { filterStarterTargets,targetAvailability,targetObservation,nextTargetChecks,mergeTargetObservations,targetActivityMatches,type TargetObservation } from '../lib/levelling';
import LevellingCatalogue from '../components/LevellingCatalogue';
vi.mock('../lib/supabase',()=>({supabase:{}}));
const now=Date.parse('2026-10-22T00:00:00Z');
const profile:TargetObservation={id:2117366,name:'Observed name',level:41,state:'Okay',life:100,maximumLife:100,lastAction:Math.floor(now/1000)-60*86400,fetchedAt:new Date(now).toISOString()};
describe('ready-made levelling catalogue',()=>{
 it('ships real reported target records without fabricating current availability',()=>{
  expect(STARTER_TARGETS.length).toBe(32);expect(new Set(STARTER_TARGETS.map(t=>t.id)).size).toBe(32);
  for(const t of STARTER_TARGETS){expect(Number.isSafeInteger(t.id)&&t.id>0).toBe(true);expect(t.reportedTotal).toBeGreaterThan(0);expect(t.reportedLevel).toBeGreaterThan(0);expect(targetAvailability(undefined,now)).toBe('Not checked');}
 });
 it('offers ready-made subsets and stable numeric sorting without requiring user setup',()=>{
  const starter=filterStarterTargets(STARTER_TARGETS,{},100,'All','stats',now);
  expect(starter.length).toBeGreaterThan(0);expect(starter.length).toBeLessThan(STARTER_TARGETS.length);
  expect(starter.every(t=>t.reportedTotal<=100)).toBe(true);
  const levels=filterStarterTargets(STARTER_TARGETS,{},1000,'All','level',now).map(t=>t.reportedLevel);
  expect(levels).toEqual([...levels].sort((a,b)=>b-a));
  expect(filterStarterTargets(STARTER_TARGETS,{},1000,'Available','stats',now)).toEqual([]);
 });
 it('separates recently observed Okay status from inactivity and expires checks after five minutes',()=>{
  expect(targetAvailability(profile,now)).toBe('Available');
  expect(targetAvailability({...profile,fetchedAt:new Date(now-300001).toISOString()},now)).toBe('Check again');
  expect(targetAvailability({...profile,state:'Hospital'},now)).toBe('Hospital');
  expect(targetAvailability({...profile,lastAction:null},now)).toBe('Available');
  expect(targetAvailability({...profile,lastAction:now/1000-100},now)).toBe('Available');
  expect(targetAvailability({...profile,life:0},now)).toBe('Check again');
 });
 it('keeps the first observations usable when a complete paced list finishes two minutes later',()=>{
  expect(targetAvailability(profile,now+32*3400)).toBe('Available');
  expect(targetAvailability({...profile,fetchedAt:'invalid'},now)).toBe('Check again');
  expect(targetAvailability({...profile,fetchedAt:new Date(now+1000).toISOString()},now)).toBe('Check again');
 });
 it('filters inactivity only when explicitly selected and keeps unknown activity honest',()=>{
  const target=STARTER_TARGETS[0],recent={...profile,id:target.id,lastAction:now/1000-100};
  expect(filterStarterTargets([target],{[target.id]:recent},1000,'Available','stats',now)).toHaveLength(1);
  expect(filterStarterTargets([target],{[target.id]:recent},1000,'Available','stats',now,'30')).toHaveLength(0);
  expect(targetActivityMatches({...recent,lastAction:null},'30',now)).toBe(false);
  expect(targetActivityMatches({...recent,lastAction:null},'unknown',now)).toBe(true);
  expect(targetActivityMatches({...recent,lastAction:now/1000+100},'recent',now)).toBe(false);
  expect(targetActivityMatches(profile,'30',now)).toBe(true);
 });
 it('checks unknown and oldest profiles first without rechecking recent unavailable players',()=>{
  const rows=STARTER_TARGETS.slice(0,4),observations={
   [rows[0].id]:{...profile,id:rows[0].id,state:'Hospital'},
   [rows[1].id]:{...profile,id:rows[1].id,fetchedAt:new Date(now-400000).toISOString()},
   [rows[2].id]:{...profile,id:rows[2].id,fetchedAt:new Date(now-500000).toISOString()}
  };
  expect(nextTargetChecks(rows,observations,2,now)).toEqual([rows[3].id,rows[2].id]);
  expect(nextTargetChecks(STARTER_TARGETS,{},8,now)).toHaveLength(8);
 });
 it('never lets a restored older cache overwrite a newer target check',()=>{
  const older={...profile,state:'Hospital',fetchedAt:new Date(now-120000).toISOString()};
  expect(mergeTargetObservations({[profile.id]:profile},{[profile.id]:older})[profile.id]).toEqual(profile);
  expect(mergeTargetObservations({[profile.id]:older},{[profile.id]:profile})[profile.id]).toEqual(profile);
 });
 it('explains zero matches and offers a one-click way back to the populated list',()=>{
  const client=new QueryClient();client.setQueryData(['levelling-preferences'],{maximum:1000,availability:'Available',sort:'stats'});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><LevellingCatalogue/></QueryClientProvider>);
  expect(html).toContain('Show all 32 targets');expect(html).toContain('current status has not been checked');expect(html).toContain('Inactivity');expect(html).toContain('Check next 8');
 });
 it('refuses mismatched API profiles and does not derive private battle stats',()=>{
  const response={endpoint_id:'v2-user-{id}-profile',parameters:{id:String(profile.id)},fetched_at:new Date(now).toISOString(),next_parameters:null,payload:{profile:{id:profile.id,name:profile.name,level:profile.level,status:{state:'Okay'},life:{current:100,maximum:100},last_action:{timestamp:profile.lastAction}}}};
  const observed=targetObservation(profile.id,response);expect(observed).toEqual(profile);expect(observed).not.toHaveProperty('reportedTotal');
  expect(()=>targetObservation(1,response)).toThrow('requested target profile');
 });
 it('renders populated lists immediately with dropdowns, attribution and official Torn attack actions',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><LevellingCatalogue/></QueryClientProvider>);
  expect(html).toContain('Ready-made levelling lists');expect(html).toContain('32 real community-listed targets');expect(html).toContain('svyatoslavy');expect(html).toContain('2117366');expect(html).toContain('Not checked');
  expect(html).toContain('Built-in list');expect(html).toContain('Status filter');expect(html).toContain('Community reported');expect(html).toContain('href="https://www.torn.com/page.php?sid=attack&amp;user2ID=2117366"');expect(html.match(/>Attack<\/a>/g)).toHaveLength(32);expect(html).toContain('rel="noopener noreferrer"');expect(html).not.toContain('oran.pw');
 });
});
