import library from '../data/player-guides.json';
import type { Page } from '../nav';
export const PLAYER_GUIDES=library.guides;
export const GUIDE_SOURCE={url:library.source,commit:library.commit,retrieved:library.retrieved};
export type PlayerGuide=typeof PLAYER_GUIDES[number];
export const GUIDE_TOOLS:Record<string,Page[]>={introduction:['Tornipedia','Planner'],'basic-elements':['Tornipedia','Gym','Crime Tracker'],level15:['Targets','Gym'],after15:['Travel','Travel Optimizer','Flight Tracker'],'money-making':['Travel Optimizer','Markets','ROI Calculator'],'money-storage':['Stocks','Properties'],'how-to-set-trade':['Markets'],'factions-new-players':['Recruitment','Faction'],crimes2:['Crime Tracker'],easter:['Community']};
export const headingSlug=(text:string)=>text.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s+/g,'-');
export function guideHeadings(guide:PlayerGuide){
 const seen=new Map<string,number>();
 return guide.body.split('\n').flatMap((line,index)=>{
  const match=/^(#{1,6})\s+(.+)$/.exec(line);if(!match)return [];
  const slug=headingSlug(match[2]),count=seen.get(slug)??0;seen.set(slug,count+1);
  return [{line:index+1,level:match[1].length,label:match[2].replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`]/g,''),slug:slug+(count?`-${count}`:''),id:`guide-${guide.id}-${slug}${count?`-${count}`:''}`}];
 });
}
export function guideRoute(id:string,section=''){return '#Player%20Guides?'+new URLSearchParams({guide:id,...(section?{section}:{})}).toString();}
export function guideLocation(hash:string){
 const params=new URLSearchParams(hash.split('?')[1]??'');
 return {guide:PLAYER_GUIDES.find(g=>g.id===params.get('guide'))??PLAYER_GUIDES[0],section:params.get('section')??''};
}
export function findGuides(query:string,category='all'){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return PLAYER_GUIDES.filter(g=>(category==='all'||g.category===category)&&words.every(word=>`${g.title} ${g.description} ${g.body}`.toLowerCase().includes(word)));
}
export function guideUrl(value:string,guide:PlayerGuide,image=false):string{
 if(!value||value.length>4096||/[\u0000-\u001f\u007f]/.test(value))return '';
 if(value.startsWith('#')&&!image){const slug=headingSlug(value.slice(1));return guideRoute(guide.id,slug);}
 try{
  const group=guide.sourcePath.split('/').at(-2);
  const base=image?`https://raw.githubusercontent.com/OranWeb/TCEssentials/${GUIDE_SOURCE.commit}/static/`:`https://tc-essentials.oran.pw/docs/${group}/${guide.id}/`;
  const url=new URL(value,base);
  if(!['https:','http:','mailto:'].includes(url.protocol)||url.username||url.password)return '';
  if(!image&&url.hostname==='tc-essentials.oran.pw'){
   const name=url.pathname.replace(/\/$/,'').split('/').pop()?.replace(/\.md$/,'').toLowerCase();
   const found=PLAYER_GUIDES.find(g=>g.id===name);
   if(found)return guideRoute(found.id,headingSlug(url.hash.slice(1)));
  }
  return url.href;
 }catch{return '';}
}
