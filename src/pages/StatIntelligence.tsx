import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
export default function StatIntelligence() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void supabase
      .from("estimates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data ?? []);
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
