import type {PricePoint} from './stock-forecast';
type StockPoint=PricePoint&{source?:string};
export type StockBatch={provider_at:string|null;backfilled_stocks:number;stocks:Record<string,StockPoint[]>};
export type StockBatchResponse={provider_at:string|null;backfilled_stocks:number;stocks:Record<string,[number,number,string?][]>};
export function mergeStockBatch(previous:StockBatch|undefined,response:StockBatchResponse,full:boolean):StockBatch{
 const stocks={...(full?{}:previous?.stocks)};
 const cutoff=Date.parse(response.provider_at??'')/1000-7*86400;
 for(let id=1;id<=35;id++){
  const incoming=response.stocks[String(id)]??[];
  const points=new Map((stocks[id]??[]).map(p=>[p.timestamp,p]));
  for(const [timestamp,rawPrice,source] of incoming){
   const price=Number(rawPrice);
   if(Number.isInteger(timestamp)&&timestamp>cutoff&&Number.isFinite(price)&&price>0)points.set(timestamp,{timestamp,price,source});
  }
  stocks[id]=[...points.values()].filter(p=>p.timestamp>cutoff).sort((a,b)=>a.timestamp-b.timestamp);
 }
 return {...response,stocks};
}
