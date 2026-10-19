import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import KeyDisclosure from "../components/KeyDisclosure";
import { functionError } from "../lib/function-error";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
export default function Overview() {
  const client = useQueryClient();
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function refreshWithKey() {
    const supplied = key;
    setKey("");
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "refresh-live-data",
        { body: { feed_type: "overview", apiKey: supplied } },
      );
      if (error || data?.error) throw await functionError(data, error);
      client.setQueryData(["overview"], data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }
  const query = useQuery({
    queryKey: ["overview"],
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "refresh-live-data",
        { body: { feed_type: "overview" } },
      );
      if (error || data?.error) throw await functionError(data, error);
      return data;
    },
  });
  const payload = query.data?.payload;
  return (
    <section>
      <h2>Overview</h2>
      <p>
        Source: official Torn API. Uses your stored key or a request-only key.
        Each available section is shown independently. Battle stats require
        Limited access; Custom keys need the corresponding selections.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      {message && <p role="alert">{message}</p>}
      <details>
        <summary>Refresh with a request-only Torn key</summary>
        <KeyDisclosure persist={false} />
        <p>
          Your key is sent for this refresh only, then discarded. Observed game
          data is saved to your private workspace; history is collected only
          when you opt in.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void refreshWithKey();
          }}
        >
          <label>
            Torn API key
            <input
              className="nu-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={16}
              maxLength={16}
              value={key}
              onChange={(e) => setKey(e.target.value.trim())}
            />
          </label>
          <button
            className="nu-btn"
            disabled={
              busy || query.isFetching || !/^[A-Za-z0-9]{16}$/.test(key)
            }
          >
            {busy ? "Refreshing…" : "Use key for this refresh"}
          </button>
        </form>
      </details>
      <button
        className="nu-btn"
        disabled={query.isFetching || busy}
        onClick={() => query.refetch()}
      >
        {query.isFetching ? "Refreshing…" : "Refresh overview"}
      </button>
      {query.isLoading && <p role="status">Loading your account data…</p>}
      {Array.isArray(payload?._warnings) &&
        payload._warnings.map((warning: string) => (
          <p role="status" key={warning}>
            {warning}
          </p>
        ))}
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
              .filter(([name]) => !name.startsWith("_"))
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
            No observations available. Use a request-only key above or store an
            encrypted key in <a href="#Settings">Settings</a>, then refresh. No
            game values are shown until they are collected.
          </p>
        )
      )}
    </section>
  );
}
