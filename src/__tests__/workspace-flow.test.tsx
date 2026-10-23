import { describe,it,expect,vi,afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { dateBounds } from '../lib/date-window';
import { playerInput } from '../lib/player-picker';
import { fetchPlayerComparisons } from '../lib/player-comparison';
import PlayerPicker from '../components/PlayerPicker';
import TornConnectionPanel from '../components/TornConnectionPanel';
import SpatialShell from '../components/SpatialShell';
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../hooks/useSavedObservations',()=>({useCurrentObservations:()=>({owner:'owner-a',data:{}})}));
vi.mock('../hooks/useTornChoices',()=>({useTornChoices:()=>({owner:'owner-a',data:[{endpoint_id:'v2-user-{id}-profile',payload:{profile:{id:123,name:'Recent player'}}},{endpoint_id:'v2-faction-members',payload:{members:[{id:456,name:'Faction member'}]}}],entries:{}})}));
afterEach(()=>vi.unstubAllGlobals());
const now=Date.parse('2026-10-23T13:45:00Z');
describe('workspace flow boundaries',()=>{
 it('includes the entire final UTC date and handles Today without a rolling 24-hour window',()=>{
  expect(dateBounds({period:'today',from:'',to:''},now)).toEqual({from:'2026-10-23T00:00:00.000Z'});
  expect(dateBounds({period:'custom',from:'2026-10-01',to:'2026-10-07'},now)).toEqual({from:'2026-10-01T00:00:00.000Z',to:'2026-10-08T00:00:00.000Z'});
  expect(dateBounds({period:'7',from:'',to:''},now).from).toBe('2026-10-16T13:45:00.000Z');
 });
 it('rejects reversed, incomplete and nonexistent custom dates',()=>{
  for(const [from,to] of [['','2026-10-07'],['2026-10-08','2026-10-07'],['2026-02-31','2026-03-05']])expect(()=>dateBounds({period:'custom',from,to},now)).toThrow();
 });
 it('accepts official profile URLs without accepting arbitrary sites or unsafe IDs',()=>{
  expect(playerInput('https://www.torn.com/profiles.php?XID=4317919')).toBe('4317919');
  expect(playerInput('https://torn.com/profiles.php?ID=123')).toBe('123');
  expect(playerInput(' 123 ')).toBe('123');
  for(const url of ['https://evil.example/profiles.php?XID=123','https://torn.com.evil.example/profiles.php?XID=123','https://torn.com/profiles.php?XID=-1'])expect(playerInput(url)).toBe(url);
 });
 it('requests actual custom stat boundaries, avoiding a future end date',async()=>{
  const request=vi.fn(async(endpoint:string,parameters:Record<string,string>)=>({payload:endpoint.endsWith('profile')?{profile:{id:Number(parameters.id)}}:{personalstats:[{name:'attackswon',value:10,timestamp:Number(parameters.timestamp)}]},fetched_at:new Date(now).toISOString()}));
  await fetchPlayerComparisons([123,456],'custom',request,now,{from:'2026-10-01T00:00:00Z',to:'2026-10-08T00:00:00Z'});
  const timestamps=request.mock.calls.filter(([id])=>id.endsWith('personalstats')).map(([,p])=>Number(p.timestamp));
  expect(Math.min(...timestamps)).toBe(Date.parse('2026-10-01T00:00:00Z')/1000);
  expect(Math.max(...timestamps)).toBe(Date.parse('2026-10-07T23:59:00Z')/1000);
  await expect(fetchPlayerComparisons([123,456],'custom',request,now,{from:'2026-10-25T00:00:00Z'})).rejects.toThrow('time window');
 });
 it('offers always-searchable grouped choices and direct IDs without lookup requests',()=>{
  const client=new QueryClient();client.setQueryData(['player-picker-targets','owner-a'],[{torn_player_id:789,player_name:'Saved target'}]);
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><PlayerPicker value="" onChange={()=>{}}/></QueryClientProvider>);
  for(const text of ['type="search"','Recent players','My faction','My targets','Saved target','Player ID or Torn profile URL'])expect(html).toContain(text);
 });
 it('never calls retained-key metadata verified access, and scopes checks to their endpoint',()=>{
  const client=new QueryClient();client.setQueryData(['torn-connection','owner-a'],{hasStoredKey:true,identity:{torn_id:123,torn_name:'Player'}});
  const render=()=>renderToStaticMarkup(<QueryClientProvider client={client}><TornConnectionPanel mode="stored" onMode={()=>{}} keyValue="" onKey={()=>{}}/></QueryClientProvider>);
  expect(render()).toContain('Not checked this session');expect(render()).toContain('does not confirm current endpoint permissions');
  client.setQueryData(['torn-verification','owner-b'],{at:new Date(now).toISOString(),endpoint:'/user/bars',mode:'stored'});expect(render()).not.toContain('Access confirmed');
  client.setQueryData(['torn-verification','owner-a'],{at:new Date(now).toISOString(),endpoint:'/user/profile',mode:'stored'});expect(render()).toContain('Access confirmed for /user/profile');expect(render()).toContain('Other sections may need different permissions');
 });
 it('opens the active category, keeps the appearance menu and separates per-account navigation',()=>{
  const storage=new Map([['tcc-navigation:owner-a',JSON.stringify({favourites:['Player Intel'],recent:['Travel']})]]);vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null});
  const render=(owner:string)=>renderToStaticMarkup(<SpatialShell accountId={owner} page="Player Intel" signedIn role="user" shared={false} onNavigate={()=>{}}>Content</SpatialShell>);
  const html=render('owner-a');expect(html).toContain('<summary class="nu-btn">Appearance</summary>');expect(html).toContain('<details class="tool-category" open=""><summary>Intelligence</summary>');expect(html).toContain('Favourites');expect(html).toContain('Recently used');expect(render('owner-b')).not.toContain('<small>Favourites</small>');
 });
});
