import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface MoneyRequest {
  id: string;
  requester_torn_id: number;
  requester_name: string;
  amount: number;
  reason: string;
  status: string;
  reviewed_by: string;
  created_at: string;
  reviewed_at: string;
}
interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export default function FactionFinance() {
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState("");

  const [rTornId, setRTornId] = useState("");
  const [rName, setRName] = useState("");
  const [rAmount, setRAmount] = useState("");
  const [rReason, setRReason] = useState("");
  const [lType, setLType] = useState("deposit");
  const [lAmount, setLAmount] = useState("");
  const [lDesc, setLDesc] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [r, l] = await Promise.all([
      supabase
        .from("faction_money_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("faction_ledger_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (r.error) setError(r.error.message);
    else setRequests(r.data ?? []);
    if (l.error) setError(l.error.message);
    else setLedger(l.data ?? []);
  }

  async function submitRequest() {
    setError("");
    const tid = parseInt(rTornId, 10);
    const amt = parseInt(rAmount, 10);
    if (
      isNaN(tid) ||
      !rName.trim() ||
      isNaN(amt) ||
      amt <= 0 ||
      !rReason.trim()
    ) {
      setError("Fill all fields with valid values");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_money_requests")
      .insert({
        user_id: user.id,
        requester_torn_id: tid,
        requester_name: rName.trim(),
        amount: amt,
        reason: rReason.trim(),
      });
    if (error) setError(error.message);
    else {
      setRTornId("");
      setRName("");
      setRAmount("");
      setRReason("");
      load();
    }
  }

  async function reviewRequest(
    r: MoneyRequest,
    decision: "approved" | "rejected",
  ) {
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const reviewer = profile?.display_name ?? "leader";
    const { error } = await supabase
      .from("faction_money_requests")
      .update({
        status: decision,
        reviewed_by: reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      setError(error.message);
      return;
    }
    if (decision === "approved") {
      const balance = ledger[0]?.balance_after ?? 0;
      await supabase
        .from("faction_ledger_entries")
        .insert({
          user_id: user.id,
          entry_type: "withdrawal",
          amount: -r.amount,
          balance_after: balance - r.amount,
          description: `Payout for request by ${r.requester_name}`,
          related_request_id: r.id,
        });
      await supabase
        .from("faction_money_requests")
        .update({ status: "paid" })
        .eq("id", r.id);
    }
    load();
  }

  async function addLedgerEntry() {
    setError("");
    const amt = parseInt(lAmount, 10);
    if (isNaN(amt) || amt === 0) {
      setError("Enter a non-zero amount");
      return;
    }
    const signed = ["withdrawal", "expense"].includes(lType)
      ? -Math.abs(amt)
      : Math.abs(amt);
    const balance = (ledger[0]?.balance_after ?? 0) + signed;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_ledger_entries")
      .insert({
        user_id: user.id,
        entry_type: lType,
        amount: signed,
        balance_after: balance,
        description: lDesc.trim() || null,
      });
    if (error) setError(error.message);
    else {
      setLAmount("");
      setLDesc("");
      load();
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const balance = ledger[0]?.balance_after ?? 0;

  return (
    <section>
      <h2>Faction Finance</h2>
      <p className="muted">
        Money requests with approval workflow and a running ledger. Approving a
        request automatically creates a withdrawal entry and marks it paid.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Current balance: ${balance.toLocaleString()}</h3>
      </article>

      <article className="card nu-inset">
        <h3>Submit money request</h3>
        <DataEntry source="player" onNameChange={setRName} type="number" min="1" step="1"
          className="nu-input"
          placeholder="Requester Torn ID"
          value={rTornId}
          onChange={(e) => setRTornId(e.target.value)}
        />
        <DataEntry source="playerName"
          className="nu-input"
          placeholder="Requester name"
          value={rName}
          onChange={(e) => setRName(e.target.value)}
        />
        <SelectEntry kind="money"
          className="nu-input"
          type="number"
          placeholder="Amount ($)"
          value={rAmount}
          onChange={(e) => setRAmount(e.target.value)}
        />
        <SelectEntry options={["Training supplies","Medical supplies","War expenses","Loan","Other"].map(value=>({value,label:value}))}
          className="nu-input"
          placeholder="Reason"
          value={rReason}
          onChange={(e) => setRReason(e.target.value)}
        />
        <button className="nu-btn" onClick={submitRequest}>
          Submit request
        </button>
      </article>

      <article className="card nu-inset">
        <h3>Pending requests ({pending.length})</h3>
        {pending.map((r) => (
          <div
            key={r.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              #{r.requester_torn_id} {r.requester_name} — $
              {r.amount.toLocaleString()} — {r.reason}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                className="nu-btn"
                onClick={() => reviewRequest(r, "approved")}
              >
                Approve & pay
              </button>
              <button
                className="nu-btn"
                onClick={() => reviewRequest(r, "rejected")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="muted">No pending requests.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Add ledger entry</h3>
        <select
          className="nu-input"
          value={lType}
          onChange={(e) => setLType(e.target.value)}
        >
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="loan">Loan</option>
          <option value="repayment">Repayment</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <SelectEntry kind="money"
          className="nu-input"
          type="number"
          placeholder="Amount"
          value={lAmount}
          onChange={(e) => setLAmount(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Description (optional)"
          value={lDesc}
          onChange={(e) => setLDesc(e.target.value)}
        />
        <button className="nu-btn" onClick={addLedgerEntry}>
          Add entry
        </button>
      </article>

      <article className="card nu-inset">
        <h3>Ledger</h3>
        {ledger.map((l) => (
          <div
            key={l.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              {l.entry_type} — ${l.amount.toLocaleString()} — balance: $
              {l.balance_after.toLocaleString()}
            </span>
            {l.description && (
              <p className="muted" style={{ fontSize: 12 }}>
                {l.description}
              </p>
            )}
          </div>
        ))}
        {ledger.length === 0 && <p className="muted">No ledger entries yet.</p>}
      </article>
    </section>
  );
}
