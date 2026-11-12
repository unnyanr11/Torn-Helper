import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import GuideResearch from '../components/GuideResearch';
import {GUIDE_RESEARCH,RESEARCH_COUNTS,researchSections} from '../lib/guide-research';
import {PLAYER_GUIDES,guideHeadings,findGuides} from '../lib/player-guides';
import PlayerGuides from '../pages/PlayerGuides';
describe('updated guide research',()=>{
 it('covers every original heading individually with attributable notes and practical advice',()=>{
  expect(RESEARCH_COUNTS.originalTopics).toBe(127);expect(RESEARCH_COUNTS.topics).toBe(150);expect(RESEARCH_COUNTS.tips).toBe(300);
  for(const guide of PLAYER_GUIDES){
   const research=GUIDE_RESEARCH.guides[guide.id];expect(research).toBeDefined();
   expect(research.sections.map(s=>s.slug)).toEqual(guideHeadings(guide).map(h=>h.slug));
   const sections=researchSections(guide.id);expect(new Set(sections.map(s=>s.slug)).size).toBe(sections.length);
   for(const section of sections){expect(section.facts.length).toBeGreaterThan(0);expect(section.tips.length).toBeGreaterThan(0);expect(section.sourceIds.length).toBeGreaterThan(0);for(const key of section.sourceIds)expect(GUIDE_RESEARCH.sources[key]).toBeDefined();}
  }
 });
 it('uses explicit review dates and safe source links rather than claiming continuous live validation',()=>{
  expect(Object.keys(GUIDE_RESEARCH.sources)).toHaveLength(74);
  for(const source of Object.values(GUIDE_RESEARCH.sources)){const url=new URL(source.url);expect(url.protocol).toBe('https:');expect(['wiki.torn.com','www.torn.com']).toContain(url.hostname);expect(source.checkedAt).toBe('2026-11-12');}
  for(const guide of PLAYER_GUIDES){const html=renderToStaticMarkup(<GuideResearch guideId={guide.id}/>);expect(html).toContain('not continuous monitoring');expect(html).toContain('editorial advice');for(const section of researchSections(guide.id))expect(html).toContain(`id="guide-${guide.id}-${section.slug}"`);}
 });
 it('marks named faction availability unverified and does not turn the old list into current recruitment promises',()=>{
  const sections=GUIDE_RESEARCH.guides['factions-new-players'].sections;expect(sections).toHaveLength(10);expect(sections.every(s=>s.status==='availability-unverified')).toBe(true);
  expect(renderToStaticMarkup(<GuideResearch guideId="factions-new-players"/>)).toContain('Current availability not verified');
 });
 it('adds all thirteen researched crime walkthrough notes and the corrected planning tables',()=>{
  expect(GUIDE_RESEARCH.guides.crimes2.extras?.filter(s=>s.slug.startsWith('crime-'))).toHaveLength(13);
  expect(GUIDE_RESEARCH.guides.crimes2.extras?.some(s=>s.slug==='crime-arson')).toBe(true);
  const html=renderToStaticMarkup(<GuideResearch guideId="after15"/>);expect(html).toContain('+1 / +2 / +3');expect(html).not.toContain('<td>+4</td>');
  expect(renderToStaticMarkup(<GuideResearch guideId="easter"/>)).toContain('activity-independent');
  expect(renderToStaticMarkup(<GuideResearch guideId="money-making"/>)).toContain('Illustrative example, not a price quote');
 });
 it('shows updated content by default, preserves the archive option, and searches the new advice',()=>{
  const html=renderToStaticMarkup(<PlayerGuides/>);expect(html).toContain('Updated edition');expect(html).toContain('Original archive');expect(html).toContain('Start with a plan');expect(html).not.toContain('class="guide-prose"');
  expect(findGuides('weekly ranked-war').map(g=>g.id)).toContain('money-making');
  expect(html).toContain('150 researched topics');expect(html).toContain('300 practical tips');
 });
});
