import { useState } from 'react';
import { focusStorageKey,parseFocus,validFocus,type WorkspaceFocus } from '../lib/workspace-focus';
export function useWorkspaceFocus(accountId?:string){
 const [focus,setFocus]=useState<WorkspaceFocus|null>(()=>{try{return accountId?parseFocus(localStorage.getItem(focusStorageKey(accountId))):null;}catch{return null;}});
 const [storageError,setStorageError]=useState(false);
 function choose(value:WorkspaceFocus){
  if(!validFocus(value))return;setFocus(value);
  try{if(accountId)localStorage.setItem(focusStorageKey(accountId),JSON.stringify({version:1,focus:value}));setStorageError(false);}catch{setStorageError(true);}
 }
 return {focus,choose,storageError};
}
