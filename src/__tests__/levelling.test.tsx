import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { STARTER_TARGETS } from '../data/levelling-targets';
import { filterStarterTargets,targetAvailability,targetObservation,type TargetObservation } from '../lib/levelling';
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
 it('requires fresh actual status and inactivity before showing Available',()=>{
  expect(targetAvailability(profile,now)).toBe('Available');
  expect(targetAvailability({...profile,fetchedAt:new Date(now-61000).toISOString()},now)).toBe('Check again');
  expect(targetAvailability({...profile,state:'Hospital'},now)).toBe('Hospital');
  expect(targetAvailability({...profile,lastAction:null},now)).toBe('Activity unknown');
  expect(targetAvailability({...profile,lastAction:now/1000-100},now)).toBe('Recently active');
  expect(targetAvailability({...profile,life:0},now)).toBe('Check again');
 });
 it('refuses mismatched API profiles and does not derive private battle stats',()=>{
  const response={endpoint_id:'v2-user-{id}-profile',parameters:{id:String(profile.id)},fetched_at:new Date(now).toISOString(),next_parameters:null,payload:{profile:{id:profile.id,name:profile.name,level:profile.level,status:{state:'Okay'},life:{current:100,maximum:100},last_action:{timestamp:profile.lastAction}}}};
  const observed=targetObservation(profile.id,response);expect(observed).toEqual(profile);expect(observed).not.toHaveProperty('reportedTotal');
  expect(()=>targetObservation(1,response)).toThrow('requested target profile');
 });
 it('renders populated lists immediately with dropdowns, attribution and official Torn attack actions',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><LevellingCatalogue/></QueryClientProvider>);
  expect(html).toContain('Ready-made levelling lists');expect(html).toContain('32 real community-listed targets');expect(html).toContain('svyatoslavy');expect(html).toContain('2117366');expect(html).toContain('Not checked');
  expect(html).toContain('Built-in list');expect(html).toContain('Status filter');expect(html).toContain('Community reported');expect(html).toContain('href="https://www.torn.com/loader.php?sid=attack&amp;user2ID=2117366"');expect(html.match(/>Attack<\/a>/g)).toHaveLength(32);expect(html).toContain('rel="noopener noreferrer"');expect(html).not.toContain('oran.pw');
 });
});
