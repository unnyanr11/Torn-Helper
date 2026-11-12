import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {STOCKS} from '../data/stocks';
import {findStock,stockCatalogue,stockChoices,stockLabel} from '../lib/stock-catalogue';
import {parameterChoices} from '../lib/torn-choices';
import {observedChoices} from '../lib/entry-options';
import {relatedRequests,request} from '../lib/connected-data';
import TornDataView from '../components/TornDataView';

describe('stock names without additional API calls',()=>{
 it('includes all 35 verified identities, without snapshot prices or invented holdings',()=>{
  expect(STOCKS).toHaveLength(35);
  expect(new Set(STOCKS.map(s=>s.id)).size).toBe(35);
  expect(new Set(STOCKS.map(s=>s.acronym)).size).toBe(35);
  expect(STOCKS.every(s=>Object.keys(s).sort().join(',')==='acronym,id,name')).toBe(true);
  expect(findStock(24)?.acronym).toBe('MUN');
  expect(findStock(33)?.name).toBe('Herbal Releaf Co.');
  expect(findStock(34)?.acronym).toBe('LOS');
  expect(findStock(35)?.name).toBe('PointLess');
 });
 it('provides searchable names and tickers to manual and official lookup selectors immediately',()=>{
  const choices=stockChoices();
  expect(choices).toHaveLength(35);
  expect(choices.find(s=>s.value==='2')?.label).toBe('Torn City Investments (TCI) [2]');
  expect(observedChoices([],'stock')).toEqual(choices);
  expect(parameterChoices([],'/torn/{stockId}/stocks','stockId')).toEqual(choices);
 });
 it('resolves saved IDs, tickers and full names while preserving unknown saved values',()=>{
  for(const value of [2,'2','tci','Torn City Investments'])expect(stockLabel(value)).toBe('Torn City Investments (TCI)');
  expect(stockLabel("Big Al's Gun Shop")).toBe("Big Al's Gun Shop (BAG)");
  expect(stockLabel('999')).toBe('999');
  expect(stockLabel('Unlisted stock')).toBe('Unlisted stock');
 });
 it('prefers the newest cached official name and supports future IDs without importing prices',()=>{
  const rows=[
   {endpoint_id:'v2-torn-stocks',fetched_at:'2026-11-12T12:00:00Z',payload:{stocks:[{id:2,name:'Current name',acronym:'TCI',price:12},{id:36,name:'Future stock',acronym:'NEW'}]}},
   {endpoint_id:'v2-torn-stocks',fetched_at:'2026-11-11T12:00:00Z',payload:{stocks:[{id:2,name:'Old name',acronym:'TCI'}]}},
   {endpoint_id:'v2-user-stocks',payload:{stocks:[{id:2,name:'Not a reference name'}]}},
  ];
  expect(stockLabel(2,rows)).toBe('Current name (TCI)');
  expect(stockCatalogue(rows)).toHaveLength(36);
  expect(findStock(2,rows)).toEqual({id:2,name:'Current name',acronym:'TCI'});
  expect(stockLabel(36,rows)).toBe('Future stock (NEW)');
  expect(stockLabel(2,[{endpoint_id:'v2-torn-stocks',payload:{stocks:{2:{name:'Dictionary name'}}}}])).toBe('Dictionary name (TCI)');
 });
 it('names holdings and explicit stock IDs while leaving unrelated record and transaction IDs alone',()=>{
  const html=renderToStaticMarkup(<TornDataView value={{stocks:[{id:2,name:null,acronym:null,shares:25,transactions:[{id:24,shares:5}]}],stock_id:33,items:[{id:35}]}}/>);
  expect(html).toContain('Torn City Investments (TCI)');
  expect(html).toContain('Herbal Releaf Co. (CBD) [33]');
  expect(html).toContain('>TCI<');
  expect(html).not.toContain('Munster Beverage');
  expect(html).not.toContain('PointLess');
  expect(html).toContain('>24<');
  expect(renderToStaticMarkup(<TornDataView value={{stocks:[{id:999}]}}/>)).toContain('>999<');
 });
 it('labels related stock chart links from the actual returned holding ID',()=>{
  const links=relatedRequests(request('/user/stocks','Personal'),{stocks:[{id:2}]});
  expect(JSON.stringify(links)).toContain('Torn City Investments (TCI)');
 });
});
