import data from '../data/player-guide-updates.json';
export interface ResearchSection {slug:string;title:string;sourceIds:string[];facts:string[];tips:string[];status:string;}
export interface ResearchTable {title:string;sourceIds:string[];columns:string[];rows:string[][];}
export interface ResearchGuide {summary:string;corrections:string[];checklist:string[];sections:ResearchSection[];extras?:ResearchSection[];tables?:ResearchTable[];}
export interface ResearchSource {title:string;url:string;checkedAt:string;kind:string;}
export const GUIDE_RESEARCH:{reviewedAt:string;scope:string;method:string;sources:Record<string,ResearchSource>;guides:Record<string,ResearchGuide>}=data;
export const researchSections=(id:string)=>{const guide=GUIDE_RESEARCH.guides[id];return guide?[...guide.sections,...(guide.extras??[])]:[];};
export const RESEARCH_COUNTS={sources:Object.keys(GUIDE_RESEARCH.sources).length,originalTopics:Object.values(GUIDE_RESEARCH.guides).reduce((n,g)=>n+g.sections.length,0),topics:Object.keys(GUIDE_RESEARCH.guides).reduce((n,id)=>n+researchSections(id).length,0),tips:Object.keys(GUIDE_RESEARCH.guides).reduce((n,id)=>n+researchSections(id).reduce((t,s)=>t+s.tips.length,0),0)};
export const guideDisplayTitle=(id:string,title:string)=>id==='crimes2'?'Crimes 2.0':title;
