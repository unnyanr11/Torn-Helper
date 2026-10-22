import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UpgradeSim { id: string; branch_name: string; current_level: number; target_level: number; respect_per_level: number; notes: string }

export default function FactionUpgrades() {
  const [sims, setSims] = useState<UpgradeSim[]>([]);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState(''); const [curLvl, setCurLvl] = useState('0'); const [tgtLvl, setTgtLvl] = useState('1'); const [rspPerLvl, setRspPerLvl] = useState(''); const [notes, setNotes] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('faction_upgrade_simulations').select('*').eq('user_id', user.id).order('branch_name');
    if (error) setError(error.message); else setSims(data ?? []);
  }

  async function saveSim() {
    setError('');
    const cur = parseInt(curLvl, 10);
    const tgt = parseInt(tgtLvl, 10);
    const rsp = parseInt(rspPerLvl, 10) || 0;
    if (!branch.trim() || isNaN(cur) || cur < 0 || isNaN(tgt) || tgt < 1 || tgt <= cur) { setError('Enter valid branch, current level, and target level (target must be > current)'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('faction_upgrade_simulations').upsert({ user_id: user.id, branch_name: branch.trim(), current_level: cur, target_level: tgt, respect_per_level: rsp, notes: notes.trim() || null }, { onConflict: 'user_id,branch_name' });
    if (error) setError(error.message);
    else { setBranch(''); setCurLvl('0'); setTgtLvl('1'); setRspPerLvl(''); setNotes(''); load(); }
  }

  async function removeSim(id: string) {
    await supabase.from('faction_upgrade_simulations').delete().eq('id', id);
    load();
  }

  const totalRespect = sims.reduce((s, sim) => s + (sim.target_level - sim.current_level) * sim.respect_per_level, 0);

  return (
    <section>
      <h2>Faction Upgrade Simulation</h2>
      <p className="muted">Plan respect spending across faction upgrade branches. Enter your current level, target level, and respect cost per level (from in-game observation or community reference). Totals are calculated, not fetched live.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Total respect needed: {totalRespect.toLocaleString()}</h3>
        <p className="muted">Across {sims.length} branch simulation(s).</p>
      </article>

      <article className="card nu-inset">
        <h3>Add / update branch simulation</h3>
        <DataEntry source="upgrade" className="nu-input" placeholder="Branch name (e.g. Candy, Strikes, Terror)" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <SelectEntry kind="count" className="nu-input" type="number" min="0" placeholder="Current level" value={curLvl} onChange={(e) => setCurLvl(e.target.value)} />
        <SelectEntry kind="level" className="nu-input" type="number" min="1" placeholder="Target level" value={tgtLvl} onChange={(e) => setTgtLvl(e.target.value)} />
        <SelectEntry kind="count" className="nu-input" type="number" min="0" placeholder="Respect per level" value={rspPerLvl} onChange={(e) => setRspPerLvl(e.target.value)} />
        <input className="nu-input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="nu-btn" onClick={saveSim}>Save simulation</button>
        <p className="muted" style={{ marginTop: 6 }}>Respect costs vary by branch and level — verify current values in-game before relying on totals.</p>
      </article>

      <div className="grid">
        {sims.map((s) => {
          const levels = s.target_level - s.current_level;
          const cost = levels * s.respect_per_level;
          return (
            <article key={s.id} className="card nu-inset">
              <h3>{s.branch_name}</h3>
              <p>Lv {s.current_level} → Lv {s.target_level} ({levels} level(s))</p>
              <p><b>Respect needed:</b> {cost.toLocaleString()}</p>
              {s.notes && <p className="muted" style={{ fontSize: 12 }}>{s.notes}</p>}
              <button className="nu-btn" onClick={() => removeSim(s.id)}>Delete</button>
            </article>
          );
        })}
        {sims.length === 0 && <p className="muted">No branch simulations yet.</p>}
      </div>
    </section>
  );
}
