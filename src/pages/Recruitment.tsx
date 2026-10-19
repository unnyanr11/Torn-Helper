import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Candidate { id: string; torn_player_id: number; player_name: string; level: number | null; faction_name: string | null; stage: string; match_score: number | null; notes: string | null; }

const STAGES = ['new', 'shortlisted', 'contacted', 'rejected', 'joined'];

export default function Recruitment() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [level, setLevel] = useState('');
  const [minLevel, setMinLevel] = useState('10');
  const [maxLevel, setMaxLevel] = useState('50');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('recruitment_candidates').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setCandidates(data ?? []);
  }

  async function addCandidate() {
    if (!playerId.trim() || !playerName.trim()) { setError('Enter player ID and name'); return; }
    const lvl = level ? parseInt(level) : null;
    const min = parseInt(minLevel) || 1;
    const max = parseInt(maxLevel) || 100;
    let score = 50;
    if (lvl != null) {
      if (lvl < min || lvl > max) score = 0;
      else score = 100 - Math.abs(lvl - (min + max) / 2);
    }
    const { error } = await supabase.from('recruitment_candidates').insert({
      torn_player_id: parseInt(playerId),
      player_name: playerName.trim(),
      level: lvl,
      match_score: score,
    });
    if (error) setError(error.message);
    else { setPlayerId(''); setPlayerName(''); setLevel(''); load(); }
  }

  async function setStage(id: string, stage: string) {
    const { error } = await supabase.from('recruitment_candidates').update({ stage }).eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  async function removeCandidate(id: string) {
    const { error } = await supabase.from('recruitment_candidates').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Recruitment Scanner</h2>
      <p className="muted">Track recruitment candidates with review stages and a simple level-based match score. Private applicant data requires consent.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Requirements</h3>
        <input className="nu-input" placeholder="Min level" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} />
        <input className="nu-input" placeholder="Max level" value={maxLevel} onChange={(e) => setMaxLevel(e.target.value)} />
      </article>
      <article className="card nu-inset">
        <h3>Add candidate</h3>
        <input className="nu-input" placeholder="Torn player ID" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
        <input className="nu-input" placeholder="Player name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
        <input className="nu-input" placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} />
        <button className="nu-btn" onClick={addCandidate}>Add</button>
      </article>
      <article className="card nu-raised">
        <h3>Candidates ({candidates.length})</h3>
        <table>
          <thead><tr><th>Player</th><th>Level</th><th>Score</th><th>Stage</th><th></th></tr></thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.player_name} ({c.torn_player_id})</td>
                <td>{c.level ?? '—'}</td>
                <td>{c.match_score ?? '—'}</td>
                <td>
                  <select className="nu-input" value={c.stage} onChange={(e) => setStage(c.id, e.target.value)}>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button className="nu-btn" onClick={() => removeCandidate(c.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <p className="muted">No candidates yet.</p>}
      </article>
    </section>
  );
}
