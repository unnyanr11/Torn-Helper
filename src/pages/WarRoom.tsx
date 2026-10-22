import DataEntry from "../components/DataEntry";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface War { id: string; name: string; enemy_faction_name: string | null; status: string; }
interface Claim { id: string; torn_player_id: string; user_id: string; expires_at: string; released_at: string | null; }

export default function WarRoom() {
  const [wars, setWars] = useState<War[]>([]);
  const [activeWar, setActiveWar] = useState<War | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [warName, setWarName] = useState('');
  const [enemyName, setEnemyName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadWars(); }, []);
  useEffect(() => { if (activeWar) loadClaims(activeWar.id); }, [activeWar]);

  async function loadWars() {
    const { data, error } = await supabase.from('wars').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setWars(data ?? []);
      if (!activeWar && data?.length) setActiveWar(data[0]);
    }
  }

  async function loadClaims(warId: string) {
    const { data, error } = await supabase.from('target_claims').select('*').eq('war_id', warId).is('released_at', null).order('claimed_at', { ascending: false });
    if (error) setError(error.message);
    else setClaims(data ?? []);
  }

  async function createWar() {
    if (!warName.trim()) return;
    const { data, error } = await supabase.from('wars').insert({ name: warName.trim(), enemy_faction_name: enemyName.trim() || null }).select().single();
    if (error) setError(error.message);
    else { setWarName(''); setEnemyName(''); setActiveWar(data); loadWars(); }
  }

  async function claimTarget() {
    if (!activeWar || !targetId.trim()) return;
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase.from('target_claims').insert({ war_id: activeWar.id, torn_player_id: targetId.trim(), expires_at: expires });
    if (error) setError(error.message);
    else { setTargetId(''); loadClaims(activeWar.id); }
  }

  async function releaseClaim(id: string) {
    const { error } = await supabase.from('target_claims').update({ released_at: new Date().toISOString() }).eq('id', id);
    if (error) setError(error.message);
    else if (activeWar) loadClaims(activeWar.id);
  }

  return (
    <section>
      <h2>War Room</h2>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Create war</h3>
        <input className="nu-input" placeholder="War name" value={warName} onChange={(e) => setWarName(e.target.value)} />
        <DataEntry source="factionName" className="nu-input" placeholder="Enemy faction (optional)" value={enemyName} onChange={(e) => setEnemyName(e.target.value)} />
        <button className="nu-btn" onClick={createWar}>Create</button>
        <div className="meta">
          {wars.map((w) => (
            <button key={w.id} className={`nu-btn ${activeWar?.id === w.id ? 'active' : ''}`} onClick={() => setActiveWar(w)}>{w.name}</button>
          ))}
        </div>
      </article>
      {activeWar && (
        <article className="card nu-raised">
          <h3>{activeWar.name} <span className="badge">{activeWar.status}</span></h3>
          <p className="muted">Enemy: {activeWar.enemy_faction_name ?? '—'}</p>
          <DataEntry source="player" type="number" min="1" step="1" className="nu-input" placeholder="Torn target ID to claim" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          <button className="nu-btn" onClick={claimTarget}>Claim target (15 min)</button>
          <p className="muted">Claims coordinate app users only — they do not reserve targets in Torn.</p>
          <table>
            <thead><tr><th>Target</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.torn_player_id}</td>
                  <td>{new Date(c.expires_at).toLocaleTimeString()}</td>
                  <td><button className="nu-btn" onClick={() => releaseClaim(c.id)}>Release</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {claims.length === 0 && <p className="muted">No active claims.</p>}
        </article>
      )}
    </section>
  );
}
