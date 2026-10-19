import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
export default function Overview() {
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "refresh-live-data",
        { body: { feed_type: "overview" } },
      );
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      return data;
    },
  });
  const payload = query.data?.payload;
  return (
    <section>
      <h2>Overview</h2>
      <p>
        Source: official Torn API. Requires a linked key with access to the
        selected bars, cooldowns, travel, battle stats and personal stats.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      <button
        className="nu-btn"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        {query.isFetching ? "Refreshing…" : "Refresh overview"}
      </button>
      {query.isLoading && <p role="status">Loading your account data…</p>}
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
        !query.isLoading && (
          <p>
            No observations available. Link your Torn key in{" "}
            <a href="#Settings">Settings</a>, then refresh. No game values are
            shown until they are collected.
          </p>
        )
      )}
    </section>
  );
}
