export type StockWindowExtreme={stock_id:number;open?:number;low:number;high:number;low_at:string;high_at:string;observed_points:number;first_observed_at:string};
export const stockWindowLabel=(minutes:number)=>minutes===43200?'30 days':minutes===10080?'7 days':minutes>=60?`${minutes/60} hr`:`${minutes} min`;
export function stockWindowPosition(current:number,range:StockWindowExtreme){
 if(![current,range.low,range.high].every(Number.isFinite)||current<=0||range.low<=0||range.high<range.low)return null;
 return {aboveLow:(current/range.low-1)*100,belowHigh:(1-current/range.high)*100,position:range.high===range.low?null:Math.max(0,Math.min(100,(current-range.low)/(range.high-range.low)*100))};
}
