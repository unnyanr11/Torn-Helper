import {prefersReducedStockMotion} from '../hooks/useAnimatedStockHistory';
import {useEffect,useRef,useState} from 'react';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});

export default function AnimatedStockPrice({value,observedAt,showChange=true,comparisonPrice}:{value:number;observedAt?:string;showChange?:boolean;comparisonPrice?:number|null}){
 const [display,setDisplay]=useState(value),[change,setChange]=useState(0);
 const displayed=useRef(value),previous=useRef(value),frame=useRef<number>();
 useEffect(()=>{
  const difference=value-previous.current;
  previous.current=value;
  setChange(difference);
  if(frame.current!==undefined)cancelAnimationFrame(frame.current);
  const start=displayed.current;
  const reduced=prefersReducedStockMotion();
  if(reduced||typeof requestAnimationFrame!=='function'||difference===0){displayed.current=value;setDisplay(value);return;}
  let started:number|undefined;
  const animate=(time:number)=>{
   started??=time;
   const progress=Math.min(1,(time-started)/700);
   displayed.current=start+(value-start)*(1-Math.pow(1-progress,3));
   setDisplay(displayed.current);
   if(progress<1)frame.current=requestAnimationFrame(animate);
  };
  frame.current=requestAnimationFrame(animate);
  return()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);};
 },[value,observedAt]);
 const movement=comparisonPrice===undefined?change:comparisonPrice&&comparisonPrice>0?display-comparisonPrice:null;
 const percent=comparisonPrice&&comparisonPrice>0&&movement!==null?movement/comparisonPrice*100:null;
 const color=movement===null||movement===0?'var(--fg)':movement>0?'var(--ok)':'var(--warn)';
 return <span style={comparisonPrice!==undefined?{color}:showChange?undefined:{color:'var(--fg)'}} className={`live-stock-price ${change>0?'price-up':change<0?'price-down':''}`}>
  {change!==0&&<span key={observedAt??value} className="stock-price-flash" aria-hidden="true"/>}
  <strong><span aria-hidden="true">{money(display)}</span><span className="stock-price-accessible">{money(value)}</span></strong>
  {showChange&&<small style={comparisonPrice===undefined?undefined:{color}}>{movement===null||(comparisonPrice===undefined&&movement===0)?'—':`${movement>0?'↑ +':movement<0?'↓ −':''}${money(Math.abs(movement))}${percent===null?'':` (${percent>0?'+':''}${percent.toFixed(2)}%)`}`}</small>}
 </span>;
}
