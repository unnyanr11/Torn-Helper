import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Digest {
  id: string;
  digest_date: string;
  energy_status: string;
  pending_loans: number;
  overdue_loans: number;
  chain_status: string;
  travel_opportunities: number;
  top_targets: number;
  payload: any;
}

export default function DailyDigest() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("daily_digests")
      .select("*")
      .eq("user_id", user.id)
      .eq("digest_date", today)
      .maybeSingle();
    if (error) setError(error.message);
    else setDigest(data);
  }

  async function generateDigest() {
    setError("");
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Sign in to generate a digest.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);

    // Gather data from existing tables
    const [loans, chain, travel, targets] = await Promise.all([
      supabase
        .from("faction_loans")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("faction_chain_state")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("travel_profit_scenarios")
        .select("*")
        .eq("user_id", user.id)
        .order("profit_per_hour", { ascending: false })
        .limit(5),
      supabase
        .from("chain_target_queue")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open"),
    ]);

    const failure = [loans, chain, travel, targets].find(
      (result) => result.error,
    );
    if (failure?.error) {
      setError(failure.error.message);
      setLoading(false);
      return;
    }
    const activeLoans = loans.data ?? [];
    const todayStr = today;
    const overdue = activeLoans.filter(
      (l) => l.due_date && l.due_date < todayStr,
    ).length;
    const pending = activeLoans.filter(
      (l) => l.due_date && l.due_date >= todayStr,
    ).length;
    const chainStatus = chain.data
      ? `Current: ${chain.data.current_chain}, Best: ${chain.data.best_chain}`
      : "No chain data";
    const travelOps = (travel.data ?? []).length;
    const topTargets = (targets.data ?? []).length;

    const payload = {
      loans: activeLoans.map((l) => ({
        name: l.borrower_name,
        due: l.due_date,
        amount: l.principal,
      })),
      chain: chain.data,
      topTravel: (travel.data ?? [])
        .slice(0, 3)
        .map((t) => ({
          dest: t.destination,
          item: t.item_name,
          pph: t.profit_per_hour,
        })),
      openTargets: topTargets,
    };

    const { data, error } = await supabase
      .from("daily_digests")
      .upsert(
        {
          user_id: user.id,
          digest_date: today,
          energy_status: "Not collected",
          pending_loans: pending,
          overdue_loans: overdue,
          chain_status: chainStatus,
          travel_opportunities: travelOps,
          top_targets: topTargets,
          payload,
        },
        { onConflict: "user_id,digest_date" },
      )
      .select()
      .single();

    setLoading(false);
    if (error) setError(error.message);
    else setDigest(data);
  }

  return (
    <section>
      <h2>Daily Digest</h2>
      <p className="muted">
        A morning snapshot of your faction loans, chain status, top travel
        opportunities, and open chain targets — aggregated from your existing
        data.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <button className="nu-btn" onClick={generateDigest} disabled={loading}>
          {loading ? "Generating…" : "Generate today's digest"}
        </button>
      </article>

      {digest && (
        <div className="grid">
          <article className="card nu-inset">
            <h3>Loans</h3>
            <p>
              Pending: {digest.pending_loans} • Overdue: {digest.overdue_loans}
            </p>
            {(digest.payload?.loans ?? []).map((l: any, i: number) => (
              <p key={i} className="muted" style={{ fontSize: 12 }}>
                {l.name} — ${l.amount?.toLocaleString()} — due {l.due}
              </p>
            ))}
          </article>
          <article className="card nu-inset">
            <h3>Chain</h3>
            <p>{digest.chain_status}</p>
          </article>
          <article className="card nu-inset">
            <h3>Travel opportunities</h3>
            <p>{digest.travel_opportunities} scenario(s) tracked</p>
            {(digest.payload?.topTravel ?? []).map((t: any, i: number) => (
              <p key={i} className="muted" style={{ fontSize: 12 }}>
                {t.dest} — {t.item} — ${t.pph?.toLocaleString()}/hr
              </p>
            ))}
          </article>
          <article className="card nu-inset">
            <h3>Chain targets</h3>
            <p>{digest.top_targets} open target(s) in queue</p>
          </article>
        </div>
      )}
      {!digest && <p className="muted">No digest generated yet for today.</p>}
    </section>
  );
}
