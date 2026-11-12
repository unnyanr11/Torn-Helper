import {useState} from 'react';
import {warTargetAction} from './WarTargetProvider';
import {warReportSummary,type WarReport,type WarEvent} from '../lib/war-targets';
export default function WarReportPanel(){
 const [data,setData]=useState<{reports:WarReport[];report:WarReport|null;events:WarEvent[];events_partial:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(warKey?:string){setBusy(true);setError('');try{setData(await warTargetAction({action:'report',war_key:warKey}));}catch(e){setError(e instanceof Error?e.message:'Could not load report.');}finally{setBusy(false);}}
 const report=data?.report,summary=report?warReportSummary(report,data?.events??[]):null;
 return <details className="card"><summary>War reports and activity</summary><p>Reports combine your authorized attack history with recorded assignments and observed availability. They do not include private attack history from other members.</p><button className="nu-btn" disabled={busy} onClick={()=>void load()}>Load saved reports</button>
  {data?.reports.length===0&&<p>No recorded war yet. Save a target list during a war to start its history.</p>}
  {data&&data.reports.length>0&&<label>Recorded war<select className="nu-input" disabled={busy} value={report?.war_key??''} onChange={e=>void load(e.target.value)}>{data.reports.map(r=><option key={r.war_key}>{r.war_key}</option>)}</select></label>}
  {report&&summary&&<><p>Window: {new Date(report.war_start*1000).toLocaleString()} → {report.war_end?new Date(report.war_end*1000).toLocaleString():'End time not yet confirmed'}</p><p>Attack coverage: <strong>{report.coverage}</strong>{data?.events_partial?' · History limited to the first 1,000 events':''}</p>
   <button className="nu-btn" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await warTargetAction({action:'report_sync',war_key:report.war_key});await load(report.war_key);}catch(e){setError(e instanceof Error?e.message:'Could not sync attack history.');}finally{setBusy(false);}}}>{report.next_parameters?'Continue attack history':'Sync my war attacks'}</button>
   <div className="war-readiness-grid"><p><strong>{summary.hits}</strong><br/>Recorded completed attacks</p><p><strong>{summary.respect.toFixed(2)}</strong><br/>Recorded respect gained</p><p><strong>{summary.changes}</strong><br/>Assignment changes</p><p><strong>{summary.unhit} / {summary.windows}</strong><br/>Observed available windows without a recorded own attack</p></div>
   <p>Availability windows are sampled observations, not proof that a hit was possible. Missing attack pages can make a window look unhit. Synchronize all pages before judging missed opportunities.</p>
   <table><thead><tr><th>Result</th><th>Count</th></tr></thead><tbody>{Object.entries(summary.results).map(([result,count])=><tr key={result}><td>{result}</td><td>{count}</td></tr>)}</tbody></table>
   <details><summary>Assignment timeline</summary><ul>{data?.events.filter(e=>e.kind==='assignment').map((e,i)=><li key={e.id??i}>{new Date(e.created_at).toLocaleString()} · Changed by Torn [{e.actor_torn_id}] · Targets: {(e.details.after??[]).join(', ')||'None'}</li>)}</ul></details>
   <details><summary>My recorded attacks</summary><table><thead><tr><th>Time</th><th>Target</th><th>Result</th></tr></thead><tbody>{report.attacks.map(a=><tr key={a.id}><td>{new Date(a.ended*1000).toLocaleString()}</td><td>{a.defender}</td><td>{a.result}</td></tr>)}</tbody></table></details>
  </>}{error&&<p role="alert">{error}</p>}
 </details>;
}
