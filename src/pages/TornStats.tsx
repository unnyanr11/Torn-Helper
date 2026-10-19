import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import SpyReports from "./SpyReports";
interface Connection {
  id: string;
  provider: string;
  status: string;
  connected_at: string;
}
export default function TornStats() {
  const [connection, setConnection] = useState<Connection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase
      .from("integration_connections")
      .select("id,provider,status,connected_at")
      .eq("provider", "tornstats")
      .maybeSingle()
      .then((r) => {
        if (r.error) setError(r.error.message);
        else setConnection(r.data);
      });
  }, []);
  async function remove() {
    if (!connection) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase
        .from("integration_connections")
        .delete()
        .eq("id", connection.id);
      if (r.error) throw r.error;
      setConnection(null);
    } catch (e) {
      setError((e as any).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>TornStats Integration</h2>
      <p role="status">
        Live TornStats access is unavailable until provider access, data rights,
        encrypted credential handling and response validation are configured.
        This app does not collect TornStats tokens.
      </p>
      {error && <p role="alert">{error}</p>}
      {connection && (
        <article className="card">
          <p>
            Legacy connection record: {connection.status}. This record does not
            establish a verified connection.
          </p>
          <button className="nu-btn" disabled={busy} onClick={remove}>
            Remove legacy connection and stored token
          </button>
        </article>
      )}
      <p>
        Use the validated manual importer below for reports you are authorized
        to retain. This does not verify a report with TornStats.
      </p>
      <SpyReports />
    </section>
  );
}
