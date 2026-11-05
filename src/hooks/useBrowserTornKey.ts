import {useEffect,useState} from 'react';
import {BROWSER_KEY_EVENT,browserKeySlot,readBrowserTornKey,type BrowserTornKey} from '../lib/browser-torn-key';
export function useBrowserTornKey(ownerId:string|null){
 const [state,setState]=useState<{ownerId:string|null;copy:BrowserTornKey|null;error:boolean}>({ownerId:null,copy:null,error:false});
 useEffect(()=>{
  const load=()=>{try{setState({ownerId,copy:ownerId?readBrowserTornKey(localStorage,ownerId):null,error:false});}catch{setState({ownerId,copy:null,error:true});}};
  load();
  const change=(event:Event)=>{if(event.type==='storage'){const e=event as StorageEvent;if(e.key===null||ownerId&&e.key===browserKeySlot(ownerId))load();}else if((event as CustomEvent).detail?.ownerId===ownerId)load();};
  window.addEventListener('storage',change);window.addEventListener(BROWSER_KEY_EVENT,change);
  return()=>{window.removeEventListener('storage',change);window.removeEventListener(BROWSER_KEY_EVENT,change);};
 },[ownerId]);
 // Do not expose the previous account's value for even one render during an account switch.
 return state.ownerId===ownerId?state:{ownerId,copy:null,error:false};
}
