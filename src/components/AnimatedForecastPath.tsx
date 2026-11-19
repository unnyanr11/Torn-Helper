import {useAnimatedStockHistory} from '../hooks/useAnimatedStockHistory';
import type {StockProjection} from '../lib/stock-projection';
export default function AnimatedForecastPath({path,x,y,lastPrice}:{path:StockProjection['paths'][number];x:(stamp:number)=>number;y:(price:number)=>number;lastPrice:number}){
 const points=useAnimatedStockHistory(path.points,path.kind);
 return <g className={`market-forecast-path market-forecast-${path.kind}`} aria-label={path.kind==='expected'?'Model estimate path':`${path.kind} historical scenario`}>
  {points.slice(1).map((point,i)=>{const previous=points[i],direction=point.price>previous.price?'up':point.price<previous.price?'down':'flat';return <path key={point.timestamp} d={`M${x(previous.timestamp)},${y(previous.price)} L${x(point.timestamp)},${y(point.price)}`} className={`market-projection market-projection-${direction}`} fill="none"/>;})}
  <circle cx={x(points.at(-1)!.timestamp)} cy={y(points.at(-1)!.price)} r={path.kind==='expected'?4:3} fill={points.at(-1)!.price>=lastPrice?'#16a34a':'#dc2626'}/>
 </g>;
}
