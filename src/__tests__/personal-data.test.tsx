import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TornDataView from '../components/TornDataView';
import { PERSONAL_REQUESTS, PERSONAL_SECTIONS, observationKey, numericChange } from '../lib/personal-data';
describe('complete personal dashboard collection', () => {
  it('includes every self dataset, resolves required list categories, and explicitly requests all personal stats', () => {
    expect(PERSONAL_REQUESTS.find(r => r.capability.path === '/user/personalstats')?.parameters).toEqual({ cat: 'all' });
    for (const path of ['/user/profile', '/user/bars', '/user/battlestats', '/user/workstats', '/user/money', '/user/inventory', '/user/networth', '/user/skills', '/user/log', '/user/messages']) expect(PERSONAL_REQUESTS.some(r => r.capability.path === path)).toBe(true);
    expect(PERSONAL_REQUESTS.filter(r => r.capability.path === '/user/list').map(r => r.parameters.cat)).toEqual(['Friends', 'Enemies', 'Targets']);
    expect(PERSONAL_REQUESTS.length).toBe(PERSONAL_SECTIONS.length + 2);
    for (const request of PERSONAL_REQUESTS) {
      expect(request.capability.path).not.toContain('{');
      for (const parameter of request.capability.parameters.filter(p => p.required && ['path', 'query'].includes(p.location))) expect(request.parameters[parameter.name]).toBeTruthy();
    }
  });
  it('uses stable observation identities without merging distinct filters', () => {
    expect(observationKey('list', { cat: 'Friends', limit: '10' })).toBe(observationKey('list', { limit: '10', cat: 'Friends' }));
    expect(observationKey('list', { cat: 'Enemies' })).not.toBe(observationKey('list', { cat: 'Friends' }));
  });
});
describe('rich official observations', () => {
  it('renders real values and bars without JSON or invented null/boolean values', () => {
    const html = renderToStaticMarkup(<TornDataView value={{ profile: { name: 'Unnyan', level: 12, spouse: null, revivable: true, life: { current: 546, maximum: 546 } } }}/>);
    expect(html).toContain('Unnyan'); expect(html).toContain('546 / 546'); expect(html).toContain('<progress');
    expect(html).toContain('Not provided'); expect(html).toContain('Yes'); expect(html).not.toContain('<pre');
  });
  it('only reports changes for two real finite numeric observations', () => {
    expect(numericChange(0, 2)).toBe(-2); expect(numericChange(200, undefined)).toBeNull(); expect(numericChange(200, null)).toBeNull(); expect(numericChange(Infinity, 2)).toBeNull();
    const html = renderToStaticMarkup(<TornDataView value={{ strength: 40 }} previous={{ strength: 30 }}/>);
    expect(html).toContain('+10'); expect(html).toContain('since previous observation');
  });
  it('treats API content as text and makes long record sets explicitly pageable', () => {
    const html = renderToStaticMarkup(<TornDataView value={Array.from({length: 30}, (_, i) => ({ id: i, name: '<script>unsafe()</script>' }))}/>);
    expect(html).not.toContain('<script>'); expect(html).not.toContain('dangerouslySetInnerHTML');
    expect(html).toContain('30 records'); expect(html).toContain('5 remaining');
    expect(renderToStaticMarkup(<TornDataView value={[]}/>)).toContain('No records returned');
  });
});
