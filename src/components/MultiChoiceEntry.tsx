import { useState } from 'react';
import type { Choice } from '../lib/torn-choices';
import SelectEntry from './SelectEntry';
export default function MultiChoiceEntry({label,value,onChange,options,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;options:Choice[];disabled?:boolean}){
 const [candidate,setCandidate]=useState(''),[error,setError]=useState('');
 const selected=[...new Set(value.split(/[\s,]+/).filter(Boolean))];
 function add(){const ids=candidate.split(/[\s,]+/).filter(Boolean);if(!ids.length||ids.some(id=>!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))){setError('Choose a player or enter valid positive IDs separated by commas.');return;}onChange([...new Set([...selected,...ids])].join(','));setCandidate('');setError('');}
 return <div className="choice-field"><SelectEntry searchable={options.length>40} label={label} value={candidate} onChange={e=>setCandidate(e.target.value)} options={options.filter(o=>!selected.includes(o.value))} disabled={disabled} placeholder="Player IDs, separated by commas"/><button type="button" className="nu-btn" disabled={disabled||!candidate.trim()} onClick={add}>Add selected targets</button>{error&&<p role="alert">{error}</p>}<ul>{selected.map(id=><li key={id}>{options.find(o=>o.value===id)?.label??id} <button type="button" className="nu-btn" disabled={disabled} onClick={()=>onChange(selected.filter(v=>v!==id).join(','))}>Remove</button></li>)}</ul></div>;
}
