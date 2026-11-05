export const BATTLE_STATS=['strength','defense','speed','dexterity'] as const;
export type BattleStat=typeof BATTLE_STATS[number];
export type BattleSnapshot=Record<BattleStat,string>&{observed_at:string;source?:'official_api'|'log_estimate';baseline_at?:string|null};
export type BattleLogSync={checked_through:number;baseline_at:string;reason:string|null};
export type SharedMember={id:number;name:string;latest:BattleSnapshot|null;baseline:BattleSnapshot|null;log_sync?:BattleLogSync|null};
export type FactionBattleDashboard={faction_id:number;faction_name:string;verified_at:string;expires_at:string;members:SharedMember[]};
const decimal=(value:string)=>{if(!/^\d+(\.\d+)?$/.test(value))throw new Error('Invalid battle stat.');const [whole,fraction='']=value.split('.');return {digits:BigInt(whole+fraction),scale:fraction.length};};
export function compareBattleValues(a:string,b:string){const x=decimal(a),y=decimal(b),scale=Math.max(x.scale,y.scale);const diff=x.digits*10n**BigInt(scale-x.scale)-y.digits*10n**BigInt(scale-y.scale);return diff<0n?-1:diff>0n?1:0;}
export function formatBattleValue(value:string|null|undefined){
 if(value==null)return 'Not shared';
 if(!/^\d+(\.\d+)?$/.test(value))return 'Unknown';
 const [whole,fraction]=value.split('.');return BigInt(whole).toLocaleString()+(fraction?'.'+fraction:'');
}
export function battleGrowth(member:SharedMember,stat:BattleStat){
 if(!member.latest||!member.baseline)return null;
 const last=Date.parse(member.latest.observed_at),first=Date.parse(member.baseline.observed_at);if(!Number.isFinite(last)||!Number.isFinite(first)||last<=first)return null;
 const x=decimal(member.latest[stat]),y=decimal(member.baseline[stat]),scale=Math.max(x.scale,y.scale);
 const diff=x.digits*10n**BigInt(scale-x.scale)-y.digits*10n**BigInt(scale-y.scale),negative=diff<0n;
 const text=(negative?-diff:diff).toString().padStart(scale+1,'0');const value=scale?text.slice(0,-scale)+'.'+text.slice(-scale):text;
 return (negative?'−':diff>0n?'+':'')+formatBattleValue(value);
}
export function filterSharedMembers(members:SharedMember[],filter:string,sort:string,memberId:string,now=Date.now()){
 return members.filter(member=>(!memberId||String(member.id)===memberId)&&(filter==='all'||filter==='shared'&&!!member.latest||filter==='missing'&&!member.latest||filter==='stale'&&!!member.latest&&now-Date.parse(member.latest.observed_at)>86400000)).sort((a,b)=>{
  if(!BATTLE_STATS.includes(sort as BattleStat))return a.name.localeCompare(b.name);
  if(!a.latest||!b.latest)return Number(!!b.latest)-Number(!!a.latest);
  return compareBattleValues(b.latest[sort as BattleStat],a.latest[sort as BattleStat])||a.name.localeCompare(b.name);
 });
}
