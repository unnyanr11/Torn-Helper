import {fitPredict,type PricePoint,type StockForecast} from './stock-forecast.ts';
export const MINUTE_MODEL_VERSION='minute-ridge-v2';
export type MinuteHorizon=1|5|15|60;
export type MinuteForecast=StockForecast&{model:string;tuningTests:number;observations:number;gapCount:number;intervalCoverage:number;holdoutImprovement:number;segmentStart:number};
const average=(a:number[])=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const quantile=(a:number[],q:number)=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]??0;};
type Sample={x:number[];y:number};
type Model='Ridge'|'Recent momentum'|'Mean reversion'|'No change';
const MODELS:Model[]=['No change','Ridge','Recent momentum','Mean reversion'];
function features(prices:number[],i:number){
 const p=prices.slice(i-60,i+1),r=p.slice(1).map((n,j)=>n/p[j]-1);
 const mean=(n:number)=>average(r.slice(-n));
 const vol=(n:number)=>{const a=r.slice(-n),m=average(a);return Math.sqrt(average(a.map(v=>(v-m)**2)));};
 const deviation=(n:number)=>prices[i]/average(p.slice(-n))-1;
 return [r[59],r[58],mean(3),mean(5),mean(15),mean(60),vol(5),vol(15),vol(60),deviation(5),deviation(20),deviation(60)];
}
function predict(model:Model,train:Sample[],x:number[]):number{
 if(model==='No change')return 0;
 if(model==='Recent momentum')return x[3];
 if(model==='Mean reversion')return -x[10]/20;
 return fitPredict(train.slice(-360),x);
}
/** Fixed candidates selected on earlier tuning data, then scored on a disjoint later holdout.
 * Horizons are 1, 5, 15 or 60 minutes, with overlapping labels purged from training. Missing minutes are never fabricated.
 */
export function forecastMinuteStock(input:PricePoint[],now=Date.now()/1000,horizon:MinuteHorizon=1):MinuteForecast{
 if(![1,5,15,60].includes(horizon))throw new Error('Unsupported forecast horizon');
 const clean=input.filter(p=>Number.isInteger(p.timestamp)&&p.timestamp%60===0&&p.timestamp<=now&&Number.isFinite(p.price)&&p.price>0).sort((a,b)=>a.timestamp-b.timestamp);
 const unique=[...new Map(clean.map(p=>[p.timestamp,p])).values()].slice(-2000);
 let start=0,gaps=0;
 for(let i=1;i<unique.length;i++)if(unique[i].timestamp-unique[i-1].timestamp!==60){start=i;gaps++;}
 const points=unique.slice(start),last=points.at(-1)??null;
 const empty=(issue:string):MinuteForecast=>({points,last,issue,cadence:horizon*60,predictedReturn:0,predictedPrice:0,lower:0,upper:0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,targetTime:0,validation:[],model:'No change',tuningTests:0,observations:unique.length,gapCount:gaps,intervalCoverage:0,holdoutImprovement:0,segmentStart:points[0]?.timestamp??0});
 const required=240+2*(horizon-1);
 if(points.length<required)return empty(`Need ${required} consecutive minute observations; ${points.length} available after the latest gap. Collection and historical warmup run automatically.`);
 if(!last||now-last.timestamp>120)return empty('Minute prices are stale. Waiting for the collector to catch up.');
 const prices=points.map(p=>p.price),samples:Sample[]=[];
 for(let i=60;i<prices.length-horizon;i++)samples.push({x:features(prices,i),y:prices[i+horizon]/prices[i]-1});
 const holdoutCount=Math.min(80,Math.floor(samples.length*.25));
 const holdoutStart=samples.length-holdoutCount;
 const tuningEnd=holdoutStart-horizon+1;
 const tuneCount=Math.min(40,Math.floor(tuningEnd*.25)),tuneStart=tuningEnd-tuneCount;
 const tuning=MODELS.map(model=>({model,mae:average(samples.slice(tuneStart,tuningEnd).map((s,j)=>Math.abs(predict(model,samples.slice(0,tuneStart+j-horizon+1),s.x)-s.y)))}));
 tuning.sort((a,b)=>a.mae-b.mae||MODELS.indexOf(a.model)-MODELS.indexOf(b.model));
 const model=tuning[0].model,validation:StockForecast['validation']=[],errors:number[]=[],base:number[]=[];let correct=0,covered=0;
 for(let i=holdoutStart;i<samples.length;i++){
  const forecast=predict(model,samples.slice(0,i-horizon+1),samples[i].x),actual=samples[i].y;
  if(!Number.isFinite(forecast))return empty('Minute model is unstable. Wait for more observations.');
  // Band for this origin uses only prior residuals, never its own target.
  const available=errors.slice(0,Math.max(0,errors.length-horizon+1));
  const calibration=available.length>=20?available:[];
  if(calibration.length&&Math.abs(actual-forecast)<=quantile(calibration,.9))covered++;
  errors.push(Math.abs(actual-forecast));base.push(Math.abs(actual));
  validation.push({timestamp:points[i+60+horizon].timestamp,predictedReturn:forecast,actualReturn:actual});
  if(Math.abs(actual)>1e-10&&Math.sign(forecast)===Math.sign(actual))correct++;
 }
 const predictedReturn=predict(model,samples,features(prices,prices.length-1));
 if(!Number.isFinite(predictedReturn)||Math.abs(predictedReturn)>=.2)return empty('Minute forecast is unstable. No trade signal.');
 const margin=Math.max(quantile(errors,.9),1e-8),mae=average(errors),baselineMae=average(base),directionAccuracy=correct/holdoutCount;
 const improvement=baselineMae>0?1-mae/baselineMae:0;
 return {points,last,cadence:horizon*60,predictedReturn,predictedPrice:last.price*(1+predictedReturn),lower:Math.max(0,last.price*(1+predictedReturn-margin)),upper:last.price*(1+predictedReturn+margin),tests:holdoutCount,mae,baselineMae,directionAccuracy,supported:model!=='No change'&&holdoutCount>=40&&improvement>=.05&&directionAccuracy>=.55,targetTime:last.timestamp+horizon*60,validation,model,tuningTests:tuneCount,observations:unique.length,gapCount:gaps,intervalCoverage:holdoutCount>19+horizon?covered/(holdoutCount-19-horizon):0,holdoutImprovement:improvement,segmentStart:points[0].timestamp};
}
/** Evaluate forecasts only at their exact future minute; gaps are not substitutes. */
export function scoreForwardPredictions(predictions:{targetTime:number;predictedPrice:number;originPrice:number}[],actuals:PricePoint[]){
 const prices=new Map(actuals.map(p=>[p.timestamp,p.price]));
 const pairs=predictions.flatMap(p=>{const actual=prices.get(p.targetTime);return actual===undefined?[]:[{...p,actual}];});
 return {tests:pairs.length,mae:pairs.length?average(pairs.map(p=>Math.abs(p.predictedPrice/p.originPrice-p.actual/p.originPrice))):null,baselineMae:pairs.length?average(pairs.map(p=>Math.abs(p.actual/p.originPrice-1))):null,directionAccuracy:pairs.length?pairs.filter(p=>Math.abs(p.actual-p.originPrice)>1e-10&&Math.sign(p.predictedPrice-p.originPrice)===Math.sign(p.actual-p.originPrice)).length/pairs.length:null};
}
