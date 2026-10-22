import { describe,it,expect,vi,afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { searchChoices } from '../lib/choice-search';
import { FOCUS_OPTIONS,focusStorageKey,parseFocus } from '../lib/workspace-focus';
import { canAccessPage } from '../lib/access';
import { ESSENTIAL_PATHS,remainingAtObservation,freshnessLabel } from '../lib/home-dashboard';
import { CONNECTED_REQUESTS,request,type DataEntry } from '../lib/connected-data';
import { collectConnected } from '../lib/connected-collection';
import { observationKey } from '../lib/personal-data';
import HomeDashboard from '../components/HomeDashboard';
import WorkspaceWelcome from '../components/WorkspaceWelcome';
import SelectEntry from '../components/SelectEntry';
import MyTorn from '../components/MyTorn';
vi.mock('../lib/supabase',()=>({supabase:{}}));
afterEach(()=>vi.unstubAllGlobals());
const now=Date.now(),fetched=new Date(now).toISOString();
function entry(path:string,payload:unknown):Record<string,DataEntry>{const row=request(path,'Personal');return {[observationKey(row.capability.id,{})]:{observation:{endpoint_id:row.capability.id,parameters:{},payload,fetched_at:fetched,next_parameters:null}}};}
describe('first-use setup and useful home screen',()=>{
 it('starts without a forced goal and accepts only versioned known device preferences',()=>{
  expect(parseFocus(null)).toBeNull();expect(parseFocus('bad')).toBeNull();expect(parseFocus('{"version":1,"focus":"admin"}')).toBeNull();
  expect(parseFocus('{"version":1,"focus":"money"}')).toBe('money');expect(focusStorageKey('first')).not.toBe(focusStorageKey('second'));
  const html=renderToStaticMarkup(<WorkspaceWelcome focus={null} onChoose={()=>{}}/>);
  expect(html).toContain('What would you like to do first?');expect(html).toContain('Explore all tools');expect(html).toContain('saved on this device');
 });
 it('provides useful internal shortcuts for every goal without granting privileged access',()=>{
  for(const focus of FOCUS_OPTIONS){
   for(const [page] of focus.tools)expect(canAccessPage(page,true,'user')).toBe(true);
   const html=renderToStaticMarkup(<WorkspaceWelcome focus={focus.id} onChoose={()=>{}}/>);
   expect(html).toContain('Recommended tools');expect(html).toContain('Change goal');expect(html).not.toContain('href="http');
  }
 });
 it('keeps essentials to four requests without related expansion',async()=>{
  const rows=CONNECTED_REQUESTS.filter(r=>ESSENTIAL_PATHS.includes(r.capability.path));expect(rows).toHaveLength(4);
  const fetch=vi.fn(async(row:typeof rows[number])=>({observation:{endpoint_id:row.capability.id,parameters:{},payload:{},fetched_at:fetched,next_parameters:null}}));
  const result=await collectConnected({requests:rows,areas:['Personal'],signal:new AbortController().signal,fetch,pause:async()=>{},onResult:()=>{},onDiscover:()=>{},onProgress:()=>{}});
  expect(result.done).toBe(4);expect(fetch).toHaveBeenCalledTimes(4);
 });
 it('shows only actual bars and labels cooldowns as estimates rather than current guarantees',()=>{
  const entries={...entry('/user/bars',{bars:{energy:{current:38,maximum:100},nerve:{current:0,maximum:30}}}),...entry('/user/cooldowns',{cooldowns:{drug:3600}}),...entry('/user/travel',{travel:{time_left:300,destination:'Mexico'}})};
  const html=renderToStaticMarkup(<HomeDashboard entries={entries}/>);
  expect(html).toContain('38 / 100');expect(html).toContain('0 / 30');expect(html).toContain('Not available');expect(html).toContain('At last check');expect(html).toContain('Countdowns estimate');expect(html).toContain('Mexico');expect(html).not.toContain('Ready');
  const empty=renderToStaticMarkup(<HomeDashboard entries={{}}/>);expect(empty).toContain('Not collected');expect(empty).not.toContain('0 / 100');
 });
 it('does not project estimates from invalid observation times',()=>{
  expect(remainingAtObservation(100,new Date(now-30000).toISOString(),now)).toBe(70);
  expect(remainingAtObservation(100,new Date(now+30000).toISOString(),now)).toBeNull();expect(remainingAtObservation(null,fetched,now)).toBeNull();
  expect(freshnessLabel(new Date(now-600000).toISOString(),now)).toContain('Snapshot');
 });
 it('puts essentials first and keeps full collection available behind an expander',()=>{
  vi.stubGlobal('location',{hash:'#Overview'});
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MyTorn/></QueryClientProvider>);
  expect(html).toContain('Refresh essentials');expect(html).toContain('Load more data and advanced options');expect(html).toContain('All connected data');expect(html).toContain('Your daily overview');expect(html).not.toContain('<details class="card home-connected" open');
  vi.stubGlobal('location',{hash:'#Overview?area=Inventory'});
  const linked=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><MyTorn/></QueryClientProvider>);
  expect(linked).toContain('<details class="card home-connected" open');expect(linked).toMatch(/<option[^>]*selected[^>]*>Inventory<\/option>/);
 });
});
describe('searchable choices',()=>{
 it('finds names and IDs without dropping duplicate-name items or limiting matches',()=>{
  const options=Array.from({length:1502},(_,i)=>({value:String(i+1),label:i<2?'Same named item':`Item ${i+1}`}));
  expect(searchChoices(options,'same')).toHaveLength(2);expect(searchChoices(options,'1502')).toEqual([options[1501]]);expect(searchChoices(options,'item')).toHaveLength(1502);expect(searchChoices(options,'no match')).toEqual([]);
  expect(searchChoices([{value:'1',label:'Café item'}],'cafe')).toHaveLength(1);
 });
 it('keeps native selection, required/disabled state and custom values while adding optional search',()=>{
  const html=renderToStaticMarkup(<SelectEntry searchable label="Item" value="999" onChange={()=>{}} options={[{value:'1',label:'Known item'}]} required disabled/>);
  expect(html).toContain('type="search"');expect(html).toContain('aria-controls');expect(html).toContain('<select');expect(html).toContain('value="999" selected');expect(html).toContain('required');expect(html).toContain('disabled');expect(html).toContain('Enter a custom value');
 });
});
