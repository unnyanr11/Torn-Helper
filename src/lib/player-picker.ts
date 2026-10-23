import { playerId } from './player-intel';
export function playerInput(value:string){
 const input=value.trim();
 if(/^https?:\/\//i.test(input)){
  try{const url=new URL(input);if(!['torn.com','www.torn.com'].includes(url.hostname)||url.pathname!=='/profiles.php')return input;
   return String(playerId(url.searchParams.get('XID')??url.searchParams.get('ID')??''));
  }catch{return input;}
 }
 return input;
}
