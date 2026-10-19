import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface QueueEntry {
  id: string;
  torn_player_id: number;
  player_name: string;
  level: number;
  status: string;
  claimed_by: string;
  claimed_until: string;
  notes: string;
}

export default function ChainQueue() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [error, setError] = useState("");
  const [tornId, setTornId] = useState("");
  const [pName, setPName] = useState("");
  const [pLevel, setPLevel] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [claimName, setClaimName] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("chain_target_queue")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) setError(error.message);
    else setQueue(data ?? []);
  }

  async function addTarget() {
    setError("");
    const tid = parseInt(tornId, 10);
    const lvl = parseInt(pLevel, 10) || 0;
    if (isNaN(tid) || tid <= 0) {
      setError("Enter a valid Torn player ID");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("chain_target_queue")
      .upsert(
        {
          user_id: user.id,
          torn_player_id: tid,
          player_name: pName.trim() || null,
          level: lvl,
          notes: pNotes.trim() || null,
          status: "open",
        },
        { onConflict: "user_id,torn_player_id" },
      );
    if (error) setError(error.message);
    else {
      setTornId("");
      setPName("");
      setPLevel("");
      setPNotes("");
      load();
    }
  }

  async function claimTarget(entry: QueueEntry) {
    setError("");
    const { error } = await supabase.rpc("claim_chain_target", {
      entry: entry.id,
    });
    if (error) setError(error.message);
    else {
      setClaimName("");
      load();
    }
  }

  async function markHit(entry: QueueEntry) {
    await supabase
      .from("chain_target_queue")
      .update({ status: "hit" })
      .eq("id", entry.id);
    load();
  }

  async function skipTarget(entry: QueueEntry) {
    await supabase
      .from("chain_target_queue")
      .update({ status: "skipped" })
      .eq("id", entry.id);
    load();
  }

  async function releaseClaim(entry: QueueEntry) {
    await supabase
      .from("chain_target_queue")
      .update({
        status: "open",
        claimed_by: null,
        claimed_at: null,
        claimed_until: null,
      })
      .eq("id", entry.id);
    load();
  }

  async function removeTarget(id: string) {
    await supabase.from("chain_target_queue").delete().eq("id", id);
    load();
  }

  const open = queue.filter(
    (q) =>
      q.status === "open" ||
      (q.status === "claimed" && Date.parse(q.claimed_until) <= Date.now()),
  );
  const claimed = queue.filter(
    (q) => q.status === "claimed" && Date.parse(q.claimed_until) > Date.now(),
  );
  const done = queue.filter(
    (q) => q.status === "hit" || q.status === "skipped",
  );

  return (
    <section>
      <h2>Chain Target Queue</h2>
      <p className="muted">
        Build and work through a chain target queue. Claim a target for 5
        minutes, mark it hit or skipped, and keep the chain moving.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Add target</h3>
        <input
          className="nu-input"
          placeholder="Torn player ID"
          value={tornId}
          onChange={(e) => setTornId(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Player name (optional)"
          value={pName}
          onChange={(e) => setPName(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Level (optional)"
          value={pLevel}
          onChange={(e) => setPLevel(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Notes (optional)"
          value={pNotes}
          onChange={(e) => setPNotes(e.target.value)}
        />
        <button className="nu-btn" onClick={addTarget}>
          Add to queue
        </button>
      </article>

      <article className="card nu-inset">
        <h3>Open targets ({open.length})</h3>

        {open.map((q) => (
          <div
            key={q.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              #{q.torn_player_id} {q.player_name ?? "—"} (Lv {q.level ?? "—"}){" "}
              {q.notes ? `— ${q.notes}` : ""}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => claimTarget(q)}>
                Claim (5 min)
              </button>
              <button className="nu-btn" onClick={() => skipTarget(q)}>
                Skip
              </button>
              <button className="nu-btn" onClick={() => removeTarget(q.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {open.length === 0 && <p className="muted">Queue is empty.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Claimed ({claimed.length})</h3>
        {claimed.map((q) => (
          <div
            key={q.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              #{q.torn_player_id} {q.player_name ?? "—"} — claimed by{" "}
              {q.claimed_by} until{" "}
              {q.claimed_until
                ? new Date(q.claimed_until).toLocaleTimeString()
                : "—"}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => markHit(q)}>
                Mark hit
              </button>
              <button className="nu-btn" onClick={() => releaseClaim(q)}>
                Release
              </button>
            </div>
          </div>
        ))}
        {claimed.length === 0 && <p className="muted">No active claims.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Completed ({done.length})</h3>
        {done.map((q) => (
          <div
            key={q.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              #{q.torn_player_id} {q.player_name ?? "—"} — {q.status}
            </span>
          </div>
        ))}
        {done.length === 0 && <p className="muted">Nothing completed yet.</p>}
      </article>
    </section>
  );
}
