import { PASSWORD_REQUIREMENTS, validNewPassword } from '../../supabase/functions/_shared/password-policy';
import TornKeyHelp from './TornKeyHelp';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import KeyDisclosure from './KeyDisclosure';
import SecretInput from './SecretInput';

type Mode='register'|'email';
export default function AccountRegistration({onSignedIn,initialMode="register"}:{onSignedIn:()=>Promise<void>;initialMode?:Mode}) {
 const [mode,setMode]=useState<Mode>(initialMode),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [username,setUsername]=useState(''),[tornId,setTornId]=useState(''),[apiKey,setApiKey]=useState('');
 const [email,setEmail]=useState(''),[confirmEmail,setConfirmEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[consent,setConsent]=useState(false);
 async function perform(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Unable to complete this request.');}finally{setBusy(false);}}
 async function submit(){
  if(mode==='email'){
   const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});setPassword('');if(error){if(error.code==='email_not_confirmed')throw new Error('For an older pending account, use Continue with Torn once to sign in without an email confirmation link.');throw error;}await onSignedIn();return;
  }
  if(email.trim().toLowerCase()!==confirmEmail.trim().toLowerCase())throw new Error('Email addresses do not match.');
  if(!validNewPassword(password))throw new Error(PASSWORD_REQUIREMENTS);
  if(password!==confirmPassword)throw new Error('Passwords do not match.');
  const credentials={email:email.trim(),password};
  const body={username:username.trim(),tornId,apiKey,email:email.trim(),password,persist:consent};
  setApiKey('');setPassword('');setConfirmPassword('');
  const {data,error}=await supabase.functions.invoke('register-torn',{body});
  if(error||data?.error)throw await functionError(data,error,'Unable to register.');
  const signedIn=await supabase.auth.signInWithPassword(credentials);
  if(signedIn.error){setMode('email');throw new Error('Account created. Automatic sign-in failed; sign in below with your email and password.');}
  await onSignedIn();
 }
 return <article className="card account-registration">
  <div className="registration-tabs" role="group" aria-label="Account access">
   <button className="nu-btn" type="button" aria-pressed={mode==='register'} disabled={busy} onClick={()=>{setMode('register');setMessage('');setPassword('');}}>Create account</button>
   <button className="nu-btn" type="button" aria-pressed={mode==='email'} disabled={busy} onClick={()=>{setMode('email');setMessage('');setPassword('');setConfirmPassword('');setApiKey('');}}>Email sign-in</button>
  </div>
  <h3>{mode==='register'?'Register':'Sign in with email'}</h3>
  <p>{mode==='register'?'Create a new Torn Helper account. Your Torn ID and API key are verified on the server. Already used this website? Continue with Torn below to access your existing account.':'Sign in with your email and password. No confirmation email is required. You can also continue with your Torn key below.'}</p>
  {message&&<p role="status">{message}</p>}
  <form className="registration-form" onSubmit={e=>{e.preventDefault();void perform(submit);}}>
   {mode==='register'&&<>
    <label>Username<input className="nu-input" autoComplete="username" required minLength={3} maxLength={30} pattern={"[A-Za-z0-9_\\-]+"} value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label>Torn ID<input className="nu-input" inputMode="numeric" required pattern="[0-9]+" maxLength={16} value={tornId} onChange={e=>setTornId(e.target.value)} aria-describedby="registration-torn-help"/></label>
    <p id="registration-torn-help">The numeric ID on your Torn profile. The key must belong to this player.</p>
    <SecretInput label="Torn API key" className="nu-input" autoComplete="off" spellCheck={false} required minLength={16} maxLength={16} value={apiKey} onChange={e=>setApiKey(e.target.value.trim())}/>
    <TornKeyHelp/>
   </>}
   <label>Email address<input className="nu-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   {mode==='register'&&<label>Confirm email address<input className="nu-input" type="email" autoComplete="off" required maxLength={254} value={confirmEmail} onChange={e=>setConfirmEmail(e.target.value)}/></label>}
   <SecretInput key={mode} label="Password" className="nu-input" autoComplete={mode==='register'?'new-password':'current-password'} required minLength={mode==='register'?8:undefined} aria-describedby={mode==='register'?'signup-password-requirements':undefined} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
   {mode==='register'&&<>
    <SecretInput label="Confirm password" className="nu-input" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
    <p id="signup-password-requirements">{PASSWORD_REQUIREMENTS} Your username is a display name; sign in with your email address.</p>
    <KeyDisclosure persist requiredBackend/>
    <label className="registration-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to encrypted backend storage of my Torn key for account updates. I can pause tracking, revoke the key in Torn, or delete my account.</label>
   </>}
   <button className="nu-btn" type="submit" disabled={busy}>{busy?'Please wait…':mode==='register'?'Register':'Sign in'}</button>
  </form>
 </article>;
}
