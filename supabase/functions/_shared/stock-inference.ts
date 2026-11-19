import {minuteFeatures,type MinuteForecast,type MinuteHorizon} from '../../../src/lib/minute-forecast.ts';
import {fillMissingStockMinutes} from '../../../src/lib/stock-minute-clean.ts';
import type {PricePoint} from '../../../src/lib/stock-forecast.ts';
/** Weekly fitting happens separately. This path only applies saved coefficients
 * to the current minute; historical validation figures remain tied to that fit. */
export function inferStockMinute(template:MinuteForecast,input:PricePoint[],now:number,horizon:MinuteHorizon):MinuteForecast{
 const points=fillMissingStockMinutes(input.filter(p=>p.timestamp<=now)),last=points.at(-1)??null;
 const base={...template,points:points.slice(-60),last,validation:[],targetTime:last?last.timestamp+horizon*60:0};
 if(template.issue)return {...base,issue:template.issue};
 if(!template.fitted||now-template.fitted.trainedAt>1800)return {...base,issue:'The fitted model is being refreshed. Wait for current validation.'};
 if(!last||now-last.timestamp>120||points.length<61)return {...base,issue:'Fresh observed prices and 61 minutes of indicator history are required.'};
 const prices=points.map(p=>p.price),x=minuteFeatures(prices,prices.length-1),fit=template.fitted;
 let predictedReturn=0;
 if(template.model==='Ridge'){
  if(!fit.linear)return {...base,issue:'Saved regression coefficients are unavailable.'};
  predictedReturn=fit.linear.intercept+fit.linear.coefficients.reduce((sum,v,j)=>sum+v*x[j],0);
 }else if(template.model==='Recent momentum')predictedReturn=x[3];
 else if(template.model==='Mean reversion')predictedReturn=-x[10]/20;
 if(!Number.isFinite(predictedReturn)||Math.abs(predictedReturn)>=.2)return {...base,issue:'Current forecast is unstable. Wait for the next model update.'};
 const dropReturn=prices.at(-1)!/prices[prices.length-6]-1;
 return {...base,issue:undefined,predictedReturn,predictedPrice:last.price*(1+predictedReturn),lower:Math.max(0,last.price*(1+predictedReturn-fit.margin)),upper:last.price*(1+predictedReturn+fit.margin),dip:{present:dropReturn<0&&x[11]<0,dropReturn,tests:template.dip?.tests??0,reboundRate:template.dip?.reboundRate??0}};
}
