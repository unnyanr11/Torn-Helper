import type {WarAlertPreferences} from './war-targets';
let context:AudioContext|undefined;
export async function unlockWarSound(){if(typeof AudioContext==='undefined')return;context??=new AudioContext();if(context.state==='suspended')await context.resume();}
export async function playWarSound(preferences:WarAlertPreferences){
 if(preferences.sound==='off'||preferences.volume<=0)return;
 try{
  await unlockWarSound();if(!context||context.state!=='running')return;
  for(let i=0;i<(preferences.sound==='double'?2:1);i++){
   const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+i*0.3;
   oscillator.frequency.value=preferences.sound==='soft'?660:880;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(preferences.volume*0.2,start+0.02);gain.gain.exponentialRampToValueAtTime(0.001,start+0.22);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+0.23);
  }
 }catch{/* Browser audio restrictions never prevent the visible alert. */}
}
