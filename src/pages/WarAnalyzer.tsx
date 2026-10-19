import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface War {
  id: string;
  name: string;
  analysis: any;
}

export default function WarAnalyzer() {
  const [wars, setWars] = useState<War[]>([]);
  const [selected, setSelected] = useState<War | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("wars")
      .select("id, name, analysis")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setWars(data ?? []);
  }

  async function analyze(war: War) {
    setBusy(true);
    setError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-war`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ war_id: war.id }),
      },
    );
    const json = await res.json();
    setBusy(false);
    if (!res.ok || json.error) {
      setError(json.error ?? "Analysis failed");
      return;
    }
    setSelected({ ...war, analysis: json.analysis });
    load();
  }

  return (
    <section>
      <h2>Rules-based War Analyzer</h2>
      <p className="muted">
        Runs heuristic analysis over a war's targets and observations: coverage,
        online rate, most/least active targets, and plain-language insights.
        Results are stored on the war record.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        {wars.map((w) => (
          <article key={w.id} className="card nu-inset">
            <h3>{w.name}</h3>
            {w.analysis && (
              <div>
                <p className="muted">
                  Last analyzed:{" "}
                  {new Date(w.analysis.generated_at).toLocaleString()}
                </p>
                <p>{w.analysis.insights?.join(" ")}</p>
                <p className="muted">
                  Coverage: {Math.round((w.analysis.coverage ?? 0) * 100)}% ·
                  Online rate: {Math.round((w.analysis.online_rate ?? 0) * 100)}
                  %
                </p>
              </div>
            )}
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => analyze(w)}
            >
              {busy ? "Analyzing…" : "Run analysis"}
            </button>
          </article>
        ))}
        {wars.length === 0 && (
          <p className="muted">No wars yet. Create one in the War Room.</p>
        )}
      </div>
      {selected?.analysis && (
        <article className="card nu-raised">
          <h3>Latest analysis — {selected.name}</h3>
          <ul>
            {selected.analysis.insights?.map((i: string, idx: number) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
