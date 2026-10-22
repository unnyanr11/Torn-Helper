import DataEntry from "../components/DataEntry";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import SavedPresets from "../components/SavedPresets";
interface Settings {
  version: number;
  metric: string;
  period: string;
  start: string;
  end: string;
  track: string;
  limit: string;
}
const initial: Settings = {
  version: 1,
  metric: "gym",
  period: "30",
  start: "",
  end: "",
  track: "",
  limit: "10",
};
const metrics = ["gym", "racing", "payouts"],
  periods = ["7", "30", "90", "365", "all", "custom"];
export default function Leaderboards() {
  const [settings, setSettings] = useState(initial);
  const { metric, period, start, end, track, limit } = settings;
  const patch = (key: keyof Settings, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const rankings = useQuery({
    queryKey: ["leaderboard", settings],
    queryFn: async () => {
      if (period === "custom" && (!start || !end || start > end))
        throw new Error("Choose a valid start and end date.");
      const since =
        period === "all"
          ? null
          : period === "custom"
            ? start
            : new Date(Date.now() - Number(period) * 86400000)
                .toISOString()
                .slice(0, 10);
      const until = period === "custom" ? end + "T23:59:59.999Z" : null;
      const all: any[] = [];
      for (let offset = 0; offset < 50000; offset += 500) {
        let q: any;
        if (metric === "gym") {
          q = supabase
            .from("gym_sessions")
            .select(
              "id,user_id,strength_gain,defense_gain,speed_gain,dexterity_gain,session_date",
            )
            .order("id");
          if (since) q = q.gte("session_date", since);
          if (until) q = q.lte("session_date", end);
        } else if (metric === "racing") {
          q = supabase
            .from("racing_records")
            .select("id,user_id,track_name,time_ms,raced_at")
            .order("id")
            .not("time_ms", "is", null);
          if (since) q = q.gte("raced_at", since);
          if (until) q = q.lte("raced_at", until);
          if (track.trim()) q = q.eq("track_name", track.trim());
        } else {
          q = supabase
            .from("payout_lines")
            .select(
              "id,member_name,amount_owed_cents,payout_runs!inner(status,created_at)",
            )
            .order("id")
            .in("payout_runs.status", ["approved", "paid", "reconciled"]);
          if (since) q = q.gte("payout_runs.created_at", since);
          if (until) q = q.lte("payout_runs.created_at", until);
        }
        const r = await q.range(offset, offset + 499);
        if (r.error) throw r.error;
        all.push(...r.data);
        if (r.data.length < 500) break;
        if (offset === 49500)
          throw new Error(
            "More than 50,000 records match. Choose a narrower period.",
          );
      }
      const groups = new Map<
        string,
        { name: string; value: number; track: string }
      >();
      for (const r of all) {
        if (metric === "racing" && !(Number(r.time_ms) > 0)) continue;
        const name = metric === "payouts" ? r.member_name : r.user_id;
        const key = metric === "racing" ? `${name}:${r.track_name}` : name;
        const value =
          metric === "gym"
            ? [
                "strength_gain",
                "defense_gain",
                "speed_gain",
                "dexterity_gain",
              ].reduce((s, k) => s + Number(r[k] ?? 0), 0)
            : metric === "racing"
              ? Number(r.time_ms) / 1000
              : Number(r.amount_owed_cents ?? 0) / 100;
        const old = groups.get(key);
        groups.set(key, {
          name,
          value:
            metric === "racing"
              ? Math.min(old?.value ?? Infinity, value)
              : (old?.value ?? 0) + value,
          track: r.track_name ?? "",
        });
      }
      const rows = [...groups.values()].sort((a, b) =>
        metric === "racing"
          ? a.track.localeCompare(b.track) ||
            a.value - b.value ||
            a.name.localeCompare(b.name)
          : b.value - a.value || a.name.localeCompare(b.name),
      );
      // Each track is its own population: times on different tracks are never compared.
      const counts = new Map<string, number>(),
        last = new Map<string, { value: number; rank: number }>();
      return {
        records: all.length,
        rows: rows.flatMap((r) => {
          const group = metric === "racing" ? r.track : "";
          const n = (counts.get(group) ?? 0) + 1;
          counts.set(group, n);
          const previous = last.get(group);
          const rank = previous?.value === r.value ? previous.rank : n;
          last.set(group, { value: r.value, rank });
          return n <= Number(limit) ? [{ ...r, rank }] : [];
        }),
      };
    },
  });
  return (
    <section>
      <h2>Leaderboards</h2>
      <p>
        Population: only records you are authorized to read. Gym and racing
        currently cover your own tracking; payout rankings compare members in
        your approved payout runs. Preview and locked runs are excluded. These
        are not global Torn rankings.
      </p>
      <SavedPresets
        kind="leaderboard"
        config={settings}
        onLoad={(c) => {
          if (
            c?.version !== 1 ||
            !metrics.includes(c.metric) ||
            !periods.includes(c.period) ||
            !["10", "25", "50"].includes(c.limit) ||
            ["start", "end", "track"].some((k) => typeof c[k] !== "string")
          )
            throw new Error("Invalid leaderboard preset");
          setSettings(c);
        }}
      />
      <label>
        Metric
        <select
          className="nu-input"
          value={metric}
          onChange={(e) => patch("metric", e.target.value)}
        >
          <option value="gym">Total gym gains</option>
          <option value="racing">Best racing time by track</option>
          <option value="payouts">Approved payout allocation</option>
        </select>
      </label>
      <label>
        Period
        <select
          className="nu-input"
          value={period}
          onChange={(e) => patch("period", e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {p === "all"
                ? "All recorded history"
                : p === "custom"
                  ? "Custom dates"
                  : p + " days"}
            </option>
          ))}
        </select>
      </label>
      {period === "custom" && (
        <>
          <label>
            From
            <input
              className="nu-input"
              type="date"
              value={start}
              onChange={(e) => patch("start", e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              className="nu-input"
              type="date"
              value={end}
              onChange={(e) => patch("end", e.target.value)}
            />
          </label>
        </>
      )}
      {metric === "racing" && (
        <label>
          Exact track (blank for separate rankings for every track)
          <DataEntry source="track" label="Track (optional)"
            className="nu-input"
            value={track}
            onChange={(e) => patch("track", e.target.value)}
          />
        </label>
      )}
      <label>
        Rows per ranking
        <select
          className="nu-input"
          value={limit}
          onChange={(e) => patch("limit", e.target.value)}
        >
          {[10, 25, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      {rankings.isLoading && <p>Loading…</p>}
      {rankings.error && <p role="alert">{(rankings.error as any).message}</p>}
      {rankings.data && (
        <>
          <p>
            {rankings.data.records} source records. Payout periods use run
            creation date; the value is allocation, rather than proof of
            payment.
          </p>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member / tracked account</th>
                {metric === "racing" && <th>Track</th>}
                <th>
                  {metric === "gym"
                    ? "Gains"
                    : metric === "racing"
                      ? "Seconds"
                      : "Allocation ($)"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rankings.data.rows.map((r) => (
                <tr key={r.name + ":" + r.track}>
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  {metric === "racing" && <td>{r.track}</td>}
                  <td>
                    {r.value.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rankings.data.rows.length && (
            <p>No authorized data in this period.</p>
          )}
        </>
      )}
    </section>
  );
}
