import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {analyzeStockHistory} from '../supabase/functions/_shared/stock-analysis.ts';
import {inferStockMinute} from '../supabase/functions/_shared/stock-inference.ts';
const rows=readFileSync(process.argv[2],'utf8').trim().split('\n').map(JSON.parse);
const models=[],start=performance.now();
for(const row of rows){
 const points=row.history.points.map(([timestamp,price])=>({timestamp,price:Number(price)})),now=points.at(-1).timestamp+10;
 for(const fitted of analyzeStockHistory(points,now))models.push({fitted,points:points.slice(-180),now});
}
const fitting_ms=performance.now()-start,runs=[];
for(let i=0;i<20;i++){
 const start=performance.now();
 for(const {fitted,points,now} of models)inferStockMinute(fitted.forecast,points,now,fitted.horizon);
 runs.push(performance.now()-start);
}
runs.sort((a,b)=>a-b);
const result={stocks:rows.length,forecasts:models.length,fitting_ms,inference_median_ms:runs[10],inference_p95_ms:runs[18],inference_max_ms:runs.at(-1),includes_network_or_database:false};
console.log(JSON.stringify(result,null,2));if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
