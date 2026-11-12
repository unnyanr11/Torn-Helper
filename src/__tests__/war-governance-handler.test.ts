import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {it,expect,vi} from 'vitest';
import * as policy from '../../supabase/functions/_shared/war-targets';
function harness(){
 let handler!:(request:Request)=>Promise<Response>;
 const calls:any[]=[],get=vi.fn(async(path:string)=>{
  if(path==='/user/faction')return {faction:{id:1}};if(path==='/faction/basic')return {basic:{id:1,leader_id:1}};if(path==='/faction/members')return {members:[{id:1,name:'Leader'},{id:2,name:'Member'}]};if(path==='/faction/wars')return {wars:{ranked:{war_id:7,start:1,end:null,factions:[{id:1},{id:2}]},raids:[],territory:[]}};if(path==='/faction/2/members')return {members:[{id:50,name:'Target',status:{state:'Okay'}}]};throw new Error(path);
 });
 const admin={from:(table:string)=>{const q:any={select:()=>q,update:()=>q,then:(resolve:any)=>Promise.resolve({data:null,error:null}).then(resolve),eq:()=>q,is:()=>q,maybeSingle:async()=>({data:table==='linked_torn_accounts'?{torn_id:2}:{war_key:'ranked:7:2',faction_id:1,revision:1,target_ids:[50]},error:null}),single:async()=>({data:{tracking_paused:false},error:null})};return q;},rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:name==='war_governance'?{queue:[],requests:[]}:null,error:null};}};
 const modules:any={'../_shared/http.ts':{adminClient:()=>admin,authenticate:async(r:Request)=>r.headers.has('authorization')?{id:'member'}:null,json:(b:any,status=200)=>new Response(JSON.stringify(b),{status}),preflight:()=>null,checked:(r:any)=>{if(r.error)throw r.error;return r;}},'../_shared/live-refresh.ts':{resolveRefreshKey:async()=> 'test-key',refreshFailure:()=>({error:'Failed',status:503})},'../_shared/torn-budget.ts':{budgetedTornFetch:()=>vi.fn()},'../_shared/torn.ts':{tornGet:get},'../_shared/war-targets.ts':policy};
 const source=ts.transpileModule(readFileSync('supabase/functions/war-governance/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports:{},require:(name:string)=>modules[name],Deno:{serve:(fn:any)=>handler=fn,env:{get:()=>undefined}},Response,Request,Date,Number,Error});
 return {calls,get,call:(body:any,auth=true)=>handler(new Request('https://example.test',{method:'POST',headers:auth?{authorization:'Bearer test'}:{},body:JSON.stringify(body)}))};
}
it('rejects unauthenticated coordination without upstream requests',async()=>{const h=harness();expect((await h.call({action:'verify'},false)).status).toBe(401);expect(h.get).not.toHaveBeenCalled();});
it('verifies actual Torn identity, roster, war and leader instead of trusting browser role fields',async()=>{
 const h=harness();await h.call({action:'handler',member_id:1,enabled:true,owner_id:'leader',is_leader:true,leader_id:2});
 const proof=h.calls.find(c=>c.name==='verify_war_command');expect(proof.args).toMatchObject({owner_id:'member',identity:2,leader:1,war:'ranked:7:2'});
 const command=h.calls.find(c=>c.name==='war_governance'&&c.args.command==='handler');expect(command.args.owner_id).toBe('member');expect(command.args.body).not.toHaveProperty('is_leader');expect(command.args.body).not.toHaveProperty('owner_id');
});
it('leaving a queue, declining and readonly polling use no additional Torn calls',async()=>{
 for(const body of [{action:'leave_queue',target_id:50},{action:'respond',request_id:'request',accept:false},{action:'poll'}]){const h=harness();await h.call(body);expect(h.get).not.toHaveBeenCalled();expect(h.calls[0].args.owner_id).toBe('member');}
});
