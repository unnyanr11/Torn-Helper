import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface OcPlan {
  id: string;
  oc_name: string;
  oc_type: string;
  status: string;
  slots_total: number;
  slots_filled: number;
  success_rate: number;
  notes: string;
}
interface OcSlot {
  id: string;
  plan_id: string;
  slot_name: string;
  required_level: number;
  assigned_member_name: string;
  status: string;
}

export default function OcPlanner() {
  const [plans, setPlans] = useState<OcPlan[]>([]);
  const [slots, setSlots] = useState<OcSlot[]>([]);
  const [error, setError] = useState("");

  const [pName, setPName] = useState("");
  const [pType, setPType] = useState("standard");
  const [pSlots, setPSlots] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [sName, setSName] = useState("");
  const [sLevel, setSLevel] = useState("");
  const [sMember, setSMember] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [p, s] = await Promise.all([
      supabase
        .from("oc_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("oc_slots")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);
    if (p.error) setError(p.error.message);
    else setPlans(p.data ?? []);
    if (s.error) setError(s.error.message);
    else setSlots(s.data ?? []);
  }

  async function createPlan() {
    setError("");
    const total = parseInt(pSlots, 10);
    if (!pName.trim() || isNaN(total) || total <= 0) {
      setError("Enter OC name and valid slot count");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("oc_plans")
      .insert({
        user_id: user.id,
        oc_name: pName.trim(),
        oc_type: pType,
        slots_total: total,
        notes: pNotes.trim() || null,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    // Auto-create open slots
    for (let i = 1; i <= total; i++) {
      await supabase
        .from("oc_slots")
        .insert({
          plan_id: data.id,
          slot_name: `Slot ${i}`,
          required_level: 1,
          status: "open",
        });
    }
    setPName("");
    setPNotes("");
    load();
  }

  async function assignSlot(slot: OcSlot) {
    setError("");
    if (!sMember.trim()) {
      setError("Enter member name to assign");
      return;
    }
    const { error } = await supabase
      .from("oc_slots")
      .update({ assigned_member_name: sMember.trim(), status: "filled" })
      .eq("id", slot.id);
    if (error) setError(error.message);
    else {
      setSMember("");
      load();
    }
  }

  async function markSlotReady(slot: OcSlot) {
    await supabase
      .from("oc_slots")
      .update({ status: "ready" })
      .eq("id", slot.id);
    load();
  }

  async function launchPlan(plan: OcPlan) {
    setError("");
    const planSlots = slots.filter((s) => s.plan_id === plan.id);
    const allReady = planSlots.every(
      (s) => s.status === "ready" || s.status === "completed",
    );
    if (!allReady) {
      setError("Not all slots are ready yet");
      return;
    }
    const { error } = await supabase
      .from("oc_plans")
      .update({ status: "launched", updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) setError(error.message);
    else load();
  }

  async function removePlan(id: string) {
    await supabase.from("oc_plans").delete().eq("id", id);
    load();
  }

  return (
    <section>
      <h2>OC Planner</h2>
      <p className="muted">
        Plan organized crime runs: create a plan with slots, assign members,
        mark readiness, and launch when all slots are ready.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>New OC plan</h3>
        <input
          className="nu-input"
          placeholder="OC name (e.g. 'Bank Heist')"
          value={pName}
          onChange={(e) => setPName(e.target.value)}
        />
        <select
          className="nu-input"
          value={pType}
          onChange={(e) => setPType(e.target.value)}
        >
          <option value="standard">Standard</option>
          <option value="event">Event</option>
        </select>
        <input
          className="nu-input"
          type="number"
          min="1"
          placeholder="Total slots"
          value={pSlots}
          onChange={(e) => setPSlots(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Notes (optional)"
          value={pNotes}
          onChange={(e) => setPNotes(e.target.value)}
        />
        <button className="nu-btn" onClick={createPlan}>
          Create plan
        </button>
      </article>

      <div className="grid">
        {plans.map((p) => {
          const planSlots = slots.filter((s) => s.plan_id === p.id);
          const filled = planSlots.filter((s) => s.status !== "open").length;
          const ready = planSlots.filter(
            (s) => s.status === "ready" || s.status === "completed",
          ).length;
          return (
            <article key={p.id} className="card nu-inset">
              <h3>
                {p.oc_name} ({p.oc_type})
              </h3>
              <p className="badge">{p.status}</p>
              <p>
                Slots: {filled}/{p.slots_total} filled • {ready} ready
              </p>
              {p.notes && (
                <p className="muted" style={{ fontSize: 12 }}>
                  {p.notes}
                </p>
              )}
              <button
                className="nu-btn"
                onClick={() => setActivePlan(activePlan === p.id ? null : p.id)}
              >
                {activePlan === p.id ? "Hide slots" : "Manage slots"}
              </button>
              {activePlan === p.id && (
                <div style={{ marginTop: 8 }}>
                  {planSlots.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        borderBottom: "1px solid #333",
                        padding: "6px 0",
                      }}
                    >
                      <span>
                        {s.slot_name} (Lv {s.required_level}+) — {s.status}
                        {s.assigned_member_name
                          ? ` — ${s.assigned_member_name}`
                          : ""}
                      </span>
                      {s.status === "open" && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <input
                            className="nu-input"
                            placeholder="Member name"
                            value={sMember}
                            onChange={(e) => setSMember(e.target.value)}
                          />
                          <button
                            className="nu-btn"
                            onClick={() => assignSlot(s)}
                          >
                            Assign
                          </button>
                        </div>
                      )}
                      {s.status === "filled" && (
                        <button
                          className="nu-btn"
                          onClick={() => markSlotReady(s)}
                        >
                          Mark ready
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="nu-btn"
                    onClick={() => launchPlan(p)}
                    disabled={p.status !== "planning"}
                  >
                    Launch OC
                  </button>
                  <button className="nu-btn" onClick={() => removePlan(p.id)}>
                    Delete plan
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {plans.length === 0 && <p className="muted">No OC plans yet.</p>}
      </div>
    </section>
  );
}
