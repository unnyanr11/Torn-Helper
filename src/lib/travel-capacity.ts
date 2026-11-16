import type {FlyMethod} from './travel-profit';

// Torn Wiki Travel, checked 2026-11-16. Method and category change the result.
export function travelCapacity(payload:unknown,method:FlyMethod,itemType:string,tourism=false){
 const root=payload as Record<string,unknown>|null;
 const perks=(root?.perks??root) as Record<string,unknown>|null;
 if(!perks||typeof perks!=='object')return null;
 const groups=Object.entries(perks).filter(([name,values])=>Array.isArray(values)&&/perk|job|property|stock|merit|education|enhancer|company|faction|book/i.test(name));
 if(!groups.length)return null;
 let general=method==='Standard'?10:15,category=0;
 const applied:string[]=[];
 for(const [,values] of groups){
  for(const value of values as unknown[]){
   if(typeof value!=='string')continue;
   const amount=value.match(/\+\s*(\d+)\s*(?:travel items?|flowers?|plushies?|plushie)/i);
   if(!amount)continue;
   const bonus=Number(amount[1]);
   if(/flower|plush/i.test(value)){
    if((/flower/i.test(value)&&/flower/i.test(itemType))||(/plush/i.test(value)&&/plush/i.test(itemType))){category+=bonus;applied.push(value);}
   }else{general+=bonus;applied.push(value);}
  }
 }
 const capacity=general*(tourism?2:1)+category;
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>100)return null;
 return {capacity,applied};
}
