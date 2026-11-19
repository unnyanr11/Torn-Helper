import {useEffect,useRef,useState} from 'react';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});

export default function AnimatedStockPrice({value,observedAt,showChange=true}:{value:number;observedAt?:string;showChange?:boolean}){
 const [display,setDisplay]=useState(value),[change,setChange]=useState(0);
 const displayed=useRef(value),previous=useRef(value),frame=useRef<number>();
 useEffect(()=>{
  const difference=value-previous.current;
  previous.current=value;
  setChange(difference);
  if(frame.current!==undefined)cancelAnimationFrame(frame.current);
  const start=displayed.current;
  const reduced=document.documentElement.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced||difference===0){displayed.current=value;setDisplay(value);return;}
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
 return <span style={showChange?undefined:{color:'var(--fg)'}} className={`live-stock-price ${change>0?'price-up':change<0?'price-down':''}`}>
  {change!==0&&<span key={observedAt??value} className="stock-price-flash" aria-hidden="true"/>}
  <strong><span aria-hidden="true">{money(display)}</span><span className="stock-price-accessible">{money(value)}</span></strong>
  {showChange&&<small>{change===0?'—':`${change>0?'↑ +':'↓ −'}${money(Math.abs(change))}`}</small>}
 </span>;
}
