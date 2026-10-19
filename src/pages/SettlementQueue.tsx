import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Settlement {
  id: string;
  claim_id: string;
  seller_user_id: string;
  amount_owed: number;
  amount_paid: number;
  status: string;
  approved_at: string;
  sent_at: string;
  reconciled_at: string;
  transaction_ref: string;
  notes: string;
}
interface Dispute {
  id: string;
  claim_id: string;
  raised_by: string;
  reason: string;
  status: string;
  resolved_at: string;
  resolution_notes: string;
}

export default function SettlementQueue() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [error, setError] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeClaimId, setDisputeClaimId] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [s, d] = await Promise.all([
      supabase
        .from("loss_settlement_entries")
        .select("*")
        .eq("seller_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("loss_disputes")
        .select("*")
        .eq("raised_by", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (s.error) setError(s.error.message);
    else setSettlements(s.data ?? []);
    if (d.error) setError(d.error.message);
    else setDisputes(d.data ?? []);
  }

  async function markReconciled(s: Settlement) {
    const { error } = await supabase.rpc("transition_loss_settlement", {
      entry: s.id,
      next_status: "reconciled",
    });
    if (error) setError(error.message);
    else load();
  }

  async function raiseDispute() {
    setError("");
    if (!disputeClaimId || !disputeReason.trim()) {
      setError("Fill claim ID and reason");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("loss_disputes")
      .insert({
        claim_id: disputeClaimId,
        raised_by: user.id,
        reason: disputeReason.trim(),
      });
    if (error) setError(error.message);
    else {
      setDisputeClaimId("");
      setDisputeReason("");
      load();
    }
  }

  const earned = settlements.filter((s) => s.status === "earned");
  const approved = settlements.filter((s) => s.status === "approved");
  const sent = settlements.filter((s) => s.status === "sent");
  const reconciled = settlements.filter((s) => s.status === "reconciled");
  const openDisputes = disputes.filter((d) => d.status === "open");

  return (
    <section>
      <h2>Settlement Queue & Disputes</h2>
      <p className="muted">
        Track operator payouts to sellers and manage disputes on loss claims.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Earned ({earned.length})</h3>
        {earned.map((s) => (
          <div
            key={s.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              Claim {s.claim_id.slice(0, 8)}… — owed $
              {s.amount_owed.toLocaleString()}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <span>Awaiting buyer/operator approval</span>
            </div>
          </div>
        ))}
        {earned.length === 0 && (
          <p className="muted">Nothing pending approval.</p>
        )}
      </article>

      <article className="card nu-inset">
        <h3>Approved ({approved.length})</h3>
        {approved.map((s) => (
          <div
            key={s.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              Claim {s.claim_id.slice(0, 8)}… — owed $
              {s.amount_owed.toLocaleString()}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <span>Awaiting manual Torn payment</span>
            </div>
          </div>
        ))}
        {approved.length === 0 && (
          <p className="muted">Nothing awaiting payment.</p>
        )}
      </article>

      <article className="card nu-inset">
        <h3>Sent ({sent.length})</h3>
        {sent.map((s) => (
          <div
            key={s.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              Claim {s.claim_id.slice(0, 8)}… — paid $
              {s.amount_paid.toLocaleString()} — ref {s.transaction_ref}
            </span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => markReconciled(s)}>
                Mark reconciled
              </button>
            </div>
          </div>
        ))}
        {sent.length === 0 && (
          <p className="muted">Nothing awaiting reconciliation.</p>
        )}
      </article>

      <article className="card nu-inset">
        <h3>Reconciled ({reconciled.length})</h3>
        {reconciled.map((s) => (
          <div
            key={s.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              Claim {s.claim_id.slice(0, 8)}… — paid $
              {s.amount_paid.toLocaleString()} — ref {s.transaction_ref}
            </span>
          </div>
        ))}
        {reconciled.length === 0 && (
          <p className="muted">Nothing reconciled yet.</p>
        )}
      </article>

      <article className="card nu-inset">
        <h3>Raise a dispute</h3>
        <input
          className="nu-input"
          placeholder="Claim ID"
          value={disputeClaimId}
          onChange={(e) => setDisputeClaimId(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Reason"
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
        />
        <button className="nu-btn" onClick={raiseDispute}>
          Raise dispute
        </button>
      </article>

      <article className="card nu-inset">
        <h3>Open disputes ({openDisputes.length})</h3>
        {openDisputes.map((d) => (
          <div
            key={d.id}
            style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
          >
            <span>
              Claim {d.claim_id.slice(0, 8)}… — {d.reason}
            </span>
          </div>
        ))}
        {openDisputes.length === 0 && (
          <p className="muted">No open disputes.</p>
        )}
      </article>
    </section>
  );
}
