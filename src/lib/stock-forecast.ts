/** Small, deterministic ridge-regression model. No network, credentials or trades. */
export const SELL_FEE = 0.001;
export const MIN_HISTORY = 80;
export const HISTORY_ENDPOINT = 'v2-torn-{stockId}-stocks';
export type PricePoint = {timestamp:number;price:number};
export type StockForecast = {
 points:PricePoint[]; issue?:string; cadence:number; last:PricePoint|null;
 predictedReturn:number; predictedPrice:number; lower:number; upper:number;
 tests:number; mae:number; baselineMae:number; directionAccuracy:number;
 supported:boolean; targetTime:number;
 validation:{timestamp:number;predictedReturn:number;actualReturn:number}[];
};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/(v.length||1);
const quantile=(values:number[],q:number)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1)]??0;};
/** Only official chart prices are training data. Performance summaries and quotes are not history. */
export function stockHistory(payload:unknown,stockId:number,now=Date.now()/1000):PricePoint[]{
 const stocks=object(payload).stocks;
 const stock=Array.isArray(stocks)?stocks.find(s=>object(s).id===stockId):stocks;
 if(object(stock).id!==stockId)return [];
 const history=object(object(stock).chart).history;
 const unique=new Map<number,number>();
 for(const entry of Array.isArray(history)?history:[]){
  const {timestamp,price}=object(entry);
  if(typeof timestamp==='number'&&Number.isInteger(timestamp)&&timestamp>1e9&&timestamp<=now+60&&typeof price==='number'&&Number.isFinite(price)&&price>0)unique.set(timestamp,price);
 }
 return [...unique].map(([timestamp,price])=>({timestamp,price})).sort((a,b)=>a.timestamp-b.timestamp).slice(-600);
}
type Sample={x:number[];y:number};
function features(prices:number[],i:number):number[]{
 const returns=prices.slice(i-12,i+1).slice(1).map((p,j)=>p/prices[i-12+j]-1);
 const average=mean(returns),volatility=Math.sqrt(mean(returns.map(r=>(r-average)**2)));
 return [returns[11],mean(returns.slice(-3)),average,volatility,prices[i]/mean(prices.slice(i-11,i+1))-1];
}
/** Standardization is fitted only on this training window; intercept is not penalized. */
function fitPredict(train:Sample[],input:number[]):number{
 const dimensions=input.length,means=input.map((_,j)=>mean(train.map(r=>r.x[j])));
 const scales=means.map((m,j)=>Math.sqrt(mean(train.map(r=>(r.x[j]-m)**2)))||1);
 const transform=(x:number[])=>[1,...x.map((v,j)=>(v-means[j])/scales[j])];
 const size=dimensions+1,matrix=Array.from({length:size},()=>Array(size+1).fill(0) as number[]);
 for(const row of train){const x=transform(row.x);for(let j=0;j<size;j++){for(let k=0;k<size;k++)matrix[j][k]+=x[j]*x[k];matrix[j][size]+=x[j]*row.y;}}
 for(let j=1;j<size;j++)matrix[j][j]+=1; // Fixed L2 penalty, never selected using the test set.
 for(let j=0;j<size;j++){
  let pivot=j;for(let k=j+1;k<size;k++)if(Math.abs(matrix[k][j])>Math.abs(matrix[pivot][j]))pivot=k;
  [matrix[j],matrix[pivot]]=[matrix[pivot],matrix[j]];
  const divisor=matrix[j][j];if(Math.abs(divisor)<1e-12)return 0;
  for(let k=j;k<=size;k++)matrix[j][k]/=divisor;
  for(let row=0;row<size;row++)if(row!==j){const factor=matrix[row][j];for(let k=j;k<=size;k++)matrix[row][k]-=factor*matrix[j][k];}
 }
 return transform(input).reduce((total,v,j)=>total+v*matrix[j][size],0);
}
export function forecastStock(input:PricePoint[]):StockForecast{
 const points=input.slice(-600),last=points[points.length-1]??null;
 const empty=(issue:string,cadence=0):StockForecast=>({points,issue,cadence,last,predictedReturn:0,predictedPrice:0,lower:0,upper:0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,targetTime:0,validation:[]});
 if(points.some((p,i)=>!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.timestamp)||(i>0&&p.timestamp<=points[i-1].timestamp)))return empty('Price history is invalid. Load a fresh chart.');
 if(points.length<MIN_HISTORY)return empty(`Need at least ${MIN_HISTORY} valid chart observations; ${points.length} collected.`);
 const gaps=points.slice(1).map((p,i)=>p.timestamp-points[i].timestamp),cadence=quantile(gaps,.5);
 if(cadence<60||gaps.some(g=>Math.abs(g-cadence)>Math.max(1,cadence*.1)))return empty('Chart intervals are uneven. Wait for consistent history; missing prices are never invented.',cadence);
 const prices=points.map(p=>p.price),samples:Sample[]=[];
 for(let i=12;i<prices.length-1;i++)samples.push({x:features(prices,i),y:prices[i+1]/prices[i]-1});
 const count=Math.min(40,Math.floor(samples.length*.3)),start=samples.length-count;
 const errors:number[]=[],baseline:number[]=[],validation:StockForecast['validation']=[];let correct=0;
 // Expanding walk-forward evaluation: each target is unseen when its prediction is made.
 for(let i=start;i<samples.length;i++){
  const predicted=fitPredict(samples.slice(0,i),samples[i].x),actual=samples[i].y;
  errors.push(Math.abs(predicted-actual));baseline.push(Math.abs(actual));
  validation.push({timestamp:points[i+13].timestamp,predictedReturn:predicted,actualReturn:actual});
  if(Math.abs(actual)>1e-10&&Math.sign(predicted)===Math.sign(actual))correct++;
 }
 const predictedReturn=fitPredict(samples,features(prices,prices.length-1)),margin=Math.max(quantile(errors,.9),1e-8);
 if(!Number.isFinite(predictedReturn)||Math.abs(predictedReturn)>=.2)return empty('Model output is unstable. Wait for more reliable history.',cadence);
 const mae=mean(errors),baselineMae=mean(baseline),directionAccuracy=correct/count;
 const supported=count>=20&&mae<baselineMae*.95&&directionAccuracy>=.55&&Number.isFinite(predictedReturn)&&Math.abs(predictedReturn)<.2;
 return {points,cadence,last,predictedReturn,predictedPrice:last!.price*(1+predictedReturn),lower:Math.max(0,last!.price*(1+predictedReturn-margin)),upper:last!.price*(1+predictedReturn+margin),tests:count,mae,baselineMae,directionAccuracy,supported,targetTime:last!.timestamp+cadence,validation};
}
export type StockDecision={signal:'Buy candidate'|'Sell / rebuy watch'|'Wait';reason:string;stale:boolean;netReturn:number;buyCeiling:number;rebuyCeiling:number};
export function stockDecision(forecast:StockForecast,now=Date.now()/1000):StockDecision{
 const {last,cadence}=forecast;
 const stale=!last||now-last.timestamp>Math.max(900,cadence*2)||last.timestamp>now+60||forecast.targetTime<=now;
 const base={signal:'Wait' as const,reason:forecast.issue??'The model has not shown enough evidence to trade.',stale,netReturn:last?forecast.predictedPrice*(1-SELL_FEE)/last.price-1:0,buyCeiling:forecast.lower*(1-SELL_FEE),rebuyCeiling:last?last.price*(1-SELL_FEE):0};
 if(forecast.issue)return base;
 if(stale)return {...base,reason:'The forecast window has passed. Refresh history before using a signal.'};
 if(!forecast.supported)return base;
 if(forecast.lower*(1-SELL_FEE)>last!.price)return {...base,signal:'Buy candidate',reason:'The estimated upside clears the selling fee and historical error margin.'};
 if(forecast.upper<last!.price*(1-SELL_FEE))return {...base,signal:'Sell / rebuy watch',reason:'The estimated decline clears the selling fee and historical error margin. Only consider shares you already own.'};
 return {...base,reason:'The estimated move does not clear both the selling fee and historical error margin.'};
}
