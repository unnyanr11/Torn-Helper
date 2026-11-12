import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import GuideArticle from '../components/GuideArticle';
import PlayerGuides from '../pages/PlayerGuides';
import {PLAYER_GUIDES,GUIDE_SOURCE,guideHeadings,guideRoute,guideLocation,guideUrl,findGuides} from '../lib/player-guides';
import {NAV} from '../nav';
import {NAV_GROUPS} from '../lib/navigation';
const intro=PLAYER_GUIDES.find(g=>g.id==='introduction')!;
describe('imported player guides',()=>{
 it('contains all ten published guide pages with source provenance and no empty placeholders',()=>{
  expect(PLAYER_GUIDES).toHaveLength(10);expect(new Set(PLAYER_GUIDES.map(g=>g.id)).size).toBe(10);
  expect(GUIDE_SOURCE.commit).toBe('57508e9479cc412fb519ab3879d218c937f76ec3');
  for(const guide of PLAYER_GUIDES){expect(guide.body.length).toBeGreaterThan(200);expect(guide.body).not.toMatch(/\{\{[<%]|^title:/m);expect(guide.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);expect(renderToStaticMarkup(<GuideArticle guide={guide}/>)).toContain('<');}
  expect(PLAYER_GUIDES.some(g=>g.id==='coming-soooon')).toBe(false);
 });
 it('finds full-text topics and respects category filters',()=>{
  expect(findGuides('ghost trades').map(g=>g.id)).toContain('money-storage');
  expect(findGuides('','Getting started')).toHaveLength(4);
  expect(findGuides('unlikely phrase xyzzz')).toEqual([]);
 });
 it('resolves guide links and section anchors within the app',()=>{
  expect(guideLocation(guideRoute('level15','levelling-targets'))).toMatchObject({guide:{id:'level15'},section:'levelling-targets'});
  expect(guideLocation('#Player%20Guides?guide=unknown').guide.id).toBe(intro.id);
  expect(guideUrl('../../misc-guides/money-storage',intro)).toBe(guideRoute('money-storage'));
  expect(guideUrl('#welcome',intro)).toBe(guideRoute(intro.id,'welcome'));
  for(const guide of PLAYER_GUIDES){const headings=guideHeadings(guide);expect(new Set(headings.map(h=>h.id)).size).toBe(headings.length);const html=renderToStaticMarkup(<GuideArticle guide={guide}/>);for(const heading of headings)expect(html).toContain(`id="${heading.id}"`);}
 });
 it('does not execute embedded HTML, load remote images or allow executable links',()=>{
  const guide={...intro,body:'<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![remote](https://example.com/tracker.png)\n\n[good](https://www.torn.com/rules.php)'};
  const html=renderToStaticMarkup(<GuideArticle guide={guide}/>);
  expect(html).not.toContain('<script');expect(html).not.toContain('href="javascript:');expect(html).not.toContain('<img');
  expect(html).toContain('View illustration');expect(html).toContain('rel="noopener noreferrer"');
  for(const url of ['javascript:alert(1)','data:text/html,hello','vbscript:evil','https://user:password@example.com','\u0000javascript:evil'])expect(guideUrl(url,intro)).toBe('');
  expect(guideUrl('ghost-trade/sidebar-top.png',intro,true)).toContain(`/57508e9479cc412fb519ab3879d218c937f76ec3/static/ghost-trade/sidebar-top.png`);
 });
 it('makes guides discoverable and labels old content as reference material',()=>{
  expect(NAV).toContain('Player Guides');expect(NAV_GROUPS.Explore).toContain('Player Guides');
  const html=renderToStaticMarkup(<PlayerGuides/>);
  expect(html).toContain('not live game data');expect(html).toContain('Research checked:');expect(html).toContain('Search guides');expect(html).toContain('10 of 10 guides');expect(html).toContain('Use Torn Helper tools');
 });
});
