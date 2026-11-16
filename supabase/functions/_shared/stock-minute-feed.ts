import {STOCKS} from '../../../src/data/stocks.ts';
export type MinutePoint={stock_id:number;timestamp:number;price:number;total_shares:number|null};
const obj=(v:unknown):Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
function price(value:unknown){
 if(!(typeof value==='number'||typeof value==='string'&&/^\d+(\.\d{1,6})?$/.test(value)))throw new Error('Invalid price');
 const n=Number(value);if(!Number.isFinite(n)||n<=0||n>=1e12)throw new Error('Invalid price');return n;
}
function shares(value:unknown){if(value===null||value===undefined)return null;if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('Invalid shares');return Number(value);}
export function watchlistMinutes(payload:unknown,now:number):{timestamp:number;points:MinutePoint[]}{
 const p=obj(payload),ts=p.timestamp;
 if(!Number.isInteger(ts)||ts%60!==0||ts<now-180||ts>now+30||!Array.isArray(p.data))throw new Error('Stale or invalid stock feed');
 const known=new Map(STOCKS.map(s=>[s.acronym,s.id])),points:MinutePoint[]=[];const seen=new Set<number>();
 for(const row of p.data){const r=obj(row);if(r.index||!known.has(r.stock))continue;const id=known.get(r.stock)!;
  if(seen.has(id))throw new Error('Duplicate stock');seen.add(id);points.push({stock_id:id,timestamp:ts,price:price(r.price),total_shares:shares(r.total_shares)});
 }
 if(points.length!==35)throw new Error('Incomplete stock feed');return {timestamp:ts,points};
}
export function historyMinutes(payload:unknown,stockId:number,latest:number):MinutePoint[]{
 const p=obj(payload);if(!Array.isArray(p.data)||p.data.length>2000)throw new Error('Invalid history');
 const points=new Map<number,MinutePoint>();
 for(const row of p.data){if(!Array.isArray(row)||!Number.isInteger(row[0])||row[0]%60!==0||row[0]>latest||row[0]<latest-30*86400)throw new Error('Invalid historical timestamp');
  const point={stock_id:stockId,timestamp:row[0],price:price(row[1]),total_shares:shares(row[2])};
  if(points.has(point.timestamp))throw new Error('Duplicate historical timestamp');points.set(point.timestamp,point);
 }
 return [...points.values()].sort((a,b)=>a.timestamp-b.timestamp);
}
export async function boundedStockJson(url:string,fetcher:typeof fetch=fetch):Promise<unknown>{
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok||!response.body)throw new Error('Stock provider unavailable');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>512*1024){await reader.cancel();throw new Error('Stock response too large');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
