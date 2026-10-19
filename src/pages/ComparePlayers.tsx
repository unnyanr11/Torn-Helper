import { useState } from "react";
import { supabase } from "../lib/supabase";
export default function ComparePlayers() {
  const [input, setInput] = useState(""),
    [days, setDays] = useState("30"),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  async function compare() {
    setError("");
    const ids = [
      ...new Set(
        input
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number),
      ),
    ];
    if (
      ids.length < 2 ||
      ids.length > 5 ||
      ids.some((n) => !Number.isSafeInteger(n) || n <= 0)
    ) {
      setError("Enter 2–5 distinct positive player IDs");
      return;
    }
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
    const [targets, observations, estimates] = await Promise.all([
      supabase
        .from("target_list_entries")
        .select("*")
        .in("torn_player_id", ids),
      supabase
        .from("player_observations")
        .select("*")
        .in("torn_player_id", ids)
        .gte("observed_at", since)
        .order("observed_at", { ascending: false }),
      supabase
        .from("estimates")
        .select("*")
        .in("torn_player_id", ids)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);
    const fail = [targets, observations, estimates].find((r) => r.error);
    if (fail) {
      setError(fail.error!.message);
      return;
    }
    const result = ids.map((id) => {
      const t = targets.data?.find((t) => Number(t.torn_player_id) === id);
      const o =
        observations.data?.filter((o) => Number(o.torn_player_id) === id) ?? [];
      const est = estimates.data?.find((e) => Number(e.torn_player_id) === id);
      return {
        id,
        name: t?.player_name ?? "Unknown",
        level: t?.level ?? null,
        status: o[0]?.status ?? t?.status ?? "Unknown",
        source: est?.source ?? "No evidence",
        total: est?.value?.total ?? null,
        observed: o[0]?.observed_at ?? null,
        samples: o.length,
        online: o.length
          ? o.filter((o) => o.last_action?.toLowerCase() === "online").length /
            o.length
          : null,
      };
    });
    setRows(result);
  }
  const base = rows[0]?.total;
  return (
    <section>
      <h2>Compare Players</h2>
      <p>
        Compares your authorized observations and evidence. Missing values
        remain unknown. Activity rates describe collected samples and may be
        biased.
      </p>
      <input
        aria-label="Player IDs"
        className="nu-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Two to five Torn IDs"
      />
      <label>
        Observation window
        <select
          className="nu-input"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </label>
      <button className="nu-btn" onClick={compare}>
        Compare
      </button>
      {error && <p role="alert">{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {[
                "Player",
                "Level",
                "Status",
                "Stat evidence",
                "Total",
                "Difference from first",
                "Observed online",
                "Samples",
                "Last observation",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.name} [{r.id}]
                </td>
                <td>{r.level ?? "Unknown"}</td>
                <td>{r.status}</td>
                <td>{r.source}</td>
                <td>{r.total ?? "Unknown"}</td>
                <td>
                  {r.total != null && base != null
                    ? `${r.total - base} (${base ? (((r.total - base) / base) * 100).toFixed(1) + "%" : "percentage undefined"})`
                    : "Unknown"}
                </td>
                <td>
                  {r.online == null
                    ? "Unknown"
                    : (r.online * 100).toFixed(1) + "%"}
                </td>
                <td>{r.samples}</td>
                <td>
                  {r.observed
                    ? new Date(r.observed).toLocaleString()
                    : "Unknown"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
