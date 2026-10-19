import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toCsv, toXlsx, downloadBlob } from "../lib/export";

interface Snapshot {
  id: string;
  title: string;
  data: any;
  created_at: string;
}
interface Grant {
  id: string;
  snapshot_id: string;
  token: string;
  expires_at: string;
  revoked: boolean;
}

export default function Reports() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [reportJson, setReportJson] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [s, g] = await Promise.all([
      supabase
        .from("report_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("report_share_grants")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (s.error) setError(s.error.message);
    else setSnapshots(s.data ?? []);
    if (g.error) setError(g.error.message);
    else setGrants(g.data ?? []);
  }

  async function createSnapshot() {
    setError("");
    if (!title.trim()) {
      setError("Enter a report title");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    let reportData: unknown;
    try {
      reportData = JSON.parse(reportJson);
    } catch {
      setError("Enter a JSON array of your authorized report rows");
      return;
    }
    if (
      !Array.isArray(reportData) ||
      reportData.length > 1000 ||
      reportData.some((r) => !r || Array.isArray(r) || typeof r !== "object")
    ) {
      setError("Provide up to 1,000 JSON object rows");
      return;
    }
    if (
      /api[_ -]?key|encrypted|service_role|authorization|webhook_url/i.test(
        reportJson,
      )
    ) {
      setError("Remove credentials and private tokens from the report");
      return;
    }
    const { error } = await supabase
      .from("report_snapshots")
      .insert({ user_id: user.id, title: title.trim(), data: reportData });
    if (error) setError(error.message);
    else {
      setTitle("");
      load();
    }
  }

  async function exportCsv(s: Snapshot) {
    const rows = (s.data ?? []).map((r: any) => ({ ...r }));
    downloadBlob(
      new Blob([toCsv(rows)], { type: "text/csv" }),
      `${s.title.replace(/[^a-z0-9]/gi, "_")}.csv`,
    );
  }

  async function exportXlsx(s: Snapshot) {
    const rows = (s.data ?? []).map((r: any) => ({ ...r }));
    const blob = await toXlsx(rows, s.title.slice(0, 30));
    downloadBlob(blob, `${s.title.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  }

  async function createShareLink(s: Snapshot) {
    setError("");
    if (
      !confirm(
        "Anyone with this link can read every row in this snapshot until expiry or revocation. Share only explicitly selected, redacted data. Continue?",
      )
    )
      return;
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("report_share_grants")
      .insert({ snapshot_id: s.id, expires_at: expires })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      const url = `${window.location.origin}/#/report/${data.token}`;
      navigator.clipboard?.writeText(url);
      load();
    }
  }

  async function revokeGrant(g: Grant) {
    await supabase
      .from("report_share_grants")
      .update({ revoked: true })
      .eq("id", g.id);
    load();
  }

  async function removeSnapshot(s: Snapshot) {
    await supabase.from("report_snapshots").delete().eq("id", s.id);
    load();
  }

  return (
    <section>
      <h2>Reports & Exports</h2>
      <p className="muted">
        Create immutable report snapshots, export as CSV or genuine XLSX
        (formula-injection sanitized), and generate revocable expiring share
        links.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>New snapshot</h3>
        <input
          className="nu-input"
          placeholder="Report title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label>
          Authorized report rows (JSON array)
          <textarea
            className="nu-input"
            rows={6}
            value={reportJson}
            onChange={(e) => setReportJson(e.target.value)}
          />
        </label>
        <button className="nu-btn" onClick={createSnapshot}>
          Create snapshot
        </button>
        <p className="muted" style={{ marginTop: 6 }}>
          Snapshots are immutable copies — exports reflect the snapshot, not
          live data.
        </p>
      </article>

      <div className="grid">
        {snapshots.map((s) => (
          <article key={s.id} className="card nu-inset">
            <h3>{s.title}</h3>
            <p className="muted">
              {new Date(s.created_at).toLocaleString()} •{" "}
              {(s.data ?? []).length} rows
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="nu-btn" onClick={() => exportCsv(s)}>
                Export CSV
              </button>
              <button className="nu-btn" onClick={() => exportXlsx(s)}>
                Export XLSX
              </button>
              <button className="nu-btn" onClick={() => createShareLink(s)}>
                Share link (7d)
              </button>
              <button className="nu-btn" onClick={() => removeSnapshot(s)}>
                Delete
              </button>
            </div>
            {grants
              .filter((g) => g.snapshot_id === s.id && !g.revoked)
              .map((g) => (
                <p key={g.id} className="muted" style={{ marginTop: 6 }}>
                  Link expires {new Date(g.expires_at).toLocaleDateString()} —{" "}
                  <button className="nu-btn" onClick={() => revokeGrant(g)}>
                    Revoke
                  </button>
                </p>
              ))}
          </article>
        ))}
        {snapshots.length === 0 && <p className="muted">No snapshots yet.</p>}
      </div>
    </section>
  );
}
