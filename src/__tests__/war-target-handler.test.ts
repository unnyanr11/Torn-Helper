import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {describe,it,expect,vi} from 'vitest';
import * as policies from '../../supabase/functions/_shared/war-targets';
import * as reports from '../../supabase/functions/_shared/war-reports';
function harness(actor=1){
 const lists=new Map<string,any>(),handlers:any[]=[];let handler!:(req:Request)=>Promise<Response>;
 const users=[{user_id:'leader',torn_id:1,revoked_at:null},{user_id:'member',torn_id:2,revoked_at:null},{user_id:'outsider',torn_id:3,revoked_at:null}];
 const writes:unknown[]=[],lookups:string[]=[];
 const rpc=vi.fn(async(name:string,args:any)=>{if(name==='commit_war_assignments'){const row=args.values_json;lists.set(args.owner_id,row);writes.push(row);return {data:row,error:null};}return {data:null,error:null};});
 const admin={rpc,from:(table:string)=>{
  const filters:((row:any)=>boolean)[]=[],state:{mutation?:any;insert?:any}={};
  const result=(single=true)=>{
   const all=table==='linked_torn_accounts'?users:table==='profiles'?[{id:actor===1?'leader':actor===2?'member':'outsider',tracking_paused:false}]:table==='war_target_lists'?[...lists.values()]:table==='war_handlers'?handlers:[];
   const row=all.find(r=>filters.every(f=>f(r)));
   if(state.insert){lists.set(state.insert.user_id,state.insert);writes.push(state.insert);return {data:state.insert,error:null};}
   if(state.mutation&&row){Object.assign(row,state.mutation);writes.push(state.mutation);}
   return {data:single?row??null:all.filter(r=>filters.every(f=>f(r))),error:null};
  };
  const q:any={select:()=>q,in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q;},gt:(k:string,v:any)=>{filters.push(r=>r[k]>v);return q;},order:()=>q,limit:()=>q,eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},is:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},update:(value:any)=>{state.mutation=value;return q;},insert:(value:any)=>{state.insert=value;return q;},maybeSingle:async()=>result(),single:async()=>result(),then:(resolve:any,reject:any)=>Promise.resolve(result(false)).then(resolve,reject)};
  return q;
 }};
 const payloads:Record<string,any>={
  '/user/faction':{faction:{id:10}},'/faction/basic':{basic:{id:10,leader_id:1}},
  '/faction/members':{members:[{id:1,name:'Leader'},{id:2,name:'Member'}]},
  '/faction/wars':{wars:{ranked:{war_id:7,start:1,end:null,factions:[{id:10,name:'Us'},{id:20,name:'Enemy'}]},raids:[],territory:[]}},
  '/faction/20/members':{members:[{id:50,name:'Enemy target',level:10,status:{state:'Hospital',until:2000000000}}]}
 };
 const get=vi.fn(async(path:string)=>{lookups.push(path);if(!payloads[path])throw new Error('Unexpected request');return payloads[path];});
 const deps:Record<string,any>={
  '../_shared/http.ts':{adminClient:()=>admin,authenticate:async(req:Request)=>req.headers.has('authorization')?{id:actor===1?'leader':actor===2?'member':'outsider'}:null,json:(body:any,status=200)=>new Response(JSON.stringify(body),{status}),preflight:()=>null,checked:(r:any)=>{if(r.error)throw r.error;return r;}},
  '../_shared/live-refresh.ts':{resolveRefreshKey:async()=> 'test-key',refreshFailure:(error:Error)=>({status:503,error:error.message})},
  '../_shared/torn-budget.ts':{budgetedTornFetch:()=>vi.fn()},'../_shared/torn.ts':{tornGet:get},'../_shared/war-targets.ts':policies,'../_shared/war-reports.ts':reports
 };
 const source=ts.transpileModule(readFileSync('supabase/functions/war-targets/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports:{},require:(name:string)=>deps[name],Deno:{serve:(fn:any)=>handler=fn,env:{get:()=>undefined}},Response,Request,Date,Number,Error,URLSearchParams});
 return {lists,handlers,payloads,get,writes,lookups,rpc,call:(body:any,auth=true)=>handler(new Request('https://example.test',{method:'POST',headers:auth?{authorization:'Bearer test'}:{},body:JSON.stringify(body)}))};
}
describe('war target gateway authorization and saved assignments',()=>{
 it('rejects unauthenticated access without fetching Torn',async()=>{const h=harness();expect((await h.call({action:'load'},false)).status).toBe(401);expect(h.get).not.toHaveBeenCalled();});
 it('does not let a regular member edit another member or spoof leader flags',async()=>{
  const h=harness(2),r=await h.call({action:'save',assignee_id:1,is_leader:true,target_ids:[50],war_key:'ranked:7:20'});
  expect((await r.json()).error).toContain('Only the current faction leader');expect(h.writes).toHaveLength(0);
 });
 it('a real leader cannot assign to someone outside the verified current faction roster',async()=>{
  const h=harness(),r=await h.call({action:'save',assignee_id:3,target_ids:[50],war_key:'ranked:7:20'});
  expect((await r.json()).error).toContain('Only the current faction leader');expect(h.writes).toHaveLength(0);
 });
 it('saves leader assignments to the chosen member and returns only selected attack targets',async()=>{
  const h=harness(),r=await h.call({action:'save',assignee_id:2,target_ids:[50],war_key:'ranked:7:20',expected_revision:null,assignment_reason:'Tactical assignment'});
  expect(r.status).toBe(200);expect(h.lists.get('member')).toMatchObject({faction_id:10,updated_by:1,target_ids:[50]});expect(h.lists.has('leader')).toBe(false);
 });
 it('rejects arbitrary non-enemy IDs and stale assignment revisions',async()=>{
  const h=harness();expect((await (await h.call({action:'save',target_ids:[999],war_key:'ranked:7:20'})).json()).error).toContain('active enemy faction');
  h.lists.set('leader',{user_id:'leader',war_key:'ranked:7:20',revision:4});
  expect((await h.call({action:'save',target_ids:[50],war_key:'ranked:7:20',expected_revision:3})).status).toBe(409);expect(h.writes).toHaveLength(0);
 });
 it('stops tracking when the war ends and cannot refresh another user via a forged assignee',async()=>{
  const h=harness(2);h.lists.set('member',{user_id:'member',war_key:'ranked:7:20',active:true,alerts_enabled:true,target_ids:[50],revision:1,updated_at:new Date(0).toISOString()});
  h.payloads['/faction/wars'].wars.ranked.end=2;
  await h.call({action:'refresh',assignee_id:1});expect(h.lists.get('member').active).toBe(false);expect(h.lists.has('leader')).toBe(false);expect(h.lookups).not.toContain('/faction/20/members');
 });
 it('alert preference changes make no upstream request and affect only the signed-in owner',async()=>{
  const h=harness(2);h.lists.set('member',{user_id:'member',alerts_enabled:true});
  await h.call({action:'alerts',enabled:false,assignee_id:1});expect(h.get).not.toHaveBeenCalled();expect(h.lists.get('member').alerts_enabled).toBe(false);
 });
});

it('passes the selected attack goal only for an owned assigned enemy target',async()=>{
 const h=harness(2);h.lists.set('member',{user_id:'member',war_key:'ranked:7:20',active:true,target_ids:[50],revision:1});
 expect((await h.call({action:'claim',target_id:50,attacks_goal:3,assignee_id:1})).status).toBe(200);
 expect(h.rpc).toHaveBeenCalledWith('take_war_target',{owner_id:'member',target:50,attack_goal:3});
 expect((await h.call({action:'claim',target_id:50,attacks_goal:0})).status).toBe(400);
 expect((await h.call({action:'claim',target_id:999,attacks_goal:2})).status).toBe(403);
});

it('rest uses only the authenticated owner and needs no upstream key or API request',async()=>{
 const h=harness(2);await h.call({action:'rest',owner_id:'leader',assignee_id:1});
 expect(h.rpc).toHaveBeenCalledWith('rest_war_targets',{owner_id:'member'});expect(h.get).not.toHaveBeenCalled();
});
it('returning without pending goals only ends the owner’s rest and makes no upstream request',async()=>{
 const h=harness(2);await h.call({action:'resume',owner_id:'leader'});
 expect(h.rpc).toHaveBeenCalledWith('resume_war_targets',{owner_id:'member'});expect(h.get).not.toHaveBeenCalled();
});

it('accepts a trusted current-war handler appointment for target assignments, but rejects stale appointments',async()=>{
 const h=harness(2);h.handlers.push({faction_id:10,war_key:'ranked:7:20',torn_id:2,appointed_by:1});
 const result=await h.call({action:'save',war_key:'ranked:7:20',assignee_id:1,target_ids:[50],assignment_reason:'Tactical matchup',expected_revision:null});
 expect(result.status).toBe(200);expect((await result.json()).is_leader).toBe(false);expect(h.lists.get('leader').target_ids).toEqual([50]);
 h.handlers[0].appointed_by=3;
 expect((await h.call({action:'save',war_key:'ranked:7:20',assignee_id:1,target_ids:[50],assignment_reason:'Stale appointment'})).status).toBe(503);
});
