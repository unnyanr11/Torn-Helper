import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { CAPABILITIES } from '../api/capabilities';
import { observedChoices,numberChoices,itemCategories,mergeChoices } from '../lib/entry-options';
import SelectEntry from '../components/SelectEntry';
import DataEntry from '../components/DataEntry';
import MultiChoiceEntry from '../components/MultiChoiceEntry';
vi.mock('../lib/supabase',()=>({supabase:{}}));
const row=(path:string,payload:unknown)=>({endpoint_id:CAPABILITIES.find(c=>c.path===path)!.id,payload});
describe('choices across all tool forms',()=>{
 it('uses observed identity fields without treating unrelated entity profiles as players',()=>{
  const data=[row('/user/{id}/profile',{profile:{id:12,name:'Player'}}),row('/faction/members',{members:[{id:12,name:'Player'},{id:13,name:'Member'}]}),row('/torn/items',{profile:{id:99,name:'Not a player'},items:[{id:1,name:'Item',type:'Medical'}]})];
  expect(observedChoices(data,'player')).toEqual([{value:'13',label:'Member [13]'},{value:'12',label:'Player [12]'}]);
  expect(observedChoices(data,'playerName').map(o=>o.value)).toEqual(['Member','Player']);
  expect(observedChoices([],'stock')).toEqual([]);
 });
 it('filters actual item options by category and preserves item IDs separately from names',()=>{
  const data=[row('/torn/items',{items:[{id:1,name:'First',type:'Medical'},{id:2,name:'Second',type:'Flower'}]})];
  expect(itemCategories(data).map(o=>o.value)).toEqual(['Flower','Medical']);
  expect(observedChoices(data,'item','Flower')).toEqual([{value:'2',label:'Second [2]'}]);
  expect(observedChoices(data,'itemName','Flower')).toEqual([{value:'Second',label:'Second'}]);
 });
 it('filters numeric presets against bounds and step without treating presets as observed data',()=>{
  expect(numberChoices('money',1,5000,1).map(o=>Number(o.value))).toEqual([100,500,1000,5000]);
  expect(numberChoices('percent',1,10,1).every(o=>Number.isInteger(Number(o.value)))).toBe(true);
  expect(numberChoices('count',3,3,1)).toEqual([{value:'3',label:'3'}]);
  expect(numberChoices('money',1,0)).toEqual([]);
 });
 it('preserves exact saved values absent from presets and respects disabled or closed choices',()=>{
  const html=renderToStaticMarkup(<SelectEntry label="Amount" value="123456.78" kind="money" type="number" min="1" step="0.01" onChange={()=>{}} disabled/>);
  expect(html).toContain('value="123456.78" selected');expect(html).toContain('disabled');expect(html).toContain('Enter a custom value');expect(html).not.toContain('<input');
  const closed=renderToStaticMarkup(<SelectEntry label="Priority" value="1" options={[{value:'1',label:'First'}]} onChange={()=>{}} allowCustom={false}/>);
  expect(closed).not.toContain('custom value');
  expect(mergeChoices([{value:'1',label:'Newest'}],[{value:'1',label:'Older'}])).toEqual([{value:'1',label:'Newest'}]);
 });
 it('renders category selectors and empty-data fallback without inventing game records',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><DataEntry source="item" label="Item" value="" onChange={()=>{}}/></QueryClientProvider>);
  expect(html).toContain('Item category');expect(html).toContain('No collected choices yet');expect(html).toContain('custom value');expect(html).not.toContain('Xanax');
 });
 it('retains all existing multi-target IDs, including IDs not present in the catalogue',()=>{
  const html=renderToStaticMarkup(<MultiChoiceEntry label="Targets" value="12,13,12" onChange={()=>{}} options={[{value:'12',label:'Known [12]'}]}/>);
  expect(html).toContain('Known [12]');expect(html).toContain('13');expect(html.match(/>Remove<\/button>/g)).toHaveLength(2);expect(html).toContain('Add selected targets');
 });
});
