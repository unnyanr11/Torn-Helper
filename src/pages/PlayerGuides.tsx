import {useEffect,useState} from 'react';
import GuideResearch,{ResearchSources} from '../components/GuideResearch';
import {GUIDE_RESEARCH,RESEARCH_COUNTS,researchSections,guideDisplayTitle} from '../lib/guide-research';
import GuideArticle from '../components/GuideArticle';
import {PLAYER_GUIDES,GUIDE_SOURCE,GUIDE_TOOLS,findGuides,guideHeadings,guideLocation,guideRoute} from '../lib/player-guides';
import './player-guides.css';
export default function PlayerGuides(){
 const [location,setLocation]=useState(()=>guideLocation(typeof window==='undefined'?'':window.location.hash));
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[edition,setEdition]=useState<'updated'|'archive'>('updated');
 useEffect(()=>{const change=()=>setLocation(guideLocation(window.location.hash));window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 const guide=location.guide,headings=edition==='archive'?guideHeadings(guide):researchSections(guide.id).map(h=>({...h,id:`guide-${guide.id}-${h.slug}`,level:guideHeadings(guide).find(original=>original.slug===h.slug)?.level??2,label:h.title})),results=findGuides(query,category),index=PLAYER_GUIDES.findIndex(g=>g.id===guide.id);
 useEffect(()=>{if(!location.section)return;const heading=headings.find(h=>h.slug===location.section);if(!heading)return;const frame=requestAnimationFrame(()=>{const element=document.getElementById(heading.id);element?.scrollIntoView({block:'start',behavior:'instant'});element?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[guide,location.section,edition]);
 return <section className="player-guides">
  <h2>Player Guides</h2>
  <p>Learn the basics, reach level 15 and explore ways to build your Torn account. Explore {RESEARCH_COUNTS.topics} researched topics and {RESEARCH_COUNTS.tips} practical tips across {PLAYER_GUIDES.length} guides.</p>
  <aside className="card guide-source-note" aria-label="Guide source and freshness"><strong>Updated research · {GUIDE_RESEARCH.reviewedAt} · not live game data</strong><p>All {RESEARCH_COUNTS.originalTopics} original topics and subtopics have individual review notes, with extra walkthroughs and links to {RESEARCH_COUNTS.sources} sources. Mechanics, editorial tips and unverified faction availability are labelled separately. Prices and game rules can change after this review.</p><a href={GUIDE_SOURCE.url} target="_blank" rel="noopener noreferrer">Original TC Essentials project ↗</a> · <a href="https://www.torn.com/rules.php" target="_blank" rel="noopener noreferrer">Current game rules ↗</a></aside>
  <details className="research-source-list"><summary>Research sources · {RESEARCH_COUNTS.sources}</summary><ResearchSources ids={Object.keys(GUIDE_RESEARCH.sources)}/></details>
  <div className="guides-layout">
   <aside className="guides-library" aria-label="Guide library">
    <div className="card"><label>Search guides<input className="nu-input" type="search" placeholder="Try travelling, money or trade…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <label>Category<select className="nu-input" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All guides</option>{[...new Set(PLAYER_GUIDES.map(g=>g.category))].map(c=><option key={c}>{c}</option>)}</select></label>
     <p role="status">{results.length} of {PLAYER_GUIDES.length} guides</p>
     <nav aria-label="Choose a player guide">{results.map(g=><a key={g.id} href={guideRoute(g.id)} className={`guide-choice ${guide.id===g.id?'selected':''}`} aria-current={guide.id===g.id?'page':undefined}><strong>{guideDisplayTitle(g.id,g.title)}</strong><small>{g.description}</small></a>)}</nav>
     {!results.length&&<p>No guides match. Try another search or category.</p>}
    </div>
   </aside>
   <article className="card guide-reader" aria-labelledby="guide-title" key={guide.id}>
    <header><span className="badge">{guide.category}</span><h3 id="guide-title">{guideDisplayTitle(guide.id,guide.title)}</h3><p>{guide.description}</p><small>{edition==='updated'?`Research checked: ${GUIDE_RESEARCH.reviewedAt}`:`Recorded source date: ${guide.sourceDate} · Historical imported text`}</small></header>
    {guide.id==='factions-new-players'&&<p className="guide-caution">This is a historical faction directory. Membership requirements, benefits, recruitment status and names may have changed.</p>}
    {guide.id==='easter'&&<p className="guide-caution">Seasonal reference. This does not mean an Easter event is currently running.</p>}
    {edition==='archive'&&guide.id==='crimes2'&&<p className="guide-caution">The source points readers to Emforus’s forum guide; it is a resource link, not a complete Crimes 2.0 walkthrough.</p>}
    <div className="guide-editions" role="group" aria-label="Guide edition"><button type="button" className="nu-btn" aria-pressed={edition==='updated'} onClick={()=>setEdition('updated')}>Updated edition</button><button type="button" className="nu-btn" aria-pressed={edition==='archive'} onClick={()=>setEdition('archive')}>Original archive</button></div>
    {edition==='archive'&&<p className="guide-caution">Historical source text follows. Its prices, mechanics, recruitment claims and third-party recommendations may be outdated. Use the updated edition and its sources when planning.</p>}
    <div className="guide-tools"><strong>Use Torn Helper tools</strong>{(GUIDE_TOOLS[guide.id]??[]).map(page=><a key={page} className="nu-btn" href={'#'+encodeURIComponent(page)}>{page}</a>)}</div>
    <details className="guide-contents"><summary>On this page · {headings.length} sections</summary><nav aria-label="Guide sections">{headings.map(h=><a key={h.id} href={guideRoute(guide.id,h.slug)} style={{paddingLeft:`${Math.max(0,h.level-2)*12}px`}}>{h.label}</a>)}</nav></details>
    {edition==='updated'?<GuideResearch guideId={guide.id}/>:<GuideArticle guide={guide}/>}
    <footer className="guide-end"><a href={`${GUIDE_SOURCE.url}/blob/${GUIDE_SOURCE.commit}/${guide.sourcePath}`} target="_blank" rel="noopener noreferrer">Read the original source ↗</a><small>Illustrations open on demand. No API key is needed to read these guides.</small><nav aria-label="Next and previous guide">{index>0&&<a href={guideRoute(PLAYER_GUIDES[index-1].id)}>← {guideDisplayTitle(PLAYER_GUIDES[index-1].id,PLAYER_GUIDES[index-1].title)}</a>}{index<PLAYER_GUIDES.length-1&&<a href={guideRoute(PLAYER_GUIDES[index+1].id)}>{guideDisplayTitle(PLAYER_GUIDES[index+1].id,PLAYER_GUIDES[index+1].title)} →</a>}</nav></footer>
   </article>
  </div>
 </section>;
}
