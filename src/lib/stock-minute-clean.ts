import type {PricePoint} from './stock-forecast.ts';
/** Fill internal missing minutes only. Surrounding real observations determine
 * the mean; a fill becomes available only when its right neighbour is observed. */
export function fillMissingStockMinutes(input:PricePoint[]):PricePoint[]{
 let actual=[...new Map(input.filter(p=>!p.estimated&&Number.isInteger(p.timestamp)&&p.timestamp%60===0&&Number.isFinite(p.price)&&p.price>0).map(p=>[p.timestamp,p])).values()].sort((a,b)=>a.timestamp-b.timestamp);
 const cutoff=(actual.at(-1)?.timestamp??0)-7*86400;
 actual=actual.filter(p=>p.timestamp>cutoff);
 const result:PricePoint[]=[];
 for(let i=0;i<actual.length;i++){
  const left=actual[i-1],right=actual[i];
  if(left)for(let timestamp=left.timestamp+60;timestamp<right.timestamp;timestamp+=60)
   result.push({timestamp,price:(left.price+right.price)/2,estimated:true,availableAt:right.timestamp});
  result.push(right);
 }
 return result;
}
