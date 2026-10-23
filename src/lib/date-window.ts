export type DateWindow={period:string;from:string;to:string};
export const defaultWindow:DateWindow={period:'30',from:'',to:''};
/** Today and custom dates are UTC; end is exclusive, including the whole final day. */
export function dateBounds(window:DateWindow,now=Date.now()):{from?:string;to?:string}{
 if(window.period==='all')return {};
 if(window.period==='custom'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(window.from)||!/^\d{4}-\d{2}-\d{2}$/.test(window.to))throw new Error('Choose both dates.');
  const from=Date.parse(window.from+'T00:00:00Z'),last=Date.parse(window.to+'T00:00:00Z');
  if(!Number.isFinite(from)||!Number.isFinite(last)||new Date(from).toISOString().slice(0,10)!==window.from||new Date(last).toISOString().slice(0,10)!==window.to||from>last)throw new Error('The end date must follow the start date.');
  return {from:new Date(from).toISOString(),to:new Date(last+86400000).toISOString()};
 }
 if(window.period==='today')return {from:new Date(new Date(now).toISOString().slice(0,10)+'T00:00:00Z').toISOString()};
 const days=Number(window.period);if(!Number.isInteger(days)||days<1||days>365)throw new Error('Choose a valid date window.');
 return {from:new Date(now-days*86400000).toISOString()};
}
