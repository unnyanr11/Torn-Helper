import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
export default function StatIntelligence() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      supabase
        .from("estimates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("spy_reports")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(100),
    ]).then(([estimates, spies]) => {
      const failure = estimates.error ?? spies.error;
      if (failure) {
        setError(failure.message);
        return;
      }
      setRows(
        [
          ...(estimates.data ?? []),
          ...(spies.data ?? []).map((s) => ({
            id: s.id,
            torn_player_id: s.target_torn_id,
            source: "Manually imported spy report (import timestamp)",
            estimate_type: "spy_report",
            created_at: s.reported_at,
            confidence: "Unverified manual evidence",
            value: {
              strength: s.strength,
              defense: s.defense,
              speed: s.speed,
              dexterity: s.dexterity,
              total: s.total,
            },
          })),
        ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
      );
    });
  }, []);
  return (
    <section>
      <h2>Stat Intelligence</h2>
      <p>
        Authorized evidence only. Player level and activity cannot establish
        battle-stat totals. A Fair Fight value does not reveal an exact total or
        four-stat distribution.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <article className="card" key={r.id}>
          <h3>Player {r.torn_player_id}</h3>
          <p>
            Source: {r.source} · Evidence: {r.estimate_type} · Updated{" "}
            {new Date(r.created_at).toLocaleString()}
          </p>
          <p>
            Total: {r.value?.total ?? "Unknown"} · Evidence label:{" "}
            {r.confidence}
          </p>
          <pre>{JSON.stringify(r.value, null, 2)}</pre>
        </article>
      ))}
      {!rows.length && (
        <p>
          No authorized estimates collected. Import permitted reports in Spy
          Reports. Third-party data remains unavailable until terms and
          integration permissions are verified.
        </p>
      )}
    </section>
  );
}
