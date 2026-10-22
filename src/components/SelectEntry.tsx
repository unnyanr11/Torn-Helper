import { useId,useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { mergeChoices,numberChoices,type NumberKind } from '../lib/entry-options';
import type { Choice } from '../lib/torn-choices';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'|'value'|'defaultValue'|'children'> & {value:string|number;onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>void;label?:string;options?:Choice[];kind?:NumberKind;allowCustom?:boolean;emptyText?:string};
/** Dropdown first; the original constrained input remains available for exact values. */
export default function SelectEntry({value,onChange,label,placeholder,options=[],kind,allowCustom=true,emptyText='Choose…',...input}:Props){
 const [custom,setCustom]=useState(false),id=useId(),text=String(value),title=label??input['aria-label']??placeholder??'Value';
 const choices=mergeChoices(options,kind?numberChoices(kind,input.min,input.max,input.step??(input.type==='number'?1:undefined)):[]),known=choices.some(o=>o.value===text);
 return <span className="choice-field entry-select" style={input.style}>
  <span id={id}>{title}</span>
  <select className={input.className??'nu-input'} aria-labelledby={id} aria-label={input['aria-label']} disabled={input.disabled} required={input.required&&!custom} name={custom?undefined:input.name} value={custom?'__custom__':text} onChange={e=>{if(e.target.value==='__custom__')setCustom(true);else{setCustom(false);onChange(e);}}}>
   <option value="">{emptyText}</option>{text&&!known&&<option value={text}>{text}</option>}{choices.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}{allowCustom&&<option value="__custom__">Enter a custom value…</option>}
  </select>
  {custom&&<><input {...input} aria-label={`${title} · custom value`} placeholder={placeholder} value={value} onChange={onChange}/><button type="button" className="choice-alternative" disabled={input.disabled} onClick={()=>setCustom(false)}>Choose from options</button></>}
 </span>;
}
export type SelectEntryProps=Props;
