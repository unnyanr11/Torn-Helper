import {errorRecovery} from '../lib/error-recovery';
export default function RequestProblem({message,onRetry,busy=false}:{message:string;onRetry?:()=>void;busy?:boolean}) {
  return <div className="request-problem" role="alert"><p>{message}</p><p>{errorRecovery(message)}</p>
    {onRetry&&<button type="button" className="nu-btn" disabled={busy} onClick={onRetry}>{busy?'Retrying…':'Retry'}</button>}
    {' '}<a href="#Settings">Check connection</a>
  </div>;
}
