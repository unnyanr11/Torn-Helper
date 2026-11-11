import snapshot from './baldr-targets.json';
/** Public community reports, imported from the dataset loaded by OranWeb's app.
 * Retrieved 2026-11-12. Retrieval is not a spy/report date; live status is never imported.
 * Repository: https://github.com/oranweb/tc-baldrs-levelling-list (script.js DATA_URL).
 * Data: https://github.com/Baldr-Geek/Baldrs-List/blob/8edafd4aabdc8e01b32be1e83163a06065822659/data.json
 * Duplicate players retain membership in every source list. No runtime third-party requests.
 */
export const LEVELLING_SNAPSHOT = '2026-11-12';
export const BALDR_SOURCE_COMMIT = '8edafd4aabdc8e01b32be1e83163a06065822659';
export const BALDR_LISTS = Object.keys(snapshot);
export interface StarterTarget { id:number; name:string; reportedLevel:number; reportedTotal:number; lists?:string[] }
const number=(value:string)=>Number(value.replace(/,/g,''));
const targets=new Map<number,StarterTarget>();
for(const [list,records] of Object.entries(snapshot))for(const record of records){
 const id=number(record.id),existing=targets.get(id);
 if(existing){existing.lists!.push(list);continue;}
 targets.set(id,{id,name:record.name,reportedLevel:number(record.lvl),reportedTotal:number(record.total),lists:[list]});
}
export const STARTER_TARGETS:StarterTarget[] = [...targets.values()];
