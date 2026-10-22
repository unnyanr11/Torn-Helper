import { useState } from 'react';
import { useTornChoices } from '../hooks/useTornChoices';
import { itemCategories,observedChoices,mergeChoices,type EntrySource } from '../lib/entry-options';
import SelectEntry, { type SelectEntryProps } from './SelectEntry';
export default function DataEntry({source,onNameChange,...props}:SelectEntryProps&{source:EntrySource;onNameChange?:(name:string)=>void}){
 const cache=useTornChoices(),[category,setCategory]=useState('');
 const options=mergeChoices(observedChoices(cache.data??[],source,category),category&&isItemSource(source)?[]:props.options??[]),categories=itemCategories(cache.data??[]),isItem=source==='item'||source==='itemName';
 return <span className="choice-field">
  {isItem&&<label>Item category<select className="nu-input" disabled={props.disabled} value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
  <SelectEntry {...props} options={options} onChange={e=>{if(onNameChange){const selected=options.find(o=>o.value===e.target.value);onNameChange(selected&&selected.label!==selected.value?selected.label.replace(/ \[\d+\]$/,''):'');}props.onChange(e);}}/>
  {!options.length&&<small>{cache.isError?'Saved choices could not be loaded. You can enter a custom value.':'No collected choices yet. Load the related data in Overview, or choose a custom value.'}</small>}
 </span>;
}

const isItemSource=(source:EntrySource)=>source==='item'||source==='itemName';
