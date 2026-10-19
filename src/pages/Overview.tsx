import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { DEMO_NEXT, DEMO_WIDGETS } from "../demoData";

export default function Overview({ demo = true }: { demo?: boolean }) {
  const query = useQuery({
    queryKey: ["overview"],
    enabled: !demo,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "refresh-live-data",
        { body: { feed_type: "overview" } },
      );
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      return data;
    },
  });
  if (!demo) {
    const payload = query.data?.payload;
    return (
      <section>
        <h2>Overview</h2>
        <p>
          Source: official API · Requires permissions for the selected bars,
          cooldowns, travel, battle stats and personal stats.
        </p>
        {query.error && <p role="alert">{query.error.message}</p>}
        <button
          className="nu-btn"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh overview"}
        </button>
        {payload ? (
          <>
            <p>
              Last successful update:{" "}
              {new Date(query.data.fetched_at).toLocaleString()} ·{" "}
              {Date.now() - Date.parse(query.data.fetched_at) > 60000
                ? "Stale"
                : "Recent observation"}
            </p>
            <div className="grid">
              {Object.entries(payload)
                .filter(([name]) => name !== "_metadata")
                .map(([name, value]) => (
                  <article key={name} className="card">
                    <h3>{name}</h3>
                    <pre style={{ whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </article>
                ))}
            </div>
          </>
        ) : (
          <p>No live data yet. Link your key in Settings.</p>
        )}
      </section>
    );
  }

  return (
    <section>
      <h2>Overview</h2>
      <div className="grid">
        {DEMO_WIDGETS.map((w) => (
          <article key={w.title} className="card nu-raised">
            <h3>{w.title}</h3>
            <p className="value">{w.value}</p>
            <p className="muted">{w.note}</p>
            <div className="meta">
              <span className="badge">Source: {w.source}</span>
              <span className="badge">Updated: {w.updated}</span>
              <span className={`badge ${w.stale ? "warn" : "ok"}`}>
                {w.stale ? "⚠ Stale" : "✓ Fresh"}
              </span>
              <span className="badge">Needs: {w.permission}</span>
            </div>
          </article>
        ))}
      </div>
      <article className="card nu-inset">
        <h3>
          What should I do next? <span className="badge">advisory</span>
        </h3>
        <ul>
          {DEMO_NEXT.map((n) => (
            <li key={n.text}>
              <strong>{n.text}</strong>
              <br />
              <span className="muted">Inputs: {n.why}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
