import {GUIDE_RESEARCH,researchSections,type ResearchSource} from '../lib/guide-research';
export function ResearchSources({ids}:{ids:string[]}){
 return <ul className="research-citations" aria-label="Sources">{[...new Set(ids)].map(id=>{const source:ResearchSource|undefined=GUIDE_RESEARCH.sources[id];return source?<li key={id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><small>{source.kind} · checked {source.checkedAt}</small></li>:null;})}</ul>;
}
export default function GuideResearch({guideId}:{guideId:string}){
 const guide=GUIDE_RESEARCH.guides[guideId];if(!guide)return null;
 const sources=[...new Set(researchSections(guideId).flatMap(s=>s.sourceIds).concat((guide.tables??[]).flatMap(t=>t.sourceIds)))];
 return <div className="guide-research">
  <section className="research-start" aria-label="Updated learning plan"><h4>Start with a plan. Chaos can wait.</h4><p>{guide.summary}</p><ol>{guide.checklist.map(item=><li key={item}>{item}</li>)}</ol></section>
  <section className="research-corrections" aria-label="Corrections to the archived guide"><h4>Old advice that needs a tune-up</h4><ul>{guide.corrections.map(item=><li key={item}>{item}</li>)}</ul></section>
  <p className="muted">The source notes explain the mechanics; the tips are our advice, not a promise that Torn will behave nicely. Sources were checked on {GUIDE_RESEARCH.reviewedAt}. This is a dated snapshot, not continuous monitoring.</p>
  {researchSections(guideId).map(section=><section className="research-topic" key={section.slug} aria-labelledby={`guide-${guideId}-${section.slug}`}>
   <h4 tabIndex={-1} id={`guide-${guideId}-${section.slug}`}>{section.title}</h4>
   {section.status==='availability-unverified'&&<span className="badge">Current availability not verified</span>}
   <strong className="research-label">How it works · source notes</strong>{section.facts.map(fact=><p key={fact}>{fact}</p>)}
   <strong className="research-label">Practical tips · editorial advice</strong><ul>{section.tips.map(tip=><li key={tip}>{tip}</li>)}</ul>
   <ResearchSources ids={section.sourceIds}/>
  </section>)}
  {(guide.tables??[]).map(table=><section className="research-table" key={table.title}><h4>{table.title}</h4><div className="research-table-scroll" role="region" aria-label={table.title} tabIndex={0}><table><thead><tr>{table.columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div><ResearchSources ids={table.sourceIds}/></section>)}
  <details className="research-source-list"><summary>Sources for this guide · {sources.length}</summary><ResearchSources ids={sources}/></details>
 </div>;
}
