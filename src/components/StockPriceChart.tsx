import {useEffect,useId,useRef,useState} from 'react';
import type {PricePoint,StockForecast} from '../lib/stock-forecast';
import './stock-price-chart.css';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const time=(timestamp:number)=>new Date(timestamp*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
export default function StockPriceChart({forecast,name,history,now=Date.now()/1000}:{forecast:StockForecast;name:string;history?:PricePoint[];now?:number}){
 const host=useRef<HTMLDivElement>(null),id=useId().replace(/:/g,'');
 const [width,setWidth]=useState(760),[range,setRange]=useState(1440),[projection,setProjection]=useState(true),[active,setActive]=useState<number|null>(null);
 useEffect(()=>{
  const element=host.current;if(!element||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,entry.contentRect.width)));observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>setActive(null),[forecast,range,projection]);
 const source=history?.length?history:forecast.points;
 const latest=source.at(-1);
 const points=source.filter(p=>latest&&p.timestamp>latest.timestamp-range*60),last=points.at(-1),first=points[0];
 if(!last||!first)return <p>No recorded prices available for the chart.</p>;
 const hasProjection=projection&&!forecast.issue&&forecast.last?.timestamp===last.timestamp&&forecast.targetTime>now&&Number.isFinite(forecast.predictedPrice)&&forecast.targetTime>last.timestamp;
 const values=points.map(p=>p.price).concat(hasProjection?[forecast.lower,forecast.upper,forecast.predictedPrice]:[]);
 const low=Math.min(...values),high=Math.max(...values),padding=Math.max((high-low)*.12,last.price*.0001,.005);
 const min=low-padding,max=high+padding;
 const left=14,right=width<500?84:100,top=28,bottom=64,height=360,plotRight=width-right,plotBottom=height-bottom;
 const xTickCount=width<500?3:5;
 const observedCadence=Math.min(...points.slice(1).map((p,i)=>p.timestamp-points[i].timestamp));
 const start=last.timestamp-(range-1)*60,end=hasProjection?forecast.targetTime:last.timestamp;
 const x=(stamp:number)=>left+(stamp-start)/Math.max(60,end-start)*(plotRight-left);
 const y=(price:number)=>plotBottom-(price-min)/(max-min)*(plotBottom-top);
 const candidates=[...points.map(p=>({...p,filled:!!p.estimated,estimated:false})),...(hasProjection?[{timestamp:forecast.targetTime,price:forecast.predictedPrice,filled:false,estimated:true}]:[])];
 const selected=active===null?null:candidates[Math.min(active,candidates.length-1)];
 const change=last.price-first.price,changePercent=change/first.price*100;
 const rendered=points;
 const path=rendered.map((p,i)=>`${i&&p.timestamp-rendered[i-1].timestamp<=Math.max(60,observedCadence)*1.5?'L':'M'}${x(p.timestamp)},${y(p.price)}`).join(' ');
 const observedPath=rendered.slice(1).map((p,i)=>!p.estimated&&!rendered[i].estimated&&p.timestamp-rendered[i].timestamp<=Math.max(60,observedCadence)*1.5?`M${x(rendered[i].timestamp)},${y(rendered[i].price)} L${x(p.timestamp)},${y(p.price)}`:'').join(' ');
 const filledPath=rendered.slice(1).map((p,i)=>p.estimated||rendered[i].estimated?`M${x(rendered[i].timestamp)},${y(rendered[i].price)} L${x(p.timestamp)},${y(p.price)}`:'').join(' ');
 const fillCount=points.filter(p=>p.estimated).length;
 const inspect=(clientX:number,element:SVGSVGElement)=>{
  const box=element.getBoundingClientRect();if(!box.width)return;
  const stamp=start+((clientX-box.left)/box.width*width-left)/(plotRight-left)*Math.max(60,end-start);
  let index=0;for(let i=1;i<candidates.length;i++)if(Math.abs(candidates[i].timestamp-stamp)<Math.abs(candidates[index].timestamp-stamp))index=i;
  setActive(index);
 };
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const tick=(stamp:number)=>range>=10080?new Date(stamp*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'}):time(stamp);
 const age=Math.max(0,Math.floor(now-last.timestamp));
 return <figure className="market-chart" aria-label={`${name} stock price chart`}>
  <div className="market-chart-heading"><div><h4>{name}</h4><strong>{money(last.price)}</strong> <span className={change>=0?'market-positive':'market-negative'}>{change>=0?'+':''}{money(change)} ({changePercent>=0?'+':''}{changePercent.toFixed(2)}%)</span><small>Change across displayed observations · per share</small></div>
   <div className="market-chart-controls"><div role="group" aria-label="Price comparison range">{([[15,'15 min'],[30,'30 min'],[60,'60 min'],[720,'12 hr'],[1440,'24 hr'],[10080,'7 days']] as const).map(([n,label])=><button key={n} className="nu-btn" aria-pressed={range===n} onClick={()=>setRange(n)}>{label}</button>)}</div><label><input type="checkbox" checked={projection} onChange={e=>setProjection(e.target.checked)}/> Model estimate</label></div>
  </div>
  <p className={`market-chart-freshness ${age>120?'market-negative':''}`} role="status">Latest recorded price: {new Date(last.timestamp*1000).toLocaleString()} · {age<120?`${age} seconds`:`${Math.floor(age/60)} minutes`} behind your device clock. Your time: {new Date(now*1000).toLocaleTimeString()} · {zone}.{age>120?' Price data is delayed; trade signals should wait.':''}</p>
  <div className="market-chart-readout" id={`${id}-readout`} aria-live="polite">
   {selected?<><strong>{selected.filled?'Estimated gap fill':selected.estimated?'Model estimate':'Observed price'}: {money(selected.price)}</strong><span>{new Date(selected.timestamp*1000).toLocaleString()} · {zone}</span></>:<><strong>High {money(Math.max(...points.map(p=>p.price)))} · Low {money(Math.min(...points.map(p=>p.price)))}</strong><span>Hover or drag to inspect · Arrow keys move between prices</span></>}
  </div>
  <div ref={host} className="market-chart-canvas">
   <svg viewBox={`0 0 ${width} ${height}`} role="application" tabIndex={0} aria-label={`${name}: interactive price history. Use left and right arrows to inspect observations.`} aria-describedby={`${id}-readout`} onPointerMove={e=>inspect(e.clientX,e.currentTarget)} onPointerDown={e=>{inspect(e.clientX,e.currentTarget);e.currentTarget.focus();}} onPointerLeave={()=>setActive(null)} onBlur={()=>setActive(null)} onKeyDown={e=>{
    if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key)){e.preventDefault();setActive(current=>e.key==='Escape'?null:e.key==='Home'?0:e.key==='End'?candidates.length-1:Math.max(0,Math.min(candidates.length-1,(current??points.length-1)+(e.key==='ArrowRight'?1:-1))));}
   }}>
    <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient><clipPath id={`${id}-clip`}><rect x={left} y={top-6} width={plotRight-left} height={plotBottom-top+12}/></clipPath></defs>
    {Array.from({length:6},(_,i)=>{const price=min+(max-min)*i/5,py=y(price);return <g key={`y-${i}`}><line className="market-grid" x1={left} x2={plotRight} y1={py} y2={py}/><text className="market-axis" x={plotRight+8} y={py+4}>{money(price)}</text></g>;})}
    {Array.from({length:xTickCount},(_,i)=>{const stamp=start+(end-start)*i/(xTickCount-1),px=x(stamp);return <g key={`x-${i}`}><line className="market-grid" x1={px} x2={px} y1={top} y2={plotBottom}/><text className="market-axis" x={px} y={plotBottom+23} textAnchor={i===0?'start':i===xTickCount-1?'end':'middle'}>{tick(stamp)}</text></g>;})}
    <text className="market-axis-title" x={plotRight+8} y={15}>Price / share ($)</text><text className="market-axis-title" x={left} y={height-10}>Time · {zone}</text>
    <g clipPath={`url(#${id}-clip)`}>
     {hasProjection&&<rect x={x(last.timestamp)} y={top} width={Math.max(0,plotRight-x(last.timestamp))} height={plotBottom-top} fill="var(--accent)" opacity=".045"/>}
     <path d={`${path} L${x(last.timestamp)},${plotBottom} L${x(first.timestamp)},${plotBottom} Z`} fill={`url(#${id}-fill)`}/>
     <path d={observedPath} className="market-observed" fill="none"/><path d={filledPath} className="market-filled" fill="none"/>
     <line className="market-last-line" x1={left} x2={plotRight} y1={y(last.price)} y2={y(last.price)}/>
     {hasProjection&&<><path d={`M${x(last.timestamp)},${y(last.price)} L${x(forecast.targetTime)},${y(forecast.predictedPrice)}`} className="market-projection" fill="none"/><line x1={plotRight-4} x2={plotRight-4} y1={y(forecast.lower)} y2={y(forecast.upper)} stroke="var(--accent)" strokeWidth={8} opacity=".35"/><circle cx={plotRight-4} cy={y(forecast.predictedPrice)} r={4} fill="var(--accent)"/></>}
    </g>
    {selected&&<g className="market-crosshair"><line x1={x(selected.timestamp)} x2={x(selected.timestamp)} y1={top} y2={plotBottom}/><line x1={left} x2={plotRight} y1={y(selected.price)} y2={y(selected.price)}/><circle cx={x(selected.timestamp)} cy={y(selected.price)} r={4}/><rect x={plotRight+2} y={y(selected.price)-11} width={right-4} height={23} rx={3}/><text x={plotRight+8} y={y(selected.price)+5}>{money(selected.price)}</text><rect x={Math.max(left,Math.min(plotRight-62,x(selected.timestamp)-31))} y={plotBottom+5} width={62} height={24} rx={3}/><text x={Math.max(left+31,Math.min(plotRight-31,x(selected.timestamp)))} y={plotBottom+22} textAnchor="middle">{time(selected.timestamp)}</text></g>}
   </svg>
  </div>
  {projection&&!hasProjection&&<p className="market-chart-freshness">The model projection appears when a valid analysis matches the latest chart price. Recorded prices remain available while analysis updates.</p>}
  <figcaption><span>{(points.length-fillCount).toLocaleString()} recorded prices · {fillCount.toLocaleString()} estimated gap fills · {new Date(first.timestamp*1000).toLocaleString()} – {new Date(last.timestamp*1000).toLocaleString()}</span><span className="market-legend-observed">Observed prices</span><span className="market-legend-estimate">Dashed: model estimate</span><span>Vertical band: historical error range at forecast time</span><span>Dotted segments: missing minutes filled by neighbouring-price averages</span></figcaption>
 </figure>;
}
