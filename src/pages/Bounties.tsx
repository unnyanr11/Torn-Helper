import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Bounty {
  id: string;
  target_torn_id: number;
  target_name: string;
  amount: number;
  status: string;
  notes: string;
  created_at: string;
}

const STATUSES = ["open", "claimed", "expired"];

export default function Bounties() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [filter, setFilter] = useState("all");
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [filter]);

  async function load() {
    let query = supabase
      .from("bounties")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setBounties(data ?? []);
  }

  async function add() {
    setError("");
    const tid = Number(targetId);
    const amt = Number(amount);
    if (
      !Number.isSafeInteger(tid) ||
      tid <= 0 ||
      !Number.isSafeInteger(amt) ||
      amt <= 0
    ) {
      setError("Enter valid target ID and amount");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("bounties")
      .insert({
        user_id: user.id,
        target_torn_id: tid,
        target_name: targetName.trim() || null,
        amount: amt,
        notes: notes.trim() || null,
      });
    if (error) setError(error.message);
    else {
      setTargetId("");
      setTargetName("");
      setAmount("");
      setNotes("");
      load();
    }
  }

  async function setStatus(b: Bounty, status: string) {
    const { error } = await supabase
      .from("bounties")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) setError(error.message);
    else load();
  }

  async function remove(b: Bounty) {
    const { error } = await supabase.from("bounties").delete().eq("id", b.id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Bounties</h2>
      <p className="muted">
        Private bookkeeping for bounties. Status is manual
        (open/claimed/expired); amounts and notes are your own records. This
        does not place an official Torn bounty. Public app contracts, verified
        hospitalization claims and settlement are unavailable pending the
        required rules review and verification workflow.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add bounty</h3>
        <DataEntry source="player" onNameChange={setTargetName} type="number" min="1" step="1"
          className="nu-input"
          placeholder="Target Torn ID"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        />
        <DataEntry source="playerName"
          className="nu-input"
          placeholder="Target name (optional)"
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
        />
        <SelectEntry kind="money"
          className="nu-input"
          placeholder="Amount ($)"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="nu-btn" onClick={add}>
          Add bounty
        </button>
      </article>
      <article className="card nu-inset">
        <h3>Filter</h3>
        <select
          className="nu-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </article>
      <div className="grid">
        {bounties.map((b) => (
          <article key={b.id} className="card nu-inset">
            <h3>{b.target_name ?? `Player ${b.target_torn_id}`}</h3>
            <p className="muted">
              ID: {b.target_torn_id} · ${b.amount.toLocaleString()}
            </p>
            <span className="badge">{b.status}</span>
            {b.notes && <p>{b.notes}</p>}
            <p className="muted">
              Added {new Date(b.created_at).toLocaleString()}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATUSES.filter((s) => s !== b.status).map((s) => (
                <button
                  key={s}
                  className="nu-btn"
                  onClick={() => setStatus(b, s)}
                >
                  Mark {s}
                </button>
              ))}
              <button className="nu-btn" onClick={() => remove(b)}>
                Delete
              </button>
            </div>
          </article>
        ))}
        {bounties.length === 0 && (
          <p className="muted">
            No bounties {filter !== "all" ? `with status "${filter}"` : "yet"}.
          </p>
        )}
      </div>
    </section>
  );
}
