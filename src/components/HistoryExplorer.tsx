import { functionError } from "../lib/function-error";
import TornConnectionPanel from "./TornConnectionPanel";
import DateWindowPicker from "./DateWindowPicker";
import { defaultWindow,dateBounds } from "../lib/date-window";
import { useTornConnection } from "../hooks/useTornConnection";
import { invokeTornData } from "../lib/torn-data-client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { historySummary } from "../lib/history";
import { toCsv, downloadBlob } from "../lib/export";
export default function HistoryExplorer() {
  const client = useQueryClient();
  const connection=useTornConnection();
  const [window,setWindow]=useState(defaultWindow),[mode,setMode]=useState("stored"),[key,setKey]=useState("");
  let bounds:ReturnType<typeof dateBounds>={},rangeError="";try{bounds=dateBounds(window);}catch(e){rangeError=(e as Error).message;}
  const [metric, setMetric] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const prefs = useQuery({
    queryKey: ["history-preference",connection.owner],
    enabled:!!connection.owner,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user||user.id!==connection.owner) throw new Error("Sign in to view history for this account.");
      const r = await supabase
        .from("profiles")
        .select("history_enabled,tracking_paused")
        .eq("id", user.id)
        .single();
      if (r.error) throw r.error;
      return { ...r.data, userId: user.id };
    },
  });
  const history = useQuery({
    queryKey: ["personal-history",connection.owner,window],
    enabled:!!connection.owner&&!rangeError,
    queryFn: async () => {
      const rows: any[] = [];
      for (let offset = 0; offset < 20000; offset += 500) {
        let q = supabase
          .from("personal_stat_snapshots")
          .select("id,captured_at,stat_values,source")
          .eq("user_id",connection.owner!)
          .order("captured_at")
          .order("id");
        if(bounds.from)q=q.gte('captured_at',bounds.from);
        if(bounds.to)q=q.lt('captured_at',bounds.to);
        const r = await q.range(offset, offset + 499);
        if (r.error) throw r.error;
        rows.push(...r.data);
        if (r.data.length < 500) return rows;
      }
      throw new Error(
        "More than 20,000 observations match. Choose a shorter window.",
      );
    },
  });
  const started = useQuery({
    queryKey: ["personal-history-start",connection.owner],
    enabled:!!connection.owner,
    queryFn: async () => {
      const r = await supabase
        .from("personal_stat_snapshots")
        .select("captured_at")
        .eq("user_id",connection.owner!)
        .order("captured_at")
        .limit(1);
      if (r.error) throw r.error;
      return r.data[0]?.captured_at ?? null;
    },
  });
  async function toggle() {
    if (!prefs.data) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await supabase
        .from("profiles")
        .update({ history_enabled: !prefs.data.history_enabled })
        .eq("id", prefs.data.userId);
      if (r.error) throw r.error;
      await client.invalidateQueries({ queryKey: ["history-preference",connection.owner] });
    } catch (e) {
      setMessage((e as any).message);
    } finally {
      setBusy(false);
    }
  }
  async function collect() {
    setBusy(true);
    setMessage("");
    try {
      const secret=mode==='request'?key:undefined;setKey('');
      const r = await invokeTornData(client,{body:{endpoint_id:'v2-user-personalstats',parameters:{cat:'all'},...(secret?{apiKey:secret}:{})}});
      if (r.error || r.data?.error) throw await functionError(r.data, r.error);
      setMessage(
        r.data.cached
          ? "Personal-stat cache is still fresh. Try again after 60 seconds to collect a new observation."
          : r.data.history_recorded
            ? "Observation recorded."
            : "No new numeric observation was recorded. Check the collection preference, key permissions and tracking pause.",
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: ["personal-history"] }),
        client.invalidateQueries({ queryKey: ["personal-history-start",connection.owner] }),
      ]);
    } catch (e) {
      setMessage((e as any).message);
    } finally {
      setBusy(false);
    }
  }
  const keys = [
      ...new Set<string>(
        (history.data ?? []).flatMap((r) => Object.keys(r.stat_values)),
      ),
    ].sort(),
    active = keys.includes(metric) ? metric : (keys[0] ?? "");
  const summary = historySummary(
    (history.data ?? [])
      .filter((r) => typeof r.stat_values[active] === "number")
      .map((r) => ({ time: r.captured_at, value: r.stat_values[active] })),
  );
  const err = (prefs.error ?? history.error ?? started.error) as any;
  return (
    <article className="card">
      <h3>Collected personal-stat history</h3>
      <p>
        Official API observations collected on successful overview or all-personal-stat refreshes
        after you opt in. There is no background schedule or backfill. Private
        battle and personal stats stay owner-only. Missing fields and periods
        stay unknown.
      </p>
      <p>
        Collection began:{" "}
        {started.data
          ? new Date(started.data).toLocaleString()
          : "No observations yet"}{" "}
        ·{" "}
        {prefs.data?.tracking_paused
          ? "Tracking paused"
          : prefs.data?.history_enabled
            ? "Collection enabled"
            : "Collection disabled"}
      </p>
      <button
        className="nu-btn"
        disabled={busy || !prefs.data}
        onClick={toggle}
      >
        {prefs.data?.history_enabled
          ? "Disable new collection"
          : "Enable personal history collection"}
      </button>
      <TornConnectionPanel mode={mode} onMode={setMode} keyValue={key} onKey={setKey} disabled={busy}/>
      <button
        className="nu-btn"
        disabled={
          busy || !prefs.data?.history_enabled || prefs.data?.tracking_paused || mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key) || mode==='stored'&&connection.status.data?.hasStoredKey===false
        }
        onClick={collect}
      >
        {busy ? "Working…" : "Collect personal stats"}
      </button>
      {message && <p role="status">{message}</p>}
      {err && <p role="alert">{err.message}</p>}
      <DateWindowPicker value={window} onChange={setWindow}/>
      {rangeError&&<p role="alert">{rangeError}</p>}
      {(!prefs.data?.history_enabled||prefs.data?.tracking_paused)&&<p>Enable history collection and resume tracking in Settings before collecting new values.</p>}
      <label>
        Observed metric path
        <select
          className="nu-input"
          value={active}
          onChange={(e) => setMetric(e.target.value)}
        >
          {keys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      {history.isLoading ? (
        <p>Loading…</p>
      ) : !summary.points.length ? (
        <p>No collected values in this window.</p>
      ) : (
        <>
          <p>
            {summary.points.length} observations for this field. Source:
            official API. Path retains the endpoint's unit; counters and current
            balances have different meanings.
          </p>
          <p>
            First observed {summary.first.time} ={" "}
            {summary.first.value.toLocaleString()} · last observed{" "}
            {summary.last.time} = {summary.last.value.toLocaleString()}
          </p>
          <p>
            Change between available observations:{" "}
            {summary.delta === null
              ? "Unknown"
              : summary.delta.toLocaleString()}{" "}
            (
            {summary.percent === null
              ? "percentage unavailable"
              : summary.percent.toFixed(2) + "%"}
            ). This does not establish the exact change over the requested
            window.
          </p>
          <HistoryChart points={summary.points} />
          <p>
            Intervals longer than 24 hours: {summary.gaps.length}. This
            threshold highlights gaps; on-demand collection has no promised
            cadence.
          </p>
          {summary.gaps.map((g) => (
            <p key={g.from}>
              {g.from} → {g.to} ({g.hours.toFixed(1)} hours)
            </p>
          ))}
          <button
            className="nu-btn"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    toCsv(
                      summary.points.map((p) => ({
                        observed_at: p.time,
                        metric: active,
                        value: p.value,
                        source: "official_api",
                      })),
                    ),
                  ],
                  { type: "text/csv" },
                ),
                "personal-stat-history.csv",
              )
            }
          >
            Export selected history CSV
          </button>
          <details>
            <summary>Observation table</summary>
            <table>
              <thead>
                <tr>
                  <th>Observed UTC</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {summary.points.map((p) => (
                  <tr key={p.time}>
                    <td>{p.time}</td>
                    <td>{p.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </article>
  );
}
function HistoryChart({
  points,
}: {
  points: { time: string; value: number }[];
}) {
  if (points.length < 2) return <p>Two observations are needed for a chart.</p>;
  const first = Date.parse(points[0].time),
    duration = Date.parse(points[points.length - 1].time) - first || 1,
    ys = points.map((p) => p.value),
    min = Math.min(...ys),
    range = Math.max(...ys) - min || 1;
  const path = points
    .map(
      (p, i) =>
        `${i === 0 || Date.parse(p.time) - Date.parse(points[i - 1].time) > 86400000 ? "M" : "L"}${10 + ((Date.parse(p.time) - first) / duration) * 580},${170 - ((p.value - min) / range) * 150}`,
    )
    .join(" ");
  return (
    <svg
      role="img"
      aria-label="Observed values plotted by actual observation time; intervals over 24 hours break the line"
      viewBox="0 0 600 190"
      style={{ width: "100%", maxHeight: 240 }}
    >
      <title>Collected observations</title>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p) => (
        <circle
          key={p.time}
          cx={10 + ((Date.parse(p.time) - first) / duration) * 580}
          cy={170 - ((p.value - min) / range) * 150}
          r="3"
          fill="var(--accent)"
        >
          <title>
            {p.time}: {p.value}
          </title>
        </circle>
      ))}
    </svg>
  );
}
