import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAPABILITIES } from '../api/capabilities';
import { catalogueChoices,parameterChoices } from '../lib/torn-choices';
import { canAccessPage } from '../lib/access';
import ChoiceInput from '../components/ChoiceInput';
import ApiParameterField from '../components/ApiParameterField';
const id=(path:string)=>CAPABILITIES.find(c=>c.path===path)!.id;
describe('dropdown-first standalone UX',()=>{
 it('uses actual cached catalogues, merging available categories and removing duplicates',()=>{
  const rows=[{endpoint_id:id('/torn/items'),payload:{items:[{id:2,name:'Second'},{id:2,name:'Second'}]}},{endpoint_id:id('/torn/items'),payload:{items:[{id:1,name:'First'}]}}];
  expect(catalogueChoices(rows,'/torn/items','items')).toEqual([{value:'1',label:'First [1]'},{value:'2',label:'Second [2]'}]);
  expect(parameterChoices(rows,'/market/{id}/itemmarket','id')).toHaveLength(2);
  expect(catalogueChoices([],'/racing/cars','cars')).toEqual([]);
 });
 it('shows known choices first while preserving stored custom values and manual entry',()=>{
  const html=renderToStaticMarkup(<ChoiceInput label="Player" value="99" onChange={()=>{}} options={[{value:'1',label:'Known player'}]}/>);
  expect(html).toContain('<select');expect(html).toContain('Known player');expect(html).toContain('value="99" selected');expect(html).toContain('Enter a different value');expect(html).not.toContain('<input');
 });
 it('renders documented boolean and array enum selections without comma-separated typing',()=>{
  const parameter=(schema:any)=>({name:'selection',location:'query',required:false,description:'',schema});
  const bool=renderToStaticMarkup(<ApiParameterField parameter={parameter({type:'boolean'})} value="true" onChange={()=>{}} choices={[]}/>);
  expect(bool).toContain('Yes');expect(bool).toContain('No');expect(bool).not.toContain('<input');
  const array=renderToStaticMarkup(<ApiParameterField parameter={parameter({type:'array',items:{enum:['alpha','beta']}})} value="alpha" onChange={()=>{}} choices={[]}/>);
  expect(array).toContain('multiple');expect(array).toContain('value="alpha" selected');
 });
 it('offers bounded page sizes and date pickers, offering numeric presets with custom entry',()=>{
  const field=(name:string,schema:any)=>renderToStaticMarkup(<ApiParameterField parameter={{name,location:'query',required:false,description:'',schema}} value="" onChange={()=>{}} choices={[]}/>);
  expect(field('limit',{type:'integer',maximum:50})).toContain('50 records');expect(field('limit',{type:'integer',maximum:50})).not.toContain('100 records');
  expect(field('from',{type:'integer'})).toContain('type="datetime-local"');
  expect(field('offset',{type:'integer',minimum:0})).toContain('<select');expect(field('offset',{type:'integer',minimum:0})).toContain('Enter a custom value');
 });
 it('blocks optional external integrations and competitor pages even by direct navigation',()=>{
  for(const page of ['Discord','TornStats','Competitor Matrix','AI Settings','AI War Analyzer','Assistant'])expect(canAccessPage(page,true,'admin')).toBe(false);
  expect(canAccessPage('Overview',true,'user')).toBe(true);
 });
});
