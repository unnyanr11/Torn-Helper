import type { Choice } from '../lib/torn-choices';
import SelectEntry from './SelectEntry';
export default function ChoiceInput({label,value,onChange,options,required=false,disabled=false,inputMode,allowCustom=true}:{label:string;value:string;onChange:(v:string)=>void;options:Choice[];required?:boolean;disabled?:boolean;inputMode?:'numeric'|'text';allowCustom?:boolean}){
 return <div className="choice-field"><SelectEntry label={label} value={value} onChange={e=>onChange(e.target.value)} options={options} searchable={options.length>40} required={required} disabled={disabled} inputMode={inputMode} pattern={inputMode==='numeric'?'[0-9]+':undefined} allowCustom={allowCustom} emptyText={options.length?'Choose…':'No saved choices yet'}/>{!options.length&&<small>Load the relevant data group to populate choices, or enter a custom value.</small>}</div>;
}
