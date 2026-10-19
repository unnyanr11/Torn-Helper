import { useEffect, useState } from "react";
import SavedPresets from "../components/SavedPresets";
import { supabase } from "../lib/supabase";

interface TargetList {
  id: string;
  name: string;
  mode: string;
}
interface Entry {
  id: string;
  torn_player_id: string;
  player_name: string | null;
  level: number | null;
  status: string | null;
  last_checked_at: string | null;
  notes: string | null;
  excluded: boolean;
}

export default function Targets() {
  const [layout, setLayout] = useState({
    version: 1,
    columns: ["id", "name", "level", "status", "checked", "attack"],
    sort: "name",
    descending: false,
    filter: "",
    showExcluded: false,
  });
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [pinned, setPinned] = useState<string[]>([]);
  const [lists, setLists] = useState<TargetList[]>([]);
  const [activeList, setActiveList] = useState<TargetList | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [listName, setListName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [level, setLevel] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");

  useEffect(() => {
    loadLists();
  }, []);
  useEffect(() => {
    if (activeList) loadEntries(activeList.id);
  }, [activeList]);

  async function loadLists() {
    const { data, error } = await supabase
      .from("target_lists")
      .select("*")
      .order("created_at");
    if (error) setError(error.message);
    else {
      setLists(data ?? []);
      if (!activeList && data?.length) setActiveList(data[0]);
    }
  }

  async function loadEntries(listId: string) {
    const { data, error } = await supabase
      .from("target_list_entries")
      .select("*")
      .eq("list_id", listId)
      .order("created_at");
    if (error) setError(error.message);
    else setEntries(data ?? []);
  }

  async function addList() {
    if (!listName.trim()) return;
    const { data, error } = await supabase
      .from("target_lists")
      .insert({ name: listName.trim(), mode: "levelling" })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setListName("");
      setActiveList(data);
      loadLists();
    }
  }

  async function addEntry() {
    if (!activeList || !playerId.trim()) return;
    if (
      !Number.isSafeInteger(Number(playerId)) ||
      Number(playerId) <= 0 ||
      (level &&
        (!Number.isInteger(Number(level)) ||
          Number(level) < 1 ||
          Number(level) > 100))
    ) {
      setError("Enter a positive whole player ID and a level from 1 to 100.");
      return;
    }
    const { error } = await supabase.from("target_list_entries").insert({
      list_id: activeList.id,
      torn_player_id: playerId.trim(),
      player_name: playerName.trim() || null,
      level: level ? Number(level) : null,
    });
    if (error) setError(error.message);
    else {
      setPlayerId("");
      setPlayerName("");
      setLevel("");
      loadEntries(activeList.id);
    }
  }

  async function removeEntry(id: string) {
    const { error } = await supabase
      .from("target_list_entries")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else if (activeList) loadEntries(activeList.id);
  }

  async function refreshStatus() {
    if (!activeList) return;
    setRefreshing(true);
    setRefreshResult("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Not signed in");
      setRefreshing(false);
      return;
    }
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-targets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listId: activeList.id }),
      },
    );
    const data = await res.json();
    setRefreshing(false);
    if (!res.ok) {
      setError(data.error ?? "Refresh failed");
      return;
    }
    setRefreshResult(`Refreshed ${data.refreshed} target(s)`);
    loadEntries(activeList.id);
  }

  const visible = entries
    .filter(
      (e) =>
        (layout.showExcluded || !e.excluded) &&
        `${e.torn_player_id} ${e.player_name ?? ""} ${e.status ?? ""} ${e.notes ?? ""}`
          .toLowerCase()
          .includes(layout.filter.toLowerCase()),
    )
    .sort((a, b) => {
      const x =
        layout.sort === "level"
          ? a.level
          : layout.sort === "id"
            ? Number(a.torn_player_id)
            : layout.sort === "status"
              ? a.status
              : a.player_name;
      const y =
        layout.sort === "level"
          ? b.level
          : layout.sort === "id"
            ? Number(b.torn_player_id)
            : layout.sort === "status"
              ? b.status
              : b.player_name;
      const n =
        x == null
          ? y == null
            ? 0
            : 1
          : y == null
            ? -1
            : typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y));
      return layout.descending ? -n : n;
    });
  const styleFor = (key: string) => ({
    minWidth: widths[key] ?? 140,
    width: widths[key] ?? 140,
    maxWidth: widths[key] ?? 140,
    overflowWrap: "anywhere" as const,
    ...(pinned.includes(key)
      ? {
          position: "sticky" as const,
          left: layout.columns
            .slice(0, layout.columns.indexOf(key))
            .filter((k) => pinned.includes(k))
            .reduce((sum, k) => sum + (widths[k] ?? 140), 0),
          background: "var(--bg)",
          zIndex: 2,
        }
      : {}),
  });
  function moveColumn(key: string, direction: number) {
    setLayout((v) => {
      const columns = [...v.columns],
        i = columns.indexOf(key),
        j = i + direction;
      if (i < 0 || j < 0 || j >= columns.length) return v;
      [columns[i], columns[j]] = [columns[j], columns[i]];
      return { ...v, columns };
    });
  }
  const columnLabels: Record<string, string> = {
    id: "ID",
    name: "Name",
    level: "Level",
    status: "Status",
    checked: "Checked",
    attack: "Attack",
  };
  return (
    <section>
      <h2>Targets</h2>
      {error && <p className="badge warn">{error}</p>}
      {refreshResult && <p className="badge ok">{refreshResult}</p>}
      <article className="card nu-inset">
        <h3>Levelling lists</h3>
        <input
          className="nu-input"
          placeholder="New list name"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
        />
        <button className="nu-btn" onClick={addList}>
          Create list
        </button>
        <div className="meta">
          {lists.map((l) => (
            <button
              key={l.id}
              className={`nu-btn ${activeList?.id === l.id ? "active" : ""}`}
              onClick={() => setActiveList(l)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </article>
      <SavedPresets
        kind="target_layout"
        config={{ ...layout, widths, pinned }}
        onLoad={(c) => {
          if (
            c?.version !== 1 ||
            !Array.isArray(c.columns) ||
            !c.columns.length ||
            c.columns.some(
              (v: any) =>
                ![
                  "id",
                  "name",
                  "level",
                  "status",
                  "checked",
                  "attack",
                ].includes(v),
            ) ||
            new Set(c.columns).size !== c.columns.length ||
            !["id", "name", "level", "status"].includes(c.sort) ||
            typeof c.descending !== "boolean" ||
            typeof c.filter !== "string" ||
            typeof c.showExcluded !== "boolean"
          )
            throw new Error("Invalid target layout");
          if (
            c.widths &&
            (typeof c.widths !== "object" ||
              Object.values(c.widths).some(
                (w: any) => !Number.isInteger(w) || w < 80 || w > 600,
              ))
          )
            throw new Error("Invalid column width");
          if (
            c.pinned &&
            (!Array.isArray(c.pinned) ||
              c.pinned.some((k: any) => !c.columns.includes(k)))
          )
            throw new Error("Invalid pinned columns");
          setLayout(c);
          setWidths(c.widths ?? {});
          setPinned(c.pinned ?? []);
        }}
      />
      <fieldset>
        <legend>Table layout</legend>
        {["id", "name", "level", "status", "checked", "attack"].map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layout.columns.includes(key)}
              onChange={(e) =>
                setLayout((v) => ({
                  ...v,
                  columns: e.target.checked
                    ? [...v.columns, key]
                    : v.columns.length > 1
                      ? v.columns.filter((c) => c !== key)
                      : v.columns,
                }))
              }
            />
            {columnLabels[key]}
          </label>
        ))}
        <label>
          Sort
          <select
            className="nu-input"
            value={layout.sort}
            onChange={(e) => setLayout((v) => ({ ...v, sort: e.target.value }))}
          >
            {["id", "name", "level", "status"].map((c) => (
              <option key={c} value={c}>
                {columnLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={layout.descending}
            onChange={(e) =>
              setLayout((v) => ({ ...v, descending: e.target.checked }))
            }
          />
          Descending
        </label>
        <label>
          Search
          <input
            className="nu-input"
            value={layout.filter}
            onChange={(e) =>
              setLayout((v) => ({ ...v, filter: e.target.value }))
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={layout.showExcluded}
            onChange={(e) =>
              setLayout((v) => ({ ...v, showExcluded: e.target.checked }))
            }
          />
          Show excluded
        </label>
      </fieldset>
      <details>
        <summary>Column order, widths and pinning</summary>
        {layout.columns.map((key, i) => (
          <div key={key}>
            <span>{columnLabels[key]}</span>
            <button
              className="nu-btn"
              aria-label={`Move ${columnLabels[key]} left`}
              disabled={i === 0}
              onClick={() => moveColumn(key, -1)}
            >
              ←
            </button>
            <button
              className="nu-btn"
              aria-label={`Move ${columnLabels[key]} right`}
              disabled={i === layout.columns.length - 1}
              onClick={() => moveColumn(key, 1)}
            >
              →
            </button>
            <label>
              Width (80–600 px)
              <input
                className="nu-input"
                type="number"
                min="80"
                max="600"
                value={widths[key] ?? 140}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 80 && n <= 600)
                    setWidths((w) => ({ ...w, [key]: n }));
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={pinned.includes(key)}
                onChange={(e) =>
                  setPinned((p) =>
                    e.target.checked ? [...p, key] : p.filter((k) => k !== key),
                  )
                }
              />
              Pin column
            </label>
          </div>
        ))}
      </details>
      {activeList && (
        <article className="card nu-raised">
          <h3>
            {activeList.name} <span className="badge">{activeList.mode}</span>
          </h3>
          <input
            className="nu-input"
            placeholder="Torn player ID"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          />
          <input
            className="nu-input"
            placeholder="Player name (optional)"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <input
            className="nu-input"
            placeholder="Level (optional)"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <button className="nu-btn" onClick={addEntry}>
            Add target
          </button>
          <button
            className="nu-btn"
            onClick={refreshStatus}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                tableLayout: "fixed",
                width: layout.columns.reduce(
                  (n, c) => n + (widths[c] ?? 140),
                  200,
                ),
              }}
            >
              <thead>
                <tr>
                  {layout.columns.map((c) => (
                    <th key={c} style={styleFor(c)}>
                      {columnLabels[c]}
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id}>
                    {layout.columns.map((c) => (
                      <td key={c} style={styleFor(c)}>
                        {c === "id" ? (
                          e.torn_player_id
                        ) : c === "name" ? (
                          (e.player_name ?? "—")
                        ) : c === "level" ? (
                          (e.level ?? "—")
                        ) : c === "status" ? (
                          (e.status ?? "—")
                        ) : c === "checked" ? (
                          e.last_checked_at ? (
                            new Date(e.last_checked_at).toLocaleString()
                          ) : (
                            "—"
                          )
                        ) : (
                          <a
                            href={`https://www.torn.com/loader.php?sid=attack&user2ID=${e.torn_player_id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Attack
                          </a>
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        className="nu-btn"
                        onClick={async () => {
                          const r = await supabase
                            .from("target_list_entries")
                            .update({ excluded: !e.excluded })
                            .eq("id", e.id);
                          if (r.error) setError(r.error.message);
                          else loadEntries(activeList.id);
                        }}
                      >
                        {e.excluded ? "Include" : "Exclude"}
                      </button>
                      <button
                        className="nu-btn"
                        onClick={() => removeEntry(e.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {visible.length} of {entries.length} targets shown.
          </p>
          {entries.length === 0 && (
            <p className="muted">No targets in this list yet.</p>
          )}
        </article>
      )}
    </section>
  );
}
