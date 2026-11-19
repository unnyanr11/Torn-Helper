import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it} from 'vitest';
import StockPriceChart from '../components/StockPriceChart';
import {forecastMinuteStock} from '../lib/minute-forecast';
const points=Array.from({length:300},(_,i)=>({timestamp:1794000000+i*60,price:100+i*.01}));
const forecast=forecastMinuteStock(points,points.at(-1)!.timestamp+5);
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;});
it('labels both axes, timezone, observed data and model estimates',()=>{
 const html=renderToStaticMarkup(<StockPriceChart name="Test stock" forecast={forecast}/>);
 expect(html).toContain('Price / share ($)');expect(html).toContain('Time ·');expect(html).toContain('historical error range');expect(html).toContain('15 min');expect(html).toContain('60 min');
});
it('inspects exact observations with pointer and keys and distinguishes the forecast',()=>{
 act(()=>{root=create(<StockPriceChart name="Test stock" forecast={forecast}/>);});
 const svg=()=>root!.root.findByType('svg');
 act(()=>svg().props.onPointerMove({clientX:14,currentTarget:{getBoundingClientRect:()=>({left:0,width:760})}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $102.40');
 act(()=>svg().props.onKeyDown({key:'ArrowRight',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $102.41');
 act(()=>svg().props.onKeyDown({key:'End',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Model estimate:');
 act(()=>root!.root.findByType('input').props.onChange({target:{checked:false}}));
 act(()=>svg().props.onKeyDown({key:'End',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $102.99');
});
