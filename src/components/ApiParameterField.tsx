import type { Capability } from '../api/types';
import type { Choice } from '../lib/torn-choices';
import ChoiceInput from './ChoiceInput';
type Parameter=Capability['parameters'][number];
export default function ApiParameterField({parameter,value,onChange,choices}:{parameter:Parameter;value:string;onChange:(v:string)=>void;choices:Choice[]}){
 const schema=parameter.schema,label=parameter.name+(parameter.required?' (required)':' (optional)');
 const options=schema.enum??(schema.type==='array'?schema.items?.enum:undefined);
 if(Array.isArray(options)||schema.type==='boolean'){
  const list=Array.isArray(options)?options:[true,false];const multiple=schema.type==='array';
  return <label>{label}<select className="nu-input" required={parameter.required} multiple={multiple} value={multiple?value.split(',').filter(Boolean):value} onChange={e=>onChange(multiple?Array.from(e.target.selectedOptions).map(o=>o.value).join(','):e.target.value)}>{!multiple&&<option value="">Choose…</option>}{list.map((o:string|number|boolean)=><option key={String(o)} value={String(o)}>{typeof o==='boolean'?(o?'Yes':'No'):String(o)}</option>)}</select>{multiple&&<small>Select one or more options.</small>}</label>;
 }
 if(parameter.name==='limit'){
  const max=Number(schema.maximum??100),min=Number(schema.minimum??1),limits=[...new Set([10,20,50,100,250,500,1000,max].filter(n=>n>=min&&n<=max))].sort((a,b)=>a-b);
  return <label>{label}<select className="nu-input" value={value} onChange={e=>onChange(e.target.value)}><option value="">Default</option>{value&&!limits.includes(Number(value))&&<option value={value}>{value}</option>}{limits.map(n=><option key={n} value={n}>{n} records</option>)}</select></label>;
 }
 if(['from','to','timestamp'].includes(parameter.name)&&schema.type==='integer'){
  const n=Number(value),valid=value&&Number.isFinite(n)&&n>0&&n<8640000000000;
  return <label>{label} · UTC<input className="nu-input" type="datetime-local" value={valid?new Date(n*1000).toISOString().slice(0,16):''} required={parameter.required} onChange={e=>onChange(e.target.value?String(Math.floor(Date.parse(e.target.value+'Z')/1000)):'')}/></label>;
 }
 if(parameter.location==='path'||choices.length)return <ChoiceInput label={label} value={value} onChange={onChange} options={choices} required={parameter.required} inputMode={schema.type==='integer'?'numeric':'text'}/>;
 return <label>{label}<input className="nu-input" type={['integer','number'].includes(schema.type)?'number':'text'} step={schema.type==='integer'?1:'any'} min={schema.minimum} max={schema.maximum} required={parameter.required} maxLength={1024} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
