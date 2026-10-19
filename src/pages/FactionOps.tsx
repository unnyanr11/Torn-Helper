import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Member {
  id: string;
  torn_id: number;
  name: string;
  role: string;
  level: number;
  last_action: string;
  contribution: number;
}
interface Chain {
  current_chain: number;
  chain_timeout_seconds: number;
  best_chain: number;
}
interface ArmoryItem {
  id: string;
  item_name: string;
  quantity: number;
  total_value: number;
}
interface Territory {
  id: string;
  territory_name: string;
  controlled: boolean;
}

export default function FactionOps() {
  const [members, setMembers] = useState<Member[]>([]);
  const [chain, setChain] = useState<Chain | null>(null);
  const [armory, setArmory] = useState<ArmoryItem[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [error, setError] = useState("");

  const [mTornId, setMTornId] = useState("");
  const [mName, setMName] = useState("");
  const [mRole, setMRole] = useState("Member");
  const [mLevel, setMLevel] = useState("");
  const [chainCur, setChainCur] = useState("");
  const [chainBest, setChainBest] = useState("");
  const [chainTimeout, setChainTimeout] = useState("");
  const [aItem, setAItem] = useState("");
  const [aQty, setAQty] = useState("");
  const [aVal, setAVal] = useState("");
  const [tName, setTName] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [m, c, a, t] = await Promise.all([
      supabase
        .from("faction_members")
        .select("*")
        .eq("user_id", user.id)
        .order("level", { ascending: false }),
      supabase
        .from("faction_chain_state")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("faction_armory")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("faction_territory")
        .select("*")
        .eq("user_id", user.id)
        .order("territory_name"),
    ]);
    if (m.error) setError(m.error.message);
    else setMembers(m.data ?? []);
    if (c.error) setError(c.error.message);
    else setChain(c.data);
    if (a.error) setError(a.error.message);
    else setArmory(a.data ?? []);
    if (t.error) setError(t.error.message);
    else setTerritories(t.data ?? []);
  }

  async function addMember() {
    setError("");
    const tid = parseInt(mTornId, 10);
    const lvl = parseInt(mLevel, 10);
    if (isNaN(tid) || !mName.trim() || isNaN(lvl)) {
      setError("Enter valid Torn ID, name, and level");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_members")
      .upsert(
        {
          user_id: user.id,
          torn_id: tid,
          name: mName.trim(),
          role: mRole,
          level: lvl,
        },
        { onConflict: "user_id,torn_id" },
      );
    if (error) setError(error.message);
    else {
      setMTornId("");
      setMName("");
      setMLevel("");
      load();
    }
  }

  async function removeMember(id: string) {
    await supabase.from("faction_members").delete().eq("id", id);
    load();
  }

  async function saveChain() {
    setError("");
    const cur = parseInt(chainCur, 10) || 0;
    const best = parseInt(chainBest, 10) || 0;
    const timeout = parseInt(chainTimeout, 10) || 0;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_chain_state")
      .upsert(
        {
          user_id: user.id,
          current_chain: cur,
          best_chain: best,
          chain_timeout_seconds: timeout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) setError(error.message);
    else load();
  }

  async function addArmoryItem() {
    setError("");
    const qty = parseInt(aQty, 10);
    const val = parseInt(aVal, 10) || 0;
    if (!aItem.trim() || isNaN(qty) || qty < 0) {
      setError("Enter item name and valid quantity");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_armory")
      .insert({
        user_id: user.id,
        item_name: aItem.trim(),
        quantity: qty,
        total_value: val,
      });
    if (error) setError(error.message);
    else {
      setAItem("");
      setAQty("");
      setAVal("");
      load();
    }
  }

  async function removeArmoryItem(id: string) {
    await supabase.from("faction_armory").delete().eq("id", id);
    load();
  }

  async function addTerritory() {
    setError("");
    if (!tName.trim()) {
      setError("Enter territory name");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("faction_territory")
      .upsert(
        { user_id: user.id, territory_name: tName.trim(), controlled: true },
        { onConflict: "user_id,territory_name" },
      );
    if (error) setError(error.message);
    else {
      setTName("");
      load();
    }
  }

  async function toggleTerritory(t: Territory) {
    await supabase
      .from("faction_territory")
      .update({ controlled: !t.controlled })
      .eq("id", t.id);
    load();
  }

  const totalArmoryValue = armory.reduce((s, a) => s + a.total_value, 0);
  const controlledCount = territories.filter((t) => t.controlled).length;

  return (
    <section>
      <h2>Faction Operations</h2>
      <p className="muted">
        Roster, chain tracking, armory, and territory management for your
        faction.
      </p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Roster ({members.length})</h3>
        <input
          className="nu-input"
          placeholder="Torn ID"
          value={mTornId}
          onChange={(e) => setMTornId(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Name"
          value={mName}
          onChange={(e) => setMName(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Role"
          value={mRole}
          onChange={(e) => setMRole(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Level"
          value={mLevel}
          onChange={(e) => setMLevel(e.target.value)}
        />
        <button className="nu-btn" onClick={addMember}>
          Add / update member
        </button>
        <div style={{ marginTop: 8 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                borderBottom: "1px solid #333",
                padding: "6px 0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                #{m.torn_id} {m.name} — {m.role}, Lv {m.level}
              </span>
              <button className="nu-btn" onClick={() => removeMember(m.id)}>
                ✕
              </button>
            </div>
          ))}
          {members.length === 0 && <p className="muted">No members yet.</p>}
        </div>
      </article>

      <article className="card nu-inset">
        <h3>Chain</h3>
        {chain && (
          <p className="muted">
            Current: {chain.current_chain} • Best: {chain.best_chain} • Timeout:{" "}
            {chain.chain_timeout_seconds}s
          </p>
        )}
        <input
          className="nu-input"
          type="number"
          placeholder="Current chain"
          value={chainCur}
          onChange={(e) => setChainCur(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Best chain"
          value={chainBest}
          onChange={(e) => setChainBest(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Timeout (seconds)"
          value={chainTimeout}
          onChange={(e) => setChainTimeout(e.target.value)}
        />
        <button className="nu-btn" onClick={saveChain}>
          Save chain state
        </button>
      </article>

      <article className="card nu-inset">
        <h3>Armory (total value: {totalArmoryValue.toLocaleString()})</h3>
        <input
          className="nu-input"
          placeholder="Item name"
          value={aItem}
          onChange={(e) => setAItem(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Quantity"
          value={aQty}
          onChange={(e) => setAQty(e.target.value)}
        />
        <input
          className="nu-input"
          type="number"
          placeholder="Total value ($)"
          value={aVal}
          onChange={(e) => setAVal(e.target.value)}
        />
        <button className="nu-btn" onClick={addArmoryItem}>
          Add item
        </button>
        <div style={{ marginTop: 8 }}>
          {armory.map((a) => (
            <div
              key={a.id}
              style={{
                borderBottom: "1px solid #333",
                padding: "6px 0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                {a.item_name} x{a.quantity} — ${a.total_value.toLocaleString()}
              </span>
              <button className="nu-btn" onClick={() => removeArmoryItem(a.id)}>
                ✕
              </button>
            </div>
          ))}
          {armory.length === 0 && <p className="muted">No armory items yet.</p>}
        </div>
      </article>

      <article className="card nu-inset">
        <h3>
          Territory ({controlledCount}/{territories.length} controlled)
        </h3>
        <input
          className="nu-input"
          placeholder="Territory name"
          value={tName}
          onChange={(e) => setTName(e.target.value)}
        />
        <button className="nu-btn" onClick={addTerritory}>
          Add / mark controlled
        </button>
        <div style={{ marginTop: 8 }}>
          {territories.map((t) => (
            <div
              key={t.id}
              style={{
                borderBottom: "1px solid #333",
                padding: "6px 0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                {t.territory_name} — {t.controlled ? "controlled" : "lost"}
              </span>
              <button className="nu-btn" onClick={() => toggleTerritory(t)}>
                {t.controlled ? "Mark lost" : "Mark controlled"}
              </button>
            </div>
          ))}
          {territories.length === 0 && (
            <p className="muted">No territories yet.</p>
          )}
        </div>
      </article>
    </section>
  );
}
