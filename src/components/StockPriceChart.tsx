import {displayedStockProjection} from '../lib/stock-projection';
import {useEffect,useId,useRef,useState} from 'react';
import type {PricePoint,StockForecast} from '../lib/stock-forecast';
import './stock-price-chart.css';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const time=(timestamp:number)=>new Date(timestamp*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
export default function StockPriceChart({forecast,name,history,longTerm=false,comparisonMinutes,onComparisonChange,now=Date.now()/1000}:{forecast:StockForecast;name:string;history?:PricePoint[];longTerm?:boolean;comparisonMinutes?:number;onComparisonChange?:(minutes:number)=>void;now?:number}){
 const host=useRef<HTMLDivElement>(null),id=useId().replace(/:/g,'');
 const [width,setWidth]=useState(760),[localRange,setLocalRange]=useState(1440),[projection,setProjection]=useState(true),[active,setActive]=useState<number|null>(null);
 const range=comparisonMinutes??localRange;
 const setRange=(minutes:number)=>onComparisonChange?onComparisonChange(minutes):setLocalRange(minutes);
 useEffect(()=>{
  const element=host.current;if(!element||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,entry.contentRect.width)));observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>setActive(null),[forecast,range,projection]);
 const source=history?.length?history:forecast.points;
 const latest=source.at(-1);
 const points=source.filter(p=>latest&&p.timestamp>latest.timestamp-range*60),last=points.at(-1),first=points[0];
 if(!last||!first)return <p>No recorded prices available for the chart.</p>;
 const forecastPaths=projection?displayedStockProjection(forecast,last,now,longTerm?600:120):[];
 const hasProjection=forecastPaths.length>0;
 const values=points.map(p=>p.price).concat(hasProjection?[forecast.lower,forecast.upper,...forecastPaths.flatMap(path=>path.points.map(p=>p.price))]:[]);
 const low=Math.min(...values),high=Math.max(...values),padding=Math.max((high-low)*.12,last.price*.0001,.005);
 const min=low-padding,max=high+padding;
 const left=14,right=width<500?84:100,top=28,bottom=64,height=360,plotRight=width-right,plotBottom=height-bottom;
 const xTickCount=width<500?3:5;
 // A partial final hour must not redefine the spacing of every historical point.
 const observedCadence=longTerm?3600:60;
 const maxGap=observedCadence*1.5;
 const start=last.timestamp-(range-1)*60,end=hasProjection?forecast.targetTime:last.timestamp;
 const x=(stamp:number)=>left+(stamp-start)/Math.max(60,end-start)*(plotRight-left);
 const y=(price:number)=>plotBottom-(price-min)/(max-min)*(plotBottom-top);
 const candidates=[...points.map(p=>({...p,filled:!!p.estimated,estimated:false,series:'observed'})),...forecastPaths.flatMap(path=>path.points.slice(1).map(p=>({...p,filled:false,estimated:true,series:path.kind})))];
 candidates.sort((a,b)=>a.timestamp-b.timestamp);
 const selected=active===null?null:candidates[Math.min(active,candidates.length-1)];
 const change=last.price-first.price,changePercent=change/first.price*100;
 const rendered=points;
 const segments:PricePoint[][]=[];
 for(const point of rendered){const segment=segments.at(-1);if(!segment||point.timestamp-segment.at(-1)!.timestamp>maxGap)segments.push([point]);else segment.push(point);}
 const area=segments.filter(segment=>segment.length>1).map(segment=>segment.map((p,i)=>`${i?'L':'M'}${x(p.timestamp)},${y(p.price)}`).join(' ')+` L${x(segment.at(-1)!.timestamp)},${plotBottom} L${x(segment[0].timestamp)},${plotBottom} Z`).join(' ');
 const observedPath=rendered.slice(1).map((p,i)=>!p.estimated&&!rendered[i].estimated&&p.timestamp-rendered[i].timestamp<=maxGap?`M${x(rendered[i].timestamp)},${y(rendered[i].price)} L${x(p.timestamp)},${y(p.price)}`:'').join(' ');
 const filledPath=rendered.slice(1).map((p,i)=>(p.estimated||rendered[i].estimated)&&p.timestamp-rendered[i].timestamp<=maxGap?`M${x(rendered[i].timestamp)},${y(rendered[i].price)} L${x(p.timestamp)},${y(p.price)}`:'').join(' ');
 const fillCount=points.filter(p=>p.estimated).length;
 const inspect=(clientX:number,element:SVGSVGElement,clientY?:number)=>{
  const box=element.getBoundingClientRect();if(!box.width)return;
  const stamp=start+((clientX-box.left)/box.width*width-left)/(plotRight-left)*Math.max(60,end-start);
  let index=0;for(let i=1;i<candidates.length;i++)if(Math.abs(candidates[i].timestamp-stamp)<Math.abs(candidates[index].timestamp-stamp))index=i;
  if(clientY!==undefined&&box.height>0){const closest=Math.abs(candidates[index].timestamp-stamp),py=(clientY-box.top)/box.height*height;for(let i=0;i<candidates.length;i++)if(Math.abs(candidates[i].timestamp-stamp)<=closest+.001&&Math.abs(y(candidates[i].price)-py)<Math.abs(y(candidates[index].price)-py))index=i;}
  setActive(index);
 };
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const tick=(stamp:number)=>end-start>=7*86400?new Date(stamp*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'}):end-start>86400?new Date(stamp*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):time(stamp);
 const age=Math.max(0,Math.floor(now-last.timestamp));
 return <figure className="market-chart" aria-label={`${name} stock price chart`}>
  <div className="market-chart-heading"><div><h4>{name}</h4><strong>{money(last.price)}</strong> <span className={change>=0?'market-positive':'market-negative'}>{change>=0?'+':''}{money(change)} ({changePercent>=0?'+':''}{changePercent.toFixed(2)}%)</span><small>Change across displayed observations · per share</small></div>
   <div className="market-chart-controls"><div role="group" aria-label="Price comparison range">{(longTerm?[[1440,'24 hr'],[10080,'7 days'],[43200,'30 days']]:[[15,'15 min'],[30,'30 min'],[60,'60 min'],[120,'2 hr'],[180,'3 hr'],[360,'6 hr'],[720,'12 hr'],[1080,'18 hr'],[1440,'24 hr'],[10080,'7 days']]).map(([n,label])=><button key={n} className="nu-btn" aria-pressed={range===Number(n)} onClick={()=>setRange(Number(n))}>{label}</button>)}</div><label><input type="checkbox" checked={projection} onChange={e=>setProjection(e.target.checked)}/> Model estimate</label></div>
  </div>
  <p className={`market-chart-freshness ${age>(longTerm?600:120)?'market-negative':''}`} role="status">Latest recorded price: {new Date(last.timestamp*1000).toLocaleString()} · {age<(longTerm?600:120)?`${age} seconds`:`${Math.floor(age/60)} minutes`} behind your device clock. Your time: {new Date(now*1000).toLocaleTimeString()} · {zone}.{age>(longTerm?600:120)?' Price data is delayed; trade signals should wait.':''}</p>
  <div className="market-chart-readout" id={`${id}-readout`} aria-live="polite">
   {selected?<><strong>{selected.filled?'Estimated gap fill':selected.estimated?(selected.series==='upside'?'Upside scenario':selected.series==='downside'?'Downside scenario':'Model estimate'):'Observed price'}: {money(selected.price)}</strong><span>{new Date(selected.timestamp*1000).toLocaleString()} · {zone}</span></>:<><strong>High {money(Math.max(...points.map(p=>p.price)))} · Low {money(Math.min(...points.map(p=>p.price)))}</strong><span>Hover or drag to inspect · Arrow keys move between prices</span></>}
  </div>
  <div ref={host} className="market-chart-canvas">
   <svg viewBox={`0 0 ${width} ${height}`} role="application" tabIndex={0} aria-label={`${name}: interactive price history. Use left and right arrows to inspect observations.`} aria-describedby={`${id}-readout`} onPointerMove={e=>inspect(e.clientX,e.currentTarget,e.clientY)} onPointerDown={e=>{inspect(e.clientX,e.currentTarget,e.clientY);e.currentTarget.focus();}} onPointerLeave={()=>setActive(null)} onBlur={()=>setActive(null)} onKeyDown={e=>{
    if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key)){e.preventDefault();setActive(current=>e.key==='Escape'?null:e.key==='Home'?0:e.key==='End'?candidates.length-1:Math.max(0,Math.min(candidates.length-1,(current??points.length-1)+(e.key==='ArrowRight'?1:-1))));}
   }}>
    <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient><clipPath id={`${id}-clip`}><rect x={left} y={top-6} width={plotRight-left} height={plotBottom-top+12}/></clipPath></defs>
    {Array.from({length:6},(_,i)=>{const price=min+(max-min)*i/5,py=y(price);return <g key={`y-${i}`}><line className="market-grid" x1={left} x2={plotRight} y1={py} y2={py}/><text className="market-axis" x={plotRight+8} y={py+4}>{money(price)}</text></g>;})}
    {Array.from({length:xTickCount},(_,i)=>{const stamp=start+(end-start)*i/(xTickCount-1),px=x(stamp);return <g key={`x-${i}`}><line className="market-grid" x1={px} x2={px} y1={top} y2={plotBottom}/><text className="market-axis" x={px} y={plotBottom+23} textAnchor={i===0?'start':i===xTickCount-1?'end':'middle'}>{tick(stamp)}</text></g>;})}
    <text className="market-axis-title" x={plotRight+8} y={15}>Price / share ($)</text><text className="market-axis-title" x={left} y={height-10}>Time · {zone}</text>
    <g clipPath={`url(#${id}-clip)`}>
     {hasProjection&&<rect x={x(last.timestamp)} y={top} width={Math.max(0,plotRight-x(last.timestamp))} height={plotBottom-top} fill="var(--accent)" opacity=".045"/>}
     <path d={area} fill={`url(#${id}-fill)`}/>
     <path d={observedPath} className="market-observed" fill="none"/><path d={filledPath} className="market-filled" fill="none"/>
     <line className="market-last-line" x1={left} x2={plotRight} y1={y(last.price)} y2={y(last.price)}/>
     {forecastPaths.map(path=><g key={path.kind} className={`market-forecast-path market-forecast-${path.kind}`} aria-label={path.kind==='expected'?'Model estimate path':`${path.kind} historical scenario`}>
      {path.points.slice(1).map((point,i)=>{const previous=path.points[i],direction=point.price>previous.price?'up':point.price<previous.price?'down':'flat';return <path key={point.timestamp} d={`M${x(previous.timestamp)},${y(previous.price)} L${x(point.timestamp)},${y(point.price)}`} className={`market-projection market-projection-${direction}`} fill="none"/>;})}
      <circle cx={x(path.points.at(-1)!.timestamp)} cy={y(path.points.at(-1)!.price)} r={path.kind==='expected'?4:3} fill={path.points.at(-1)!.price>=last.price?'#16a34a':'#dc2626'}/>
     </g>)}
     {hasProjection&&<line x1={plotRight-4} x2={plotRight-4} y1={y(forecast.lower)} y2={y(forecast.upper)} stroke="var(--accent)" strokeWidth={8} opacity=".25"/>}
    </g>
    {selected&&<g className="market-crosshair"><line x1={x(selected.timestamp)} x2={x(selected.timestamp)} y1={top} y2={plotBottom}/><line x1={left} x2={plotRight} y1={y(selected.price)} y2={y(selected.price)}/><circle cx={x(selected.timestamp)} cy={y(selected.price)} r={4}/><rect x={plotRight+2} y={y(selected.price)-11} width={right-4} height={23} rx={3}/><text x={plotRight+8} y={y(selected.price)+5}>{money(selected.price)}</text><rect x={Math.max(left,Math.min(plotRight-62,x(selected.timestamp)-31))} y={plotBottom+5} width={62} height={24} rx={3}/><text x={Math.max(left+31,Math.min(plotRight-31,x(selected.timestamp)))} y={plotBottom+22} textAnchor="middle">{time(selected.timestamp)}</text></g>}
   </svg>
  </div>
  {projection&&!hasProjection&&<p className="market-chart-freshness">The model projection appears when a recent analysis is available for this horizon. Recorded prices remain available while analysis updates.</p>}
  {hasProjection&&forecast.projection&&<p className="market-chart-freshness">Pattern paths use {forecast.projection.sampleCount} similar completed historical windows. The stronger dotted line meets the model’s endpoint; lighter lines are alternative upside/downside scenarios when at least five examples exist. Intermediate turns are illustrative estimates, not independently validated forecasts.{!forecast.supported?' This model has not passed the trade-signal validation checks.':''}</p>}
  {forecast.projection&&<p className="market-chart-freshness">Historical hourly rising runs: {forecast.projection.runs.riseHours===null?'unavailable':`${forecast.projection.runs.riseHours.toFixed(1)} hr median (${forecast.projection.runs.riseCount} runs)`} · Falling runs: {forecast.projection.runs.fallHours===null?'unavailable':`${forecast.projection.runs.fallHours.toFixed(1)} hr median (${forecast.projection.runs.fallCount} runs)`}. These are past intervals, not a repeating schedule.</p>}
  {hasProjection&&<p className="market-chart-freshness">Forecast issued {new Date(forecast.last!.timestamp*1000).toLocaleString()} · Target {new Date(forecast.targetTime*1000).toLocaleString()}. Hover or use arrow keys to inspect future prices and times.</p>}
  <figcaption><span>{(points.length-fillCount).toLocaleString()} recorded prices · {fillCount.toLocaleString()} estimated gap fills · {new Date(first.timestamp*1000).toLocaleString()} – {new Date(last.timestamp*1000).toLocaleString()}</span><span className="market-legend-observed">Blue solid: actual prices</span><span className="market-legend-up">Green dotted: forecast rise</span><span className="market-legend-down">Red dotted: forecast fall</span><span>Vertical band: historical error range at forecast time</span><span>Dotted segments: missing {longTerm?'hours':'minutes'} filled by neighbouring-price averages</span></figcaption>
 </figure>;
}
