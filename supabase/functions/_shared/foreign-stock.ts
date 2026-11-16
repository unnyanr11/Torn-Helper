const countries:Record<string,string>={mex:'Mexico',cay:'Cayman Islands',can:'Canada',haw:'Hawaii',uni:'United Kingdom',arg:'Argentina',swi:'Switzerland',jap:'Japan',chi:'China',uae:'UAE',sou:'South Africa'};
export type ForeignStock={country:string;id:number;quantity:number;cost:number;observed_at:string};
export function foreignStocks(payload:unknown,now=Date.now()):ForeignStock[]{
 const root=(payload as {stocks?:Record<string,{update?:number;stocks?:unknown[]}>})?.stocks;
 if(!root||typeof root!=='object')throw new Error('Invalid stock response');
 const rows:ForeignStock[]=[];
 for(const [code,country] of Object.entries(countries)){
  const record=root[code],timestamp=record?.update;
  if(typeof timestamp!=='number'||!Number.isFinite(timestamp)||timestamp<=0||timestamp*1000>now+60000)continue;
  if(!Array.isArray(record.stocks))continue;
  for(const raw of record.stocks){
   const row=raw as {id:number;quantity:number;cost:number};
   if(!Number.isSafeInteger(row.id)||row.id<1||![row.quantity,row.cost].every(v=>Number.isSafeInteger(v)&&v>=0))continue;
   rows.push({country,id:row.id,quantity:row.quantity,cost:row.cost,observed_at:new Date(timestamp*1000).toISOString()});
  }
 }
 if(!rows.length)throw new Error('Stock response has no dated observations');
 return rows;
}
