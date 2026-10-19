import { functionError } from "../lib/function-error";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
const tabs = [
  "Buy Losses",
  "Sell Losses",
  "My Contracts",
  "Active Claim",
  "Earnings",
  "Payment Queue",
  "Disputes",
] as const;
const cash = (n: number) => `T$${Number(n).toLocaleString()}`;
export default function LossMarketplace() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Buy Losses"),
    [contracts, setContracts] = useState<any[]>([]),
    [claims, setClaims] = useState<any[]>([]),
    [evidence, setEvidence] = useState<any[]>([]),
    [settlements, setSettlements] = useState<any[]>([]),
    [disputes, setDisputes] = useState<any[]>([]),
    [userId, setUserId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(""),
    [price, setPrice] = useState(""),
    [qty, setQty] = useState(""),
    [expiry, setExpiry] = useState(""),
    [claimQty, setClaimQty] = useState<Record<string, string>>({}),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    void load();
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const channel = supabase
      .channel("loss-workflow")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loss_claims" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loss_settlement_entries" },
        () => void load(),
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, []);
  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const results = await Promise.all([
      supabase.rpc("loss_contract_availability"),
      supabase
        .from("loss_claims")
        .select("*")
        .eq("seller_user_id", user.id)
        .order("claimed_at", { ascending: false }),
      supabase
        .from("loss_attack_evidence")
        .select("*")
        .order("attack_timestamp", { ascending: false })
        .limit(100),
      supabase
        .from("loss_settlement_entries")
        .select("*,loss_claims(contract_id,loss_contracts(buyer_user_id))")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("loss_disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (results.some((r) => r.error)) {
      setError(
        results.find((r) => r.error)?.error?.message ?? "Unable to load",
      );
      return;
    }
    setContracts(results[0].data ?? []);
    setClaims(results[1].data ?? []);
    setEvidence(results[2].data ?? []);
    setSettlements(results[3].data ?? []);
    setDisputes(results[4].data ?? []);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(name, args);
    if (error) throw error;
  }
  async function create() {
    const t = Number(target),
      q = Number(qty),
      p = Number(price);
    if (
      ![t, q, p].every((n) => Number.isSafeInteger(n) && n > 0) ||
      !Number.isSafeInteger(q * p)
    )
      throw new Error(
        "Enter positive whole-number Torn ID, quantity and Torn-dollar price",
      );
    if (expiry && Date.parse(expiry) <= Date.now())
      throw new Error("Expiry must be in the future");
    const { error } = await supabase.from("loss_contracts").insert({
      buyer_user_id: userId,
      target_player_id: t,
      quantity: q,
      price_per_loss: p,
      funding_method: "direct_payment",
      status: "open",
      expires_at: expiry ? new Date(expiry).toISOString() : null,
    });
    if (error) throw error;
    setTarget("");
    setPrice("");
    setQty("");
    setTab("My Contracts");
  }
  async function recheck(claim: any, close: boolean) {
    const { data, error } = await supabase.functions.invoke(
      "verify-loss-payment",
      { body: {} },
    );
    if (error || data?.error) throw await functionError(data, error);
    if (data.pending)
      throw new Error(
        "Attack records are pending. No payment approved. Retry before the reconciliation window closes.",
      );
    if (close) await rpc("close_loss_claim", { claim: claim.id });
  }
  async function dispute(claim: string) {
    const reason = prompt(
      "Explain the dispute and include evidence references:",
    );
    if (!reason?.trim()) return;
    const { error } = await supabase
      .from("loss_disputes")
      .insert({ claim_id: claim, raised_by: userId, reason: reason.trim() });
    if (error) throw error;
  }
  const mine = contracts.filter((c) => c.buyer_user_id === userId),
    active = claims.find(
      (c) => c.status === "active" && Date.parse(c.expires_at) > clock,
    ),
    contract = contracts.find((c) => c.id === active?.contract_id);
  const seconds = active
    ? Math.max(0, Math.ceil((Date.parse(active.expires_at) - clock) / 1000))
    : 0;
  const mySettlements = settlements.filter((s) => s.seller_user_id === userId);
  return (
    <section>
      <h2>Loss Marketplace</h2>
      <p>
        Direct payment in Torn dollars. Buyers pay manually in Torn; this app
        provides no escrow or prepaid protection. Comparable target statistics
        are unavailable, so suitability is unknown and winning or losing is
        never guaranteed.
      </p>
      {error && (
        <p role="alert" className="badge warn">
          {error}
        </p>
      )}
      <div className="meta">
        {tabs.map((t) => (
          <button className="nu-btn" key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Buy Losses" && (
        <article className="card">
          <h3>Create direct-payment contract</h3>
          <label>
            Target Torn ID
            <input
              className="nu-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label>
            Torn dollars per loss
            <input
              className="nu-input"
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Loss quantity
            <input
              className="nu-input"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label>
            Expiry (your local time, optional)
            <input
              type="datetime-local"
              className="nu-input"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
          <p>
            Total: {cash(Number(price) * Number(qty))} · Funding: direct payment
          </p>
          <button
            className="nu-btn"
            disabled={busy}
            onClick={() => run(create)}
          >
            Create contract
          </button>
        </article>
      )}
      {tab === "Sell Losses" &&
        contracts
          .filter(
            (c) =>
              c.status === "open" &&
              c.buyer_user_id !== userId &&
              c.remaining > 0 &&
              (!c.expires_at || Date.parse(c.expires_at) > clock),
          )
          .map((c) => (
            <article key={c.id} className="card">
              <h3>Target {c.target_player_id}</h3>
              <p>
                {cash(c.price_per_loss)} per accepted loss · {c.remaining} slots
                available · {c.verified} verified
              </p>
              <p>
                Eligibility: identity verified; stat suitability unknown.
                Payment depends on the buyer.
              </p>
              <input
                aria-label="Quantity to claim"
                className="nu-input"
                type="number"
                min="1"
                max={c.remaining}
                value={claimQty[c.id] ?? "1"}
                onChange={(e) =>
                  setClaimQty({ ...claimQty, [c.id]: e.target.value })
                }
              />
              <button
                className="nu-btn"
                disabled={busy || !!active}
                onClick={() =>
                  run(() =>
                    rpc("claim_loss_contract", {
                      contract: c.id,
                      requested: Number(claimQty[c.id] ?? 1),
                    }),
                  )
                }
              >
                Claim slots atomically
              </button>
            </article>
          ))}
      {tab === "My Contracts" &&
        mine.map((c) => (
          <article className="card" key={c.id}>
            <h3>Target {c.target_player_id}</h3>
            <p>
              {c.status} · {c.verified}/{c.quantity} verified · {c.remaining}{" "}
              available · {cash(c.price_per_loss)} each
            </p>
            {["open", "paused"].includes(c.status) && (
              <>
                <button
                  className="nu-btn"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      rpc("set_loss_contract_status", {
                        contract: c.id,
                        next_status: c.status === "open" ? "paused" : "open",
                      }),
                    )
                  }
                >
                  {c.status === "open" ? "Pause new claims" : "Resume"}
                </button>
                <button
                  className="nu-btn"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      rpc("set_loss_contract_status", {
                        contract: c.id,
                        next_status: "cancelled",
                      }),
                    )
                  }
                >
                  Cancel unreserved work
                </button>
                <p>Existing claims and verified earnings remain payable.</p>
              </>
            )}
          </article>
        ))}
      {tab === "Active Claim" && (
        <article className="card">
          {active ? (
            <>
              <h3>
                Target {contract?.target_player_id ?? "unknown"} ·{" "}
                {Math.floor(seconds / 60)}m {seconds % 60}s remaining
              </h3>
              <p>
                {active.quantity_verified}/{active.quantity} verified · Expected
                maximum{" "}
                {cash(active.quantity * (contract?.price_per_loss ?? 0))}
              </p>
              <p>
                First loss within five minutes; no more than five minutes
                between losses; fifteen minutes overall. Ten-minute
                reconciliation grace holds slots for delayed API records.
              </p>
              <p>
                Optional manual checklist: pillow equipped, other weapons and
                armour removed. Check the target yourself before attacking.
              </p>
              <a
                href={`https://www.torn.com/loader.php?sid=attack&user2ID=${contract?.target_player_id}`}
                target="_blank"
                rel="noreferrer"
              >
                Open manual Torn attack page
              </a>
              <button
                className="nu-btn"
                disabled={busy}
                onClick={() => run(() => recheck(active, false))}
              >
                Recheck attack log
              </button>
              <button
                className="nu-btn"
                disabled={busy}
                onClick={() => run(() => recheck(active, true))}
              >
                Mark complete / release unused work
              </button>
              {evidence
                .filter((e) => e.claim_id === active.id)
                .map((e) => (
                  <p key={e.id}>
                    Attack {e.attack_id} · {e.verified ? "verified" : "pending"}{" "}
                    · {new Date(e.attack_timestamp).toLocaleString()}
                  </p>
                ))}
            </>
          ) : (
            <p>
              No active claim. Expired records can still reconcile during their
              grace period.
            </p>
          )}
          <button
            className="nu-btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { data, error } = await supabase.functions.invoke(
                  "verify-loss-payment",
                  { body: {} },
                );
                if (error || data?.error)
                  throw await functionError(data, error);
              })
            }
          >
            Recheck pending records
          </button>
        </article>
      )}
      {tab === "Earnings" && (
        <article className="card">
          <h3>
            Total earned:{" "}
            {cash(
              mySettlements.reduce((sum, s) => sum + Number(s.amount_owed), 0),
            )}
          </h3>
          {mySettlements.map((s) => (
            <p key={s.id}>
              Claim {s.claim_id.slice(0, 8)} · {cash(s.amount_owed)} · Paid{" "}
              {cash(s.amount_paid)} · {s.status}
            </p>
          ))}
        </article>
      )}
      {tab === "Payment Queue" &&
        settlements.map((s) => (
          <article className="card" key={s.id}>
            <p>
              Claim {s.claim_id.slice(0, 8)} · {cash(s.amount_owed)} ·{" "}
              {s.status}
            </p>
            {s.loss_claims?.loss_contracts?.buyer_user_id === userId &&
              s.status === "earned" && (
                <button
                  className="nu-btn"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      rpc("transition_loss_settlement", {
                        entry: s.id,
                        next_status: "approved",
                      }),
                    )
                  }
                >
                  Approve after reconciliation
                </button>
              )}
            {s.loss_claims?.loss_contracts?.buyer_user_id === userId &&
              s.status === "approved" && (
                <button
                  className="nu-btn"
                  disabled={busy}
                  onClick={() => {
                    const reference = prompt(
                      "Reference for the payment you sent manually in Torn:",
                    );
                    if (reference)
                      void run(() =>
                        rpc("transition_loss_settlement", {
                          entry: s.id,
                          next_status: "sent",
                          reference,
                        }),
                      );
                  }}
                >
                  Record payment sent manually
                </button>
              )}
            {s.seller_user_id === userId && s.status === "sent" && (
              <button
                className="nu-btn"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    rpc("transition_loss_settlement", {
                      entry: s.id,
                      next_status: "reconciled",
                    }),
                  )
                }
              >
                Confirm payment received
              </button>
            )}
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(() => dispute(s.claim_id))}
            >
              Raise dispute
            </button>
          </article>
        ))}
      {tab === "Disputes" && (
        <>
          {claims.map((c) => (
            <button
              className="nu-btn"
              key={c.id}
              disabled={busy}
              onClick={() => run(() => dispute(c.id))}
            >
              Dispute claim {c.id.slice(0, 8)}
            </button>
          ))}
          {disputes.map((d) => (
            <article className="card" key={d.id}>
              <p>
                {d.reason} · {d.status}
              </p>
              <p>{d.resolution_notes}</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
