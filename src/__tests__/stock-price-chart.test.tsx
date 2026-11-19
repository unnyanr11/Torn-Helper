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
 const html=renderToStaticMarkup(<StockPriceChart name="Test stock" forecast={forecast} now={points.at(-1)!.timestamp+5}/>);
 expect(html).toMatch(/aria-pressed="true"[^>]*>24 hr<\/button>/);
 expect(html).toContain('Price / share ($)');expect(html).toContain('Time ·');expect(html).toContain('historical error range');expect(html).toContain('15 min');expect(html).toContain('60 min');expect(html).toContain('12 hr');expect(html).toContain('24 hr');expect(html).toContain('7 days');
});
it('inspects exact observations with pointer and keys and distinguishes the forecast',()=>{
 act(()=>{root=create(<StockPriceChart name="Test stock" forecast={forecast} now={points.at(-1)!.timestamp+5}/>);});
 act(()=>root!.root.findAllByType('button').find(b=>b.children.includes('60 min'))!.props.onClick());
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

it('shows current chart prices independently of an older pending analysis and includes a full week',()=>{
 const week=Array.from({length:10080},(_,i)=>({timestamp:1794000000+i*60,price:100+i*.001}));
 act(()=>{root=create(<StockPriceChart name="Test stock" forecast={forecast} history={week} now={week.at(-1)!.timestamp+20}/>);});
 act(()=>root!.root.findAllByType('button').find(b=>b.children.includes('7 days'))!.props.onClick());
 const svg=root!.root.findByType('svg');
 act(()=>svg.props.onKeyDown({key:'Home',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $100.00');
 act(()=>svg.props.onKeyDown({key:'End',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $110.08');
 expect(JSON.stringify(root!.toJSON())).toContain('20 seconds');
});

it('shares comparison range selection with its parent and accepts the selected range',()=>{
 let selected=0;
 act(()=>{root=create(<StockPriceChart name="Test stock" forecast={forecast} comparisonMinutes={720} onComparisonChange={minutes=>{selected=minutes;}} now={points.at(-1)!.timestamp+5}/>);});
 const buttons=root!.root.findAllByType('button');
 expect(buttons.find(b=>b.children.includes('12 hr'))!.props['aria-pressed']).toBe(true);
 act(()=>buttons.find(b=>b.children.includes('7 days'))!.props.onClick());
 expect(selected).toBe(10080);
});
