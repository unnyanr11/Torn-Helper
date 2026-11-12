import {useState} from 'react';
import {useTornConnection} from './useTornConnection';
/** Keep explicit choices; otherwise follow this account's retained-key metadata. */
export function useTornKeyMode(){
 const connection=useTornConnection();
 const [choice,setChoice]=useState<{owner:string|null|undefined;mode:string}>();
 const mode=choice&&choice.owner===connection.owner?choice.mode:connection.status.data?.hasStoredKey?'stored':'request';
 return [mode,(mode:string)=>setChoice({owner:connection.owner,mode})] as const;
}
