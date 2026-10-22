import type { Choice } from './torn-choices';
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
export function searchChoices(options:Choice[],query:string):Choice[]{
 const terms=normalize(query).split(/\s+/).filter(Boolean);if(!terms.length)return options;
 return options.filter(option=>{const text=normalize(`${option.label} ${option.value}`);return terms.every(term=>text.includes(term));});
}
