export type LinearRidge={coefficients:number[];intercept:number};
type Sample={x:number[];y:number};
/** Expanding sufficient statistics reproduce standardized ridge without rescanning
 * the entire training prefix at every walk-forward origin. No future rows enter. */
export function expandingRidge(samples:Sample[]){
 const d=samples[0]?.x.length??0;
 let count=0,meanY=0,means=new Float64Array(d),covXY=new Float64Array(d),covXX=new Float64Array(d*d);
 let linear:LinearRidge|undefined;
 const predict=(end:number,input:number[])=>{
  if(end<count){count=0;meanY=0;means=new Float64Array(d);covXY=new Float64Array(d);covXX=new Float64Array(d*d);}
  while(count<end){
   const {x,y}=samples[count],delta=x.map((v,j)=>v-means[j]),deltaY=y-meanY;
   const factor=count/(count+1);count++;meanY+=deltaY/count;
   for(let j=0;j<d;j++){means[j]+=delta[j]/count;covXY[j]+=delta[j]*deltaY*factor;for(let k=0;k<d;k++)covXX[j*d+k]+=delta[j]*delta[k]*factor;}
  }
  if(!count)return 0;
  // Treat negligible numerical jitter as a constant feature rather than magnifying it.
  const scales=Array.from(means,(_,j)=>{const variance=Math.max(0,covXX[j*d+j]/count);return variance<1e-24?1:Math.sqrt(variance);});
  const matrix=Array.from({length:d},(_,j)=>Array.from({length:d+1},(_,k)=>k===d?covXY[j]/scales[j]:covXX[j*d+k]/(scales[j]*scales[k])+(j===k?1:0)));
  for(let j=0;j<d;j++){
   let pivot=j;for(let k=j+1;k<d;k++)if(Math.abs(matrix[k][j])>Math.abs(matrix[pivot][j]))pivot=k;
   [matrix[j],matrix[pivot]]=[matrix[pivot],matrix[j]];
   const divisor=matrix[j][j];if(Math.abs(divisor)<1e-12)return 0;
   for(let k=j;k<=d;k++)matrix[j][k]/=divisor;
   for(let row=0;row<d;row++)if(row!==j){const factor=matrix[row][j];for(let k=j;k<=d;k++)matrix[row][k]-=factor*matrix[j][k];}
  }
  const coefficients=Array.from(means,(_,j)=>matrix[j][d]/scales[j]);
  linear={coefficients,intercept:meanY-coefficients.reduce((sum,v,j)=>sum+v*means[j],0)};
  return meanY+input.reduce((sum,v,j)=>sum+(v-means[j])/scales[j]*matrix[j][d],0);
 };
 return Object.assign(predict,{snapshot:()=>linear});
}
