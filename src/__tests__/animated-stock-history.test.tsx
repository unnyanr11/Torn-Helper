import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
import {useAnimatedStockHistory} from '../hooks/useAnimatedStockHistory';
import type {PricePoint} from '../lib/stock-forecast';
let root:ReactTestRenderer|undefined;
function Chart({points,identity='stock:1'}:{points:PricePoint[];identity?:string}){const display=useAnimatedStockHistory(points,identity);return <span>{display.map(p=>p.price).join(',')}</span>;}
afterEach(()=>{act(()=>root?.unmount());root=undefined;vi.unstubAllGlobals();});
it('smoothly interpolates changed geometry and cancels frames when another quote arrives',()=>{
 const frames=new Map<number,FrameRequestCallback>();let next=0;
 vi.stubGlobal('document',{documentElement:{dataset:{motion:'full'}}});vi.stubGlobal('matchMedia',()=>({matches:false}));
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++next,fn);return next;});
 const cancel=vi.fn((id:number)=>frames.delete(id));vi.stubGlobal('cancelAnimationFrame',cancel);
 act(()=>{root=create(<Chart points={[{timestamp:60,price:100}]}/>);});
 act(()=>root!.update(<Chart points={[{timestamp:60,price:110},{timestamp:120,price:120}]}/>));
 const tick=(time:number)=>act(()=>{const [id,fn]=[...frames][0];frames.delete(id);fn(time);});
 tick(0);tick(325);expect(root!.root.findByType('span').children.join('')).toBe('108.75,117.5');
 act(()=>root!.update(<Chart points={[{timestamp:60,price:90}]}/>));expect(cancel).toHaveBeenCalled();tick(400);tick(1050);
 expect(root!.root.findByType('span').children.join('')).toBe('90');
});
it('switches stocks immediately and respects reduced motion without scheduling animation',()=>{
 vi.stubGlobal('document',{documentElement:{dataset:{motion:'reduced'}}});
 const raf=vi.fn();vi.stubGlobal('requestAnimationFrame',raf);
 act(()=>{root=create(<Chart points={[{timestamp:60,price:100}]}/>);});
 act(()=>root!.update(<Chart identity="stock:2" points={[{timestamp:60,price:500}]}/>));
 expect(root!.root.findByType('span').children.join('')).toBe('500');expect(raf).not.toHaveBeenCalled();
});
