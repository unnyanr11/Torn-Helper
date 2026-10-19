import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TargetList { id: string; name: string; mode: string; }
interface Entry {
  id: string;
  torn_player_id: string;
  player_name: string | null;
  level: number | null;
  status: string | null;
  notes: string | null;
  excluded: boolean;
}

export default function Targets() {
  const [lists, setLists] = useState<TargetList[]>([]);
  const [activeList, setActiveList] = useState<TargetList | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [listName, setListName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [level, setLevel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { if (activeList) loadEntries(activeList.id); }, [activeList]);

  async function loadLists() {
    const { data, error } = await supabase.from('target_lists').select('*').order('created_at');
    if (error) setError(error.message);
    else {
      setLists(data ?? []);
      if (!activeList && data?.length) setActiveList(data[0]);
    }
  }

  async function loadEntries(listId: string) {
    const { data, error } = await supabase.from('target_list_entries').select('*').eq('list_id', listId).order('created_at');
    if (error) setError(error.message);
    else setEntries(data ?? []);
  }

  async function addList() {
    if (!listName.trim()) return;
    const { data, error } = await supabase.from('target_lists').insert({ name: listName.trim(), mode: 'levelling' }).select().single();
    if (error) setError(error.message);
    else { setListName(''); setActiveList(data); loadLists(); }
  }

  async function addEntry() {
    if (!activeList || !playerId.trim()) return;
    const { error } = await supabase.from('target_list_entries').insert({
      list_id: activeList.id,
      torn_player_id: playerId.trim(),
      player_name: playerName.trim() || null,
      level: level ? parseInt(level) : null,
    });
    if (error) setError(error.message);
    else { setPlayerId(''); setPlayerName(''); setLevel(''); loadEntries(activeList.id); }
  }

  async function removeEntry(id: string) {
    const { error } = await supabase.from('target_list_entries').delete().eq('id', id);
    if (error) setError(error.message);
    else if (activeList) loadEntries(activeList.id);
  }

  return (
    <section>
      <h2>Targets</h2>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Levelling lists</h3>
        <input className="nu-input" placeholder="New list name" value={listName} onChange={(e) => setListName(e.target.value)} />
        <button className="nu-btn" onClick={addList}>Create list</button>
        <div className="meta">
          {lists.map((l) => (
            <button key={l.id} className={`nu-btn ${activeList?.id === l.id ? 'active' : ''}`} onClick={() => setActiveList(l)}>{l.name}</button>
          ))}
        </div>
      </article>
      {activeList && (
        <article className="card nu-raised">
          <h3>{activeList.name} <span className="badge">{activeList.mode}</span></h3>
          <input className="nu-input" placeholder="Torn player ID" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
          <input className="nu-input" placeholder="Player name (optional)" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          <input className="nu-input" placeholder="Level (optional)" value={level} onChange={(e) => setLevel(e.target.value)} />
          <button className="nu-btn" onClick={addEntry}>Add target</button>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Level</th><th>Attack</th><th></th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.torn_player_id}</td>
                  <td>{e.player_name ?? '—'}</td>
                  <td>{e.level ?? '—'}</td>
                  <td><a href={`https://www.torn.com/loader.php?sid=attack&user2ID=${e.torn_player_id}`} target="_blank" rel="noreferrer">Attack</a></td>
                  <td><button className="nu-btn" onClick={() => removeEntry(e.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <p className="muted">No targets in this list yet.</p>}
        </article>
      )}
    </section>
  );
}
