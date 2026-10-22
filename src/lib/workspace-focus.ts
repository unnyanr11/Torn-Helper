export const FOCUS_OPTIONS=[
 {id:'levelling',label:'Level up',description:'Find levelling targets and plan your next milestones.',tools:[['Targets','Find levelling targets'],['Player Intel','Check a player'],['Planner','Plan a milestone']]},
 {id:'money',label:'Make money',description:'Compare travel profits, watch items and track investments.',tools:[['Travel','Compare travel profit'],['Markets','Watch item prices'],['Stocks','Track investments']]},
 {id:'progress',label:'Track my progress',description:'Review training, crime activity and collected stat history.',tools:[['Gym','Log training'],['Stat Growth','View stat growth'],['Crime Tracker','Track crimes']]},
 {id:'faction',label:'Manage a faction',description:'Open your roster, coordinate targets and plan organized crimes.',tools:[['Faction','Open faction tools'],['Chain Queue','Coordinate chain targets'],['OC Planner','Plan organized crimes']]},
 {id:'explore',label:'Explore all tools',description:'Start with a few useful tools and browse the categories at your pace.',tools:[['Targets','Find levelling targets'],['Travel','Compare travel profit'],['Stats Catalog','Browse available stats']]},
] as const;
export type WorkspaceFocus=typeof FOCUS_OPTIONS[number]['id'];
export const validFocus=(value:unknown):value is WorkspaceFocus=>FOCUS_OPTIONS.some(f=>f.id===value);
export function focusStorageKey(accountId:string){return `torn-helper:focus:v1:${accountId}`;}
export function parseFocus(raw:string|null):WorkspaceFocus|null{
 try{const data=JSON.parse(raw??'null');return data?.version===1&&validFocus(data.focus)?data.focus:null;}catch{return null;}
}
