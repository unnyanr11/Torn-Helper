/** A short, local canvas scene. No assets, network requests or perpetual render loop. */
export function startGalaxyFlight(canvas:HTMLCanvasElement,finish:()=>void){
 const context=canvas.getContext('2d',{alpha:false});
 if(!context)return ()=>{};
 let width=0,height=0,frame=0,elapsed=0,last=performance.now(),stopped=false;
 const stars=Array.from({length:window.innerWidth<700?230:480},()=>({x:(Math.random()-.5)*2,y:(Math.random()-.5)*2,z:Math.random(),size:Math.random()*1.1+.35}));
 const galaxy=document.createElement('canvas');galaxy.width=galaxy.height=900;
 const g=galaxy.getContext('2d');
 if(g){
  g.translate(450,450);g.scale(1,.62);g.globalCompositeOperation='lighter';
  const glow=g.createRadialGradient(0,0,0,0,0,370);glow.addColorStop(0,'#e5d9ffb0');glow.addColorStop(.12,'#a88af75a');glow.addColorStop(.5,'#6558cd20');glow.addColorStop(1,'#19144200');g.fillStyle=glow;g.fillRect(-450,-700,900,1400);
  for(let i=0;i<2400;i++){
   const radius=Math.pow(Math.random(),.72)*410,arm=i%4,angle=arm*Math.PI/2+radius*.018+(Math.random()-.5)*.65;
   const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
   g.fillStyle=i%6===0?'#b3e8ff75':i%3===0?'#e9b8ff65':'#9c9dff55';g.beginPath();g.arc(x,y,Math.random()*1.7+.35,0,Math.PI*2);g.fill();
  }
 }
 const resize=()=>{width=window.innerWidth;height=window.innerHeight;const dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);};
 resize();window.addEventListener('resize',resize);
 const draw=(now:number)=>{
  if(stopped)return;
  const dt=Math.min(now-last,40);last=now;
  if(document.visibilityState==='hidden'){frame=requestAnimationFrame(draw);return;}
  elapsed+=dt;const progress=Math.min(elapsed/3400,1),warp=Math.sin(Math.min(1,Math.max(0,(progress-.18)/.7))*Math.PI);
  const cx=width*.5,cy=height*.43;
  context.fillStyle='#050713';context.fillRect(0,0,width,height);
  const haze=context.createRadialGradient(cx,cy,0,cx,cy,Math.max(width,height)*.7);haze.addColorStop(0,'#312459');haze.addColorStop(.35,'#14122e');haze.addColorStop(1,'#050713');context.fillStyle=haze;context.fillRect(0,0,width,height);
  context.save();context.globalAlpha=Math.max(0,1-progress*1.1);context.translate(cx,cy);context.rotate(-.35+progress*.2);const scale=Math.min(width,height)*(.9+progress*3);context.drawImage(galaxy,-scale,-scale,scale*2,scale*2);context.restore();
  for(const star of stars){
   star.z-=dt*(.00006+warp*.00065);if(star.z<.035)star.z=1;
   const depth=Math.max(star.z,.035),scale=Math.min(width,height)*.43;
   const x=cx+star.x/depth*scale,y=cy+star.y/depth*scale;
   if(x<0||x>width||y<0||y>height)continue;
   const tail=Math.min(.24,warp*.1/depth),alpha=Math.min(.8,.18+(1-depth)*.6);
   context.strokeStyle=`rgba(192,209,255,${alpha})`;context.lineWidth=Math.min(2,star.size/depth*.45);context.beginPath();context.moveTo(x,y);context.lineTo(x-(x-cx)*tail,y-(y-cy)*tail-.8);context.stroke();
  }
  if(progress>=1){finish();return;}
  frame=requestAnimationFrame(draw);
 };
 frame=requestAnimationFrame(draw);
 return()=>{stopped=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
}
