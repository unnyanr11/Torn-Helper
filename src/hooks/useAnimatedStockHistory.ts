import {useEffect,useRef,useState} from 'react';
import type {PricePoint} from '../lib/stock-forecast';
export function prefersReducedStockMotion(){
 return typeof document==='undefined'||document.documentElement.dataset.motion==='reduced'||typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/** Tween geometry only: readouts, timestamps and trading decisions always use real incoming quotes. */
export function useAnimatedStockHistory(target:PricePoint[],identity:string){
 const [display,setDisplay]=useState(target),current=useRef(target),key=useRef(identity);
 useEffect(()=>{
  const previous=current.current;
  const same=previous.length===target.length&&previous.every((p,i)=>p.timestamp===target[i].timestamp&&p.price===target[i].price&&p.estimated===target[i].estimated);
  const changedIdentity=key.current!==identity;key.current=identity;
  if(same)return;
  if(changedIdentity||prefersReducedStockMotion()||typeof requestAnimationFrame!=='function'||!previous.length){current.current=target;setDisplay(target);return;}
  const old=new Map(previous.map(p=>[p.timestamp,p.price]));
  const from=target.map(p=>old.get(p.timestamp)??previous.at(-1)!.price);
  let started:number|undefined,frame:number;
  const animate=(time:number)=>{
   started??=time;const progress=Math.min(1,(time-started)/650),ease=1-(1-progress)**3;
   const next=target.map((p,i)=>({...p,price:from[i]+(p.price-from[i])*ease}));current.current=next;setDisplay(next);
   if(progress<1)frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
 },[target,identity]);
 // Range/stock switches should show their own data immediately, rather than tween unrelated prices.
 return key.current===identity?display:target;
}
