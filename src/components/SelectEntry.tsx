import { useId,useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { mergeChoices,numberChoices,type NumberKind } from '../lib/entry-options';
import { searchChoices } from '../lib/choice-search';
import type { Choice } from '../lib/torn-choices';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'|'value'|'defaultValue'|'children'> & {value:string|number;onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>void;label?:string;options?:Choice[];kind?:NumberKind;allowCustom?:boolean;emptyText?:string;searchable?:boolean};
/** Dropdown first; the original constrained input remains available for exact values. */
export default function SelectEntry({value,onChange,label,placeholder,options=[],kind,allowCustom=true,emptyText='Choose…',searchable=false,...input}:Props){
 const [custom,setCustom]=useState(false),[query,setQuery]=useState(''),id=useId(),text=String(value),title=label??input['aria-label']??placeholder??'Value';
 const choices=mergeChoices(options,kind?numberChoices(kind,input.min,input.max,input.step??(input.type==='number'?1:undefined)):[]),visible=searchChoices(choices,query),selected=choices.find(o=>o.value===text),shown=visible.some(o=>o.value===text);
 return <span className="choice-field entry-select" style={input.style}>
  <span id={id}>{title}</span>
  {searchable&&!custom&&<><span id={`${id}-search-label`}>Find an option (optional)</span><input id={`${id}-search`} aria-labelledby={`${id}-search-label`} className="nu-input" type="search" placeholder="Search by name or ID…" autoComplete="off" aria-controls={`${id}-options`} disabled={input.disabled} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/>{query&&<button type="button" className="choice-alternative" disabled={input.disabled} onClick={()=>setQuery('')}>Clear search</button>}<small id={`${id}-results`} role="status">{visible.length.toLocaleString()} matching options{!visible.length?(allowCustom?' · clear search or enter a custom value':' · clear search to show all options'):''}</small></>}
  <select id={`${id}-options`} aria-describedby={searchable&&!custom?`${id}-results`:undefined} className={input.className??'nu-input'} aria-labelledby={id} aria-label={input['aria-label']} disabled={input.disabled} required={input.required&&!custom} name={custom?undefined:input.name} value={custom?'__custom__':text} onChange={e=>{if(e.target.value==='__custom__')setCustom(true);else{setCustom(false);onChange(e);}}}>
   <option value="">{emptyText}</option>{text&&!shown&&<option value={text}>{selected?.label??text}{query?' · current selection':''}</option>}{visible.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}{allowCustom&&<option value="__custom__">Enter a custom value…</option>}
  </select>
  {custom&&<><input {...input} aria-label={`${title} · custom value`} placeholder={placeholder} value={value} onChange={onChange}/><button type="button" className="choice-alternative" disabled={input.disabled} onClick={()=>setCustom(false)}>Choose from options</button></>}
 </span>;
}
export type SelectEntryProps=Props;
