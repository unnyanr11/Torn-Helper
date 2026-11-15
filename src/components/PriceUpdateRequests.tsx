import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { foreignPricesKey, useForeignShopPrices } from '../hooks/useForeignShopPrices';
import { useCurrentObservations } from '../hooks/useSavedObservations';
import { validatePriceScreenshot, parsePurchasePrice } from '../lib/price-update';
import './price-update.css';
type RequestRow={id:string;country:string;shop:string;item_id:number;proposed_price:number;old_price:number;observed_on:string;notes:string;screenshot_path:string;status:string;created_at:string;review_note:string;applied_price:number|null};
const money=(n:number)=>`$${Number(n).toLocaleString()}`;
const errorText=(e:unknown)=>e&&typeof e==='object'&&'message' in e?String(e.message):'Unable to complete request. Please try again.';
export default function PriceUpdateRequests({country,itemId}:{country:string;itemId?:number}){
 const {owner}=useCurrentObservations(),client=useQueryClient(),references=useForeignShopPrices();
 const options=references.prices.filter(p=>p.country===country);
 const [selection,setSelection]=useState(()=>{const i=options.find(p=>p.id===itemId);return i?`${i.shop}:${i.id}`:'';});
 const chosen=options.find(p=>`${p.shop}:${p.id}`===selection);
 const [price,setPrice]=useState(''),[observed,setObserved]=useState(new Date().toISOString().slice(0,10)),[notes,setNotes]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[isError,setIsError]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const reviewer=useQuery({queryKey:['price-reviewer',owner],enabled:!!owner,retry:false,queryFn:async()=>{const r=await supabase.rpc('is_foreign_price_reviewer');if(r.error)throw r.error;return r.data===true;}});
 const history=useQuery({queryKey:['price-requests',owner],enabled:!!owner,retry:false,queryFn:async()=>{const r=await supabase.from('foreign_price_requests').select('*').eq('user_id',owner!).order('created_at',{ascending:false}).limit(25);if(r.error)throw r.error;return r.data as RequestRow[];}});
 async function send(){
  setBusy(true);setMessage('');setIsError(false);
  let draft:RequestRow|undefined;
  try{
   if(!owner||!chosen||!file)throw new Error('Choose an item and attach its shop screenshot.');
   const value=parsePurchasePrice(price),extension=await validatePriceScreenshot(file);
   const r=await supabase.rpc('begin_foreign_price_request',{p_country:country,p_shop:chosen.shop,p_item_id:chosen.id,p_price:value,p_observed_on:observed,p_notes:notes.trim(),p_extension:extension});
   if(r.error)throw r.error;draft=r.data as RequestRow;
   const upload=await supabase.storage.from('foreign-price-evidence').upload(draft.screenshot_path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;
   const submit=await supabase.rpc('submit_foreign_price_request',{p_request:draft.id});if(submit.error)throw submit.error;
   setPrice('');setNotes('');setFile(null);if(input.current)input.current.value='';
   setMessage('Request sent. The owner will check your screenshot before changing the saved price.');
  }catch(e){setIsError(true);setMessage(errorText(e)+(draft?' If the screenshot uploaded, use “Submit uploaded draft” below to retry.':''));}
  finally{setBusy(false);void client.invalidateQueries({queryKey:['price-requests',owner]});}
 }
 async function retryDraft(id:string){setBusy(true);try{const r=await supabase.rpc('submit_foreign_price_request',{p_request:id});if(r.error)throw r.error;setIsError(false);setMessage('Request submitted for review.');}catch(e){setIsError(true);setMessage(errorText(e));}finally{setBusy(false);void history.refetch();}}
 return <details className="card price-updates"><summary>Request a price update / review submissions</summary>
  <h3>Spotted a different shop price?</h3>
  <p>Send a price update for {country}. It stays pending until the owner manually checks the screenshot. This updates purchase-price references, not live stock or market sale prices.</p>
  <p>PNG, JPG or WebP, up to 5 MB. Show the destination, shop, item and purchase price. Crop out API keys, chat and personal details. Screenshots and notes are private to you and appointed reviewers; they are retained with the review history. Only an approved price, its date and source label become shared.</p>
  <form onSubmit={e=>{e.preventDefault();void send();}}>
   <label>Shop and item<select required className="nu-input" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">Choose an item…</option>{options.map(p=><option key={`${p.shop}:${p.id}`} value={`${p.shop}:${p.id}`}>{p.shop} · {p.name}</option>)}</select></label>
   {chosen&&<p>Current saved purchase price: {money(chosen.buy_price)} · observed {chosen.observed_on}</p>}
   <label>Updated purchase price ($)<input className="nu-input" required type="number" min="0" max="100000000000000" step="1" value={price} onChange={e=>setPrice(e.target.value)}/></label>
   <label>Date observed<input className="nu-input" required type="date" value={observed} max={new Date().toISOString().slice(0,10)} onChange={e=>setObserved(e.target.value)}/></label>
   <label>Screenshot<input ref={input} required type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
   <label>Notes (optional)<textarea className="nu-input" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <button type="submit" className="nu-btn" disabled={busy||!owner||references.isError}>{busy?'Sending…':'Send price update request'}</button>
   <p>Limit: 5 requests per 24 hours. Use evidence from the last 30 days.</p>
  </form>
  {message&&<p role={isError?'alert':'status'}>{message}</p>}
  {references.isError&&<p role="alert">Current saved prices could not load. Refresh before submitting.</p>}
  <details><summary>My requests (latest 25)</summary><button type="button" className="nu-btn" onClick={()=>void history.refetch()}>Refresh requests</button>
   {history.isError&&<p role="alert">Unable to load your requests.</p>}
   {history.isPending?<p>Loading requests…</p>:!history.data?.length?<p>No requests yet.</p>:history.data.map(r=><article key={r.id}><p>{r.country} · {references.prices.find(p=>p.id===r.item_id)?.name??r.item_id} · {money(r.proposed_price)} · <strong>{r.status}</strong></p>{r.applied_price!==null&&<p>Applied price: {money(r.applied_price)}</p>}{r.review_note&&<p>Reviewer: {r.review_note}</p>}{r.status==='draft'&&<button className="nu-btn" type="button" disabled={busy} onClick={()=>void retryDraft(r.id)}>Submit uploaded draft</button>}</article>)}
  </details>
  {reviewer.data===true&&<PriceReviewQueue owner={owner!}/>}
 </details>;
}
function PriceReviewQueue({owner}:{owner:string}){
 const client=useQueryClient(),[offset,setOffset]=useState(0);
 const queue=useQuery({queryKey:['price-review-queue',owner,offset],queryFn:async()=>{const r=await supabase.from('foreign_price_requests').select('*').eq('status','pending').order('created_at').range(offset,offset+19);if(r.error)throw r.error;return r.data as RequestRow[];},retry:false});
 async function refresh(){setOffset(0);await Promise.all([client.invalidateQueries({queryKey:foreignPricesKey}),client.invalidateQueries({queryKey:['price-review-queue']}),client.invalidateQueries({queryKey:['price-requests']})]);}
 return <section><h3>Owner price review queue</h3><p>Inspect the screenshot before approving. You may correct the submitted price. Approval immediately updates the shared reference; fetched Torn prices still take precedence.</p>
  <button type="button" className="nu-btn" onClick={()=>void queue.refetch()}>Refresh review queue</button>
  {queue.isError?<p role="alert">Unable to load pending requests.</p>:queue.isPending?<p>Loading queue…</p>:queue.data?.length?queue.data.map(r=><PriceReview key={r.id} row={r} onReviewed={refresh}/>):<p>No pending requests.</p>}
  <button type="button" className="nu-btn" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Previous</button><button type="button" className="nu-btn" disabled={(queue.data?.length??0)<20} onClick={()=>setOffset(n=>n+20)}>Next</button>
 </section>;
}
function PriceReview({row,onReviewed}:{row:RequestRow;onReviewed:()=>Promise<void>}){
 const [url,setUrl]=useState(''),[seen,setSeen]=useState(false),[price,setPrice]=useState(String(row.proposed_price)),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const {prices}=useForeignShopPrices(),ref=prices.find(p=>p.country===row.country&&p.shop===row.shop&&p.id===row.item_id);
 async function view(){try{setSeen(false);const r=await supabase.storage.from('foreign-price-evidence').createSignedUrl(row.screenshot_path,300);if(r.error)throw r.error;setUrl(r.data.signedUrl);}catch(e){setMessage(errorText(e));}}
 async function decide(approve:boolean){setBusy(true);setMessage('');try{const r=await supabase.rpc('review_foreign_price_request',{p_request:row.id,p_approve:approve,p_price:approve?parsePurchasePrice(price):null,p_note:note.trim()});if(r.error)throw r.error;await onReviewed();}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 return <article className="price-review"><h4>{row.country} · {row.shop} · {ref?.name??row.item_id}</h4><p>Saved when submitted: {money(row.old_price)} · proposed: {money(row.proposed_price)} · observed: {row.observed_on}</p><p>Current reference: {ref?money(ref.buy_price):'Unavailable'} · submitted {new Date(row.created_at).toLocaleString()}</p><p>{row.notes||'No submitter notes.'}</p>
  <button type="button" className="nu-btn" onClick={()=>void view()}>View / refresh private screenshot</button>
  {url&&<img className="price-evidence" src={url} alt={`Submitted ${row.country} shop price evidence`} referrerPolicy="no-referrer" onLoad={()=>setSeen(true)} onError={()=>{setSeen(false);setMessage('Screenshot could not load. Refresh its private link.');}}/>}
  <label>Price to apply ($)<input className="nu-input" type="number" min="0" step="1" max="100000000000000" value={price} onChange={e=>setPrice(e.target.value)}/></label>
  <label>Review note<textarea className="nu-input" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button type="button" className="nu-btn" disabled={busy||!seen} onClick={()=>void decide(true)}>Approve and apply price</button><button type="button" className="nu-btn" disabled={busy} onClick={()=>void decide(false)}>Reject request</button>
  {message&&<p role="alert">{message}</p>}
 </article>;
}
