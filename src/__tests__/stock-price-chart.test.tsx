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

it('offers daily, weekly and monthly chart comparisons for long-term mode',()=>{
 const html=renderToStaticMarkup(<StockPriceChart longTerm name="Test stock" forecast={forecast} now={points.at(-1)!.timestamp+5}/>);
 expect(html).toContain('30 days');expect(html).toContain('7 days');expect(html).toContain('24 hr');expect(html).not.toContain('15 min');
});
it('connects hourly observations when the latest quote is only a minute into a partial hour',()=>{
 const start=1794000000;
 const hourly=Array.from({length:24},(_,i)=>({timestamp:start+i*3600,price:100+Math.sin(i)*.1}));
 const history=[...hourly,{timestamp:hourly.at(-1)!.timestamp+60,price:100.2}];
 act(()=>{root=create(<StockPriceChart longTerm name="Hourly stock" forecast={{...forecast,issue:'Awaiting validation'}} history={history} now={history.at(-1)!.timestamp+10}/>);});
 const line=root!.root.findByProps({className:'market-observed'}).props.d as string;
 expect((line.match(/ L/g)??[])).toHaveLength(24);
 const svg=root!.root.findByType('svg');
 act(()=>svg.props.onKeyDown({key:'Home',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $100.00');
 act(()=>svg.props.onKeyDown({key:'End',preventDefault(){}}));
 expect(root!.root.findAllByType('strong').map(n=>n.children.join('')).join(' ')).toContain('Observed price: $100.20');
});
it('leaves genuine missing hours disconnected in the line and shaded area',()=>{
 const start=1794000000,history=[0,1,4,5].map((h,i)=>({timestamp:start+h*3600,price:100+i}));
 act(()=>{root=create(<StockPriceChart longTerm name="Gapped stock" forecast={{...forecast,issue:'Awaiting validation'}} history={history} now={history.at(-1)!.timestamp+10}/>);});
 expect((root!.root.findByProps({className:'market-observed'}).props.d.match(/ L/g)??[])).toHaveLength(2);
 const area=root!.root.findAllByType('path').find(p=>p.props.fill?.startsWith('url('))!;
 expect((area.props.d.match(/ Z/g)??[])).toHaveLength(2);
});
