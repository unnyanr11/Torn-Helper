import { describe,it,expect,vi,afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StartupExperience from '../components/StartupExperience';
import SpatialShell from '../components/SpatialShell';
import { startGalaxyFlight } from '../lib/galaxy-flight';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const preference=(reduced=false,seen=false,stored='full')=>{
 vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='tcc-motion'?stored:null});
 vi.stubGlobal('sessionStorage',{getItem:()=>seen?'1':null});
 vi.stubGlobal('window',{matchMedia:()=>({matches:reduced})});
 vi.stubGlobal('matchMedia',()=>({matches:reduced}));
};
describe('cinematic startup with an accessible fallback',()=>{
 it('offers an immediately skippable dialog while preserving the workspace underneath',()=>{
  preference();const html=renderToStaticMarkup(<StartupExperience ready><p>Real workspace</p></StartupExperience>);
  expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');expect(html).toContain('Skip intro');expect(html).toContain('Real workspace');expect(html).toContain('Your workspace is ready');expect(html).not.toContain('<video');
 });
 it('does not replay automatically within the same tab session',()=>{
  preference(false,true);const html=renderToStaticMarkup(<StartupExperience ready><p>Workspace</p></StartupExperience>);expect(html).not.toContain('role="dialog"');expect(html).toContain('Workspace');
 });
 it.each([[true,'full'],[false,'reduced']])('skips the flight for system or saved reduced-motion preferences', (system,stored)=>{
  preference(system,false,stored);expect(renderToStaticMarkup(<StartupExperience ready><p>Workspace</p></StartupExperience>)).not.toContain('role="dialog"');
 });
 it('preserves category navigation and exposes replay and motion controls',()=>{
  preference();const html=renderToStaticMarkup(<SpatialShell page="Overview" signedIn role="user" shared={false} onNavigate={()=>{}}><p>Tools</p></SpatialShell>);
  expect(html).toContain('Replay intro');expect(html).toContain('Reduce motion');expect(html).toContain('tool-category');expect(html).toContain('Skip to content');expect(html).toContain('Tools');
 });
 it('leaves the workspace accessible when preference storage is unavailable',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('Unavailable');}});const html=renderToStaticMarkup(<StartupExperience ready={false}><p>Opening</p></StartupExperience>);expect(html).not.toContain('role="dialog"');expect(html).toContain('Opening');
 });
});
describe('bounded local galaxy renderer',()=>{
 it('finishes the animation, caps pixel density, and releases its resize and frame handlers',()=>{
  let sequence=0;const frames=new Map<number,FrameRequestCallback>();
  const request=vi.fn((callback:FrameRequestCallback)=>{frames.set(++sequence,callback);return sequence;}),cancel=vi.fn((id:number)=>frames.delete(id));
  const add=vi.fn(),remove=vi.fn();
  vi.stubGlobal('requestAnimationFrame',request);vi.stubGlobal('cancelAnimationFrame',cancel);
  vi.stubGlobal('window',{innerWidth:400,innerHeight:800,devicePixelRatio:3,addEventListener:add,removeEventListener:remove});
  const context=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}})} as any,{get:(target,key)=>key in target?target[key]:()=>{}});
  vi.stubGlobal('document',{visibilityState:'visible',createElement:()=>({getContext:()=>context})});vi.spyOn(performance,'now').mockReturnValue(0);
  const canvas={getContext:()=>context,width:0,height:0} as unknown as HTMLCanvasElement,finish=vi.fn(),stop=startGalaxyFlight(canvas,finish);
  expect(canvas.width).toBe(600);expect(canvas.height).toBe(1200);
  for(let step=1;step<240&&frames.size;step++){const [id,callback]=[...frames.entries()][0];frames.delete(id);callback(step*16);}
  expect(finish).toHaveBeenCalledTimes(1);expect(frames.size).toBe(0);stop();expect(remove).toHaveBeenCalledWith('resize',expect.any(Function));expect(cancel).toHaveBeenCalled();
 });
 it('falls back without scheduling a canvas loop when a graphics context is unavailable',()=>{
  const frame=vi.fn();vi.stubGlobal('requestAnimationFrame',frame);const stop=startGalaxyFlight({getContext:()=>null} as unknown as HTMLCanvasElement,()=>{});expect(frame).not.toHaveBeenCalled();expect(()=>stop()).not.toThrow();
 });
});
