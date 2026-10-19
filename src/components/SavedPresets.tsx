import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
export type PresetKind = "comparison" | "leaderboard" | "target_layout" | "roi";
interface Preset {
  id: string;
  name: string;
  config: unknown;
}
/** Explicit save/load: opening a page never mutates a saved configuration. */
export default function SavedPresets({
  kind,
  config,
  onLoad,
  loadLabel = "Load",
}: {
  kind: PresetKind;
  config: unknown;
  onLoad: (config: any) => void | Promise<void>;
  loadLabel?: string;
}) {
  const [rows, setRows] = useState<Preset[]>([]),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const result = await supabase
        .from("workspace_presets")
        .select("id,name,config")
        .eq("kind", kind)
        .order("name");
      if (result.error) throw result.error;
      setRows(result.data ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : ((error as any)?.message ?? "Unable to load presets."),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setSelected("");
    setName("");
    setMessage("");
    void load();
  }, [kind]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to save presets.");
      if (!name.trim() || name.trim().length > 80)
        throw new Error("Enter a preset name of 1–80 characters.");
      const r = await supabase
        .from("workspace_presets")
        .upsert(
          { user_id: user.id, kind, name: name.trim(), config },
          { onConflict: "user_id,kind,name" },
        )
        .select("id")
        .single();
      if (r.error) throw r.error;
      await load();
      setSelected(r.data.id);
      setMessage("Saved.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : String((e as any).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true);
    const r = await supabase
      .from("workspace_presets")
      .delete()
      .eq("id", selected);
    if (r.error) setMessage(r.error.message);
    else {
      setSelected("");
      setName("");
      setMessage("Deleted.");
      await load();
    }
    setBusy(false);
  }
  return (
    <fieldset>
      <legend>Saved presets</legend>
      <label>
        Preset
        <select
          className="nu-input"
          disabled={busy || loading}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            const p = rows.find((r) => r.id === e.target.value);
            setName(p?.name ?? "");
          }}
        >
          <option value="">Choose a preset</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="nu-btn"
        disabled={!selected || busy}
        onClick={async () => {
          const p = rows.find((r) => r.id === selected);
          if (p) {
            try {
              setBusy(true);
              setMessage("Loading…");
              await onLoad(p.config);
              setMessage("Loaded.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Invalid preset");
            } finally {
              setBusy(false);
            }
          }
        }}
      >
        {loadLabel}
      </button>
      <button className="nu-btn" disabled={!selected || busy} onClick={remove}>
        Delete preset
      </button>
      {loading && <p role="status">Loading saved presets…</p>}
      {!loading && !rows.length && (
        <p>
          No saved presets for this page yet. Configure the view, enter a name,
          and save it. Presets store settings; fetched observations are shown by
          the page.
        </p>
      )}
      <label>
        Save current settings as
        <input
          className="nu-input"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button className="nu-btn" disabled={busy} onClick={save}>
        Save / replace by name
      </button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  );
}
