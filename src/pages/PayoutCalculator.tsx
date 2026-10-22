import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toCsv, downloadBlob } from "../lib/export";
import { calculatePayout, MemberInput, Mode } from "../lib/payout";

interface Policy {
  id: string;
  war_id: string;
  version: number;
  status: string;
  mode: string;
  config: any;
}
interface Run {
  id: string;
  policy_id: string;
  total_pool_cents: number;
  allocated_cents: number;
  retained_cents: number;
  status: string;
}
interface Line {
  id: string;
  run_id: string;
  member_id: string;
  eligible_points: number;
  share_cents: number;
  bonus_cents: number;
  reimbursement_cents: number;
  adjustment_cents: number;
  amount_owed_cents: number;
  paid_cents: number;
  status: string;
  explanation: string;
}
interface Audit {
  id: string;
  run_id: string;
  action: string;
  details: any;
  created_at: string;
}

const MODES = ["equal", "proportional", "weighted", "hybrid"] as const;
export default function PayoutCalculator() {
  const [wars, setWars] = useState<any[]>([]);
  const [warId, setWarId] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("proportional");
  const [pool, setPool] = useState("");
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: w } = await supabase
      .from("wars")
      .select("id,name")
      .order("created_at");
    setWars(w ?? []);
    const [p, r, l, a] = await Promise.all([
      supabase
        .from("payout_policies")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payout_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("payout_lines")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payout_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (p.error) setError(p.error.message);
    else setPolicies(p.data ?? []);
    if (r.error) setError(r.error.message);
    else setRuns(r.data ?? []);
    if (l.error) setError(l.error.message);
    else setLines(l.data ?? []);
    if (a.error) setError(a.error.message);
    else setAudit(a.data ?? []);
  }

  async function createAndRun() {
    setError("");
    const poolCents = Number(pool);
    if (!pool.trim() || !Number.isSafeInteger(poolCents) || poolCents < 0) {
      setError("Enter a valid pool amount (cents)");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const result = calculatePayout(members, poolCents, mode, {}, {});
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!warId) {
      setError("Select a war first");
      return;
    }
    const { data: run, error: saveError } = await supabase.rpc(
      "save_payout_preview",
      {
        war: warId,
        pool: poolCents,
        allocation_mode: mode,
        allocation_lines: result.lines,
      },
    );
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setActiveRun(run);
    load();
  }

  async function transition(run: Run, status: string) {
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.rpc("transition_payout_run", {
      run: run.id,
      next_status: status,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setActiveRun(data);

    load();
  }

  function exportCsv(run: Run) {
    const rows = lines.filter((l) => l.run_id === run.id);
    downloadBlob(
      new Blob(
        [
          toCsv(
            rows.map((l) => ({
              member_id: l.member_id,
              points: l.eligible_points,
              share_cents: l.share_cents,
              bonus: l.bonus_cents,
              reimbursement: l.reimbursement_cents,
              adjustment: l.adjustment_cents,
              owed: l.amount_owed_cents,
              paid: l.paid_cents,
              status: l.status,
            })),
          ),
        ],
        { type: "text/csv" },
      ),
      `payout-${run.id}.csv`,
    );
  }

  const runLines = activeRun
    ? lines.filter((l) => l.run_id === activeRun.id)
    : [];

  return (
    <section>
      <h2>War Payout Calculator</h2>
      <p className="muted">
        Deterministic payout allocation with 4 modes, largest-remainder integer
        rounding, and a full audit trail. All amounts are integer accounting
        units. This is a private plan using manually entered contributions; it
        does not authorize faction transfers. Weighted mode uses points ×
        weight; hybrid uses 50% equal and 50% proportional.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Configure & calculate</h3>
        <label>
          War
          <select
            className="nu-input"
            value={warId}
            onChange={(e) => setWarId(e.target.value)}
          >
            <option value="">Select a war</option>
            {wars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <select
          className="nu-input"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <SelectEntry kind="money"
          className="nu-input"
          placeholder="Total pool (cents)"
          type="number"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
        />
        {!members.length && (
          <p>
            No members added. Add your actual members and contributions before
            calculating.
          </p>
        )}
        {members.map((m, i) => (
          <div key={m.id} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <DataEntry source="playerName"
              className="nu-input"
              aria-label="Member name"
              placeholder="Member name"
              value={m.name}
              onChange={(e) =>
                setMembers(
                  members.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
            />
            <SelectEntry kind="count"
              className="nu-input"
              type="number"
              value={m.points}
              onChange={(e) =>
                setMembers(
                  members.map((x, j) =>
                    j === i
                      ? { ...x, points: parseInt(e.target.value, 10) || 0 }
                      : x,
                  ),
                )
              }
              placeholder="Points"
              style={{ width: 80 }}
            />
            <SelectEntry kind="weight"
              aria-label="Weight"
              className="nu-input"
              type="number"
              min="0"
              value={m.weight ?? 1}
              onChange={(e) =>
                setMembers(
                  members.map((x, j) =>
                    j === i ? { ...x, weight: Number(e.target.value) } : x,
                  ),
                )
              }
              style={{ width: 70 }}
            />
            <SelectEntry kind="signedMoney"
              className="nu-input"
              type="number"
              value={m.bonus}
              onChange={(e) =>
                setMembers(
                  members.map((x, j) =>
                    j === i
                      ? { ...x, bonus: parseInt(e.target.value, 10) || 0 }
                      : x,
                  ),
                )
              }
              placeholder="Bonus"
              style={{ width: 80 }}
            />
            <button
              className="nu-btn"
              onClick={() =>
                setMembers((rows) => rows.filter((row) => row.id !== m.id))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="nu-btn"
          onClick={() =>
            setMembers([
              ...members,
              {
                id: crypto.randomUUID(),
                name: "",
                points: 0,
                bonus: 0,
                reimbursement: 0,
                adjustment: 0,
              },
            ])
          }
        >
          + Add member
        </button>
        <button
          className="nu-btn"
          disabled={!members.length || !warId || !pool.trim()}
          onClick={createAndRun}
        >
          Calculate & save run
        </button>
      </article>

      {activeRun && (
        <article className="card nu-raised">
          <h3>
            Run {activeRun.id.slice(0, 8)} — {activeRun.status}
          </h3>
          <p>
            Pool: ${(activeRun.total_pool_cents / 100).toFixed(2)} • Allocated:
            ${(activeRun.allocated_cents / 100).toFixed(2)} • Retained: $
            {(activeRun.retained_cents / 100).toFixed(2)}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Member</th>
                <th>Points</th>
                <th>Share</th>
                <th>Owed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runLines.map((l) => {
                const m = members.find((x) => x.id === l.member_id);
                return (
                  <tr key={l.id}>
                    <td style={{ textAlign: "left" }}>
                      {m?.name ?? l.member_id.slice(0, 8)}
                    </td>
                    <td style={{ textAlign: "center" }}>{l.eligible_points}</td>
                    <td style={{ textAlign: "center" }}>
                      ${(l.share_cents / 100).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      ${(l.amount_owed_cents / 100).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>{l.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}
          >
            {activeRun.status === "preview" && (
              <button
                className="nu-btn"
                onClick={() => transition(activeRun, "locked")}
              >
                Lock
              </button>
            )}
            {activeRun.status === "locked" && (
              <button
                className="nu-btn"
                onClick={() => transition(activeRun, "approved")}
              >
                Approve
              </button>
            )}
            {activeRun.status === "approved" && (
              <button
                className="nu-btn"
                onClick={() => transition(activeRun, "paid")}
              >
                Mark paid
              </button>
            )}
            {activeRun.status === "paid" && (
              <button
                className="nu-btn"
                onClick={() => transition(activeRun, "reconciled")}
              >
                Reconcile
              </button>
            )}
            <button className="nu-btn" onClick={() => exportCsv(activeRun)}>
              Export CSV
            </button>
          </div>
        </article>
      )}

      <article className="card nu-inset">
        <h3>Audit log</h3>
        {audit.map((a) => (
          <p key={a.id} className="muted">
            {new Date(a.created_at).toLocaleString()} — {a.action} on run{" "}
            {a.run_id.slice(0, 8)}
          </p>
        ))}
        {audit.length === 0 && <p className="muted">No audit entries yet.</p>}
      </article>
    </section>
  );
}
