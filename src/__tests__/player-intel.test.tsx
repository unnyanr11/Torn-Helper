import { describe,it,expect,vi,afterEach } from 'vitest';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { lookupPlayerProfile,playerId,profileHistory,PLAYER_PROFILE_ENDPOINT } from '../lib/player-intel';
import { compileTornRequest } from '../../supabase/functions/_shared/torn-data';
import type { TornObservation } from '../lib/personal-data';
import PlayerIntel from '../pages/PlayerIntel';
import { observationKey } from '../lib/personal-data';
const cache=vi.hoisted(()=>({entries:{} as Record<string,any>}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../hooks/useTornChoices',()=>({useTornChoices:()=>({owner:'owner-a',data:[],entries:cache.entries})}));
afterEach(()=>{vi.unstubAllGlobals();cache.entries={};});
const response=(id=4317919):TornObservation=>({endpoint_id:PLAYER_PROFILE_ENDPOINT,parameters:{id:String(id)},payload:{profile:{id,name:'Unnyan',level:12,status:{state:'Okay'},last_action:{status:'Idle'}}},fetched_at:'2026-10-22T10:00:00Z',next_parameters:null,cached:false});
const signal=new AbortController().signal;
describe('Player Intel supports the shared key flow',()=>{
 it('routes a request-only key through the registered public-profile endpoint',async()=>{
  const fetch=vi.fn(async(body:any)=>{const compiled=compileTornRequest(body.endpoint_id,body.parameters);expect(compiled.path).toContain('/user/4317919/profile');return response();});
  await lookupPlayerProfile('4317919','AbCdEfGh12345678',signal,fetch);
  await lookupPlayerProfile('4317919','AbCdEfGh12345678',signal,fetch);expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith({endpoint_id:PLAYER_PROFILE_ENDPOINT,parameters:{id:'4317919'},apiKey:'AbCdEfGh12345678'},signal);
 });
 it('omits the key field for encrypted-key resolution by the gateway',async()=>{
  const fetch=vi.fn(async(_body:any,_signal:AbortSignal)=>response());await lookupPlayerProfile('4317919',undefined,signal,fetch);expect(fetch.mock.calls[0][0]).not.toHaveProperty('apiKey');
 });
 it('rejects malformed player IDs and keys before sending requests',async()=>{
  const fetch=vi.fn();for(const id of ['','0','-1','abc','1.1','9007199254740992'])expect(()=>playerId(id)).toThrow('valid positive');
  await expect(lookupPlayerProfile('4317919','bad',signal,fetch)).rejects.toThrow('16-character');expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects wrong-player responses instead of displaying or recording another profile',async()=>{
  await expect(lookupPlayerProfile('4317919',undefined,signal,async()=>response(2117366))).rejects.toThrow('requested player');
 });
 it('stops cancelled lookups before sending or applying a late response',async()=>{
  const controller=new AbortController();controller.abort();const fetch=vi.fn();await expect(lookupPlayerProfile('4317919',undefined,controller.signal,fetch)).rejects.toThrow('Cancelled');expect(fetch).not.toHaveBeenCalled();
  const later=new AbortController();await expect(lookupPlayerProfile('4317919',undefined,later.signal,async()=>{later.abort();return response();})).rejects.toThrow('Cancelled');
 });
 it('preserves owner-scoped public observations and their original timestamp',()=>{
  expect(profileHistory('owner-a',response())).toEqual({user_id:'owner-a',torn_player_id:4317919,status:'Okay',level:12,last_action:'Idle',observed_at:'2026-10-22T10:00:00Z'});
 });
 it('offers a request-only key when identity is linked without a retained key',()=>{
  vi.stubGlobal('location',{hash:'#Player%20Intel?player=4317919'});const client=new QueryClient();client.setQueryData(['torn-key-status','owner-a'],{hasStoredKey:false});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><PlayerIntel/></QueryClientProvider>);
  expect(html).toContain('identity can be linked without retaining a key');expect(html).toContain('type="password"');expect(html).toContain('Use a key for this lookup');expect(html).not.toContain('Link a Torn key in Settings');
 });
 it('defaults to the existing encrypted key when retained, without asking for another key',()=>{
  vi.stubGlobal('location',{hash:'#Player%20Intel'});const client=new QueryClient();client.setQueryData(['torn-key-status','owner-a'],{hasStoredKey:true});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><PlayerIntel/></QueryClientProvider>);
  expect(html).toContain('value="stored" selected');expect(html).not.toContain('type="password"');expect(html).toContain('Look up player');
 });
 it('shows saved profiles without an automatic lookup and retains honest snapshot labels',()=>{
  vi.stubGlobal('location',{hash:'#Player%20Intel?player=4317919'});cache.entries={[observationKey(PLAYER_PROFILE_ENDPOINT,{id:'4317919'})]:{observation:response()}};
  const client=new QueryClient();client.setQueryData(['torn-key-status','owner-a'],{hasStoredKey:false});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><PlayerIntel/></QueryClientProvider>);expect(html).toContain('Unnyan');expect(html).toContain('Saved snapshot');expect(html).toContain('Refresh observation');expect(html).not.toContain('Loading profile');
 });
});
