import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileTornRequest } from '../../supabase/functions/_shared/torn-data';
import { AREAS, CONNECTED_REQUESTS, browserLink, inventoryEstimate, mergeRequests, relatedRequests, request, restoreRequest, type ConnectedRequest } from '../lib/connected-data';
import { collectConnected, type SectionResult } from '../lib/connected-collection';
import { observationKey, type TornObservation } from '../lib/personal-data';
import TornDataView from '../components/TornDataView';
const observed = (r: ConnectedRequest, payload: unknown): TornObservation => ({ endpoint_id: r.capability.id, parameters: r.parameters, payload, fetched_at: '2026-10-22T00:00:00Z', next_parameters: null });
describe('connected Torn groups', () => {
  it('connects every promised area with documented, fully validated requests', () => {
    for (const area of AREAS) expect(CONNECTED_REQUESTS.some(r => r.areas.includes(area))).toBe(true);
    for (const r of CONNECTED_REQUESTS) expect(() => compileTornRequest(r.capability.id,r.parameters)).not.toThrow();
    expect(mergeRequests([...CONNECTED_REQUESTS,...CONNECTED_REQUESTS])).toHaveLength(CONNECTED_REQUESTS.length);
  });
  it('builds supported lookups from actual returned IDs and preserves source filters in links', () => {
    const cases: [string,unknown][] = [
      ['/torn/crimes',{crimes:[{id:3,name:'Crime'}]}], ['/user/inventory',{inventory:{items:[{id:1,name:'Item'}]}}],
      ['/user/stocks',{stocks:[{id:2}]}], ['/torn/properties',{properties:[{id:4}]}], ['/user/properties',{properties:[{id:5}]}],
      ['/user/races',{races:[{id:6}]}], ['/racing/tracks',{tracks:[{id:7}]}], ['/faction/chains',{chains:[{id:8}]}],
      ['/faction/rankedwars',{rankedwars:[{id:9}]}], ['/faction/crimes',{crimes:[{id:10}]}], ['/user/attacks',{attacks:[{id:11,code:'abc123'}]}],
    ];
    for (const [path,payload] of cases) {
      const related = relatedRequests(request(path,'Personal'),payload); expect(related.length).toBeGreaterThan(0);
      for (const r of related) {
        expect(() => compileTornRequest(r.capability.id,r.parameters)).not.toThrow();
        const params = new URLSearchParams(browserLink(r).split('?')[1]);
        expect(params.get('section')).toBe(r.capability.id);
        for (const [k,v] of Object.entries(r.parameters)) expect(params.get(k)).toBe(v);
        expect(restoreRequest(r.capability.id,r.parameters)).not.toBeNull();
      }
    }
    expect(relatedRequests(request('/torn/crimes','Crimes'),{crimes:[{id:'https://evil.test'},{id:-1},{id:1.2}]})).toEqual([]);
  });
  it('estimates only returned, priced, personally owned inventory without treating unknowns as zero', () => {
    expect(inventoryEstimate({},{}).value).toBeNull();
    const result = inventoryEstimate({inventory:{items:[{id:1,amount:2,faction_owned:false},{id:2,amount:10,faction_owned:true},{id:3,amount:1}]}},{items:[{id:1,value:{market_price:50}},{id:2,value:{market_price:100}}]});
    expect(result).toEqual({value:100,priced:1,total:3});
  });
  it('renders returned stock price history as a dated chart', () => {
    const html=renderToStaticMarkup(<TornDataView value={[{timestamp:1792627200,price:100},{timestamp:1792713600,price:105}]}/>);
    expect(html).toContain('Stock prices by returned observation time'); expect(html).toContain('2 observations');
  });
});
describe('bounded, cancellable connected collection', () => {
  const setup = (fetch: (r: ConnectedRequest)=>Promise<SectionResult>, controller=new AbortController()) => ({ requests:[request('/torn/crimes','Crimes')], areas:['Crimes'], signal:controller.signal, fetch, pause:vi.fn(async()=>{}), onResult:vi.fn(), onDiscover:vi.fn(), onProgress:vi.fn() });
  it('discovers crime statistics and actions, deduplicates them and spaces requests', async () => {
    const options=setup(async r => ({observation: observed(r,r.capability.path==='/torn/crimes'?{crimes:[{id:1},{id:1}]}:{})}));
    const result=await collectConnected(options);
    expect(result.done).toBe(3); expect(options.pause).toHaveBeenCalledTimes(2);
    expect(options.pause).toHaveBeenCalledWith(3400,options.signal);
  });
  it('waits and retries a quota failure once, but stops on invalid identity', async () => {
    let call=0;
    const options=setup(async r=> ++call===1 ? {status:429,error:'Quota'} : {observation:observed(r,{})});
    expect((await collectConnected(options)).done).toBe(1); expect(options.pause).toHaveBeenCalledWith(65000,options.signal);
    const invalid=setup(async()=>({status:401,error:'Invalid key'}));
    await expect(collectConnected(invalid)).rejects.toThrow('Invalid key'); expect(invalid.onResult).toHaveBeenCalledTimes(1);
  });
  it('continues past per-section permission denial and stops without displaying late results', async () => {
    const options=setup(async()=>({status:403,error:'Missing permission'}));
    expect((await collectConnected(options)).done).toBe(1);
    const controller=new AbortController(); const cancelled=setup(async r=>{controller.abort();return {observation:observed(r,{})};},controller);
    expect((await collectConnected(cancelled)).stopped).toBe(true); expect(cancelled.onResult).not.toHaveBeenCalled();
  });
  it('limits automatic expansion while retaining all related lookups', async () => {
    const options=setup(async r=>({observation:observed(r,r.capability.path==='/torn/crimes'?{crimes:Array.from({length:100},(_,i)=>({id:i+1}))}:{})}));
    const result=await collectConnected(options);
    expect(result.done).toBe(101); expect(options.onDiscover.mock.calls[0][0]).toHaveLength(200);
  });
});
