import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface GymRow {
  session_date: string;
  strength_gain: number;
  defense_gain: number;
  speed_gain: number;
  dexterity_gain: number;
}
interface CustomEntry {
  id: string;
  column_id: string;
  value: string;
  recorded_at: string;
}
interface CustomColumn {
  id: string;
  name: string;
  unit: string;
  type: string;
}

function LineChart({
  points,
  label,
}: {
  points: { x: string; y: number }[];
  label: string;
}) {
  if (points.length < 2)
    return <p className="muted">Not enough data points for {label}.</p>;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const w = 300,
    h = 100;
  const step = w / (points.length - 1);
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p.y / maxY) * h).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div>
      <p className="muted">{label}</p>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default function StatGrowth() {
  const [gym, setGym] = useState<GymRow[]>([]);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [entries, setEntries] = useState<CustomEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError("");
    const { data: g, error: gErr } = await supabase
      .from("gym_sessions")
      .select(
        "session_date, strength_gain, defense_gain, speed_gain, dexterity_gain",
      )
      .order("session_date");
    if (gErr) {
      setError(gErr.message);
      return;
    }
    setGym(g ?? []);
    const { data: c, error: cErr } = await supabase
      .from("custom_columns")
      .select("*")
      .order("created_at");
    if (cErr) {
      setError(cErr.message);
      return;
    }
    setColumns(c ?? []);
    const { data: e, error: eErr } = await supabase
      .from("custom_entries")
      .select("*")
      .order("recorded_at");
    if (eErr) {
      setError(eErr.message);
      return;
    }
    setEntries(e ?? []);
  }

  const gymPoints = gym.map((g) => ({
    x: g.session_date,
    y:
      (g.strength_gain ?? 0) +
      (g.defense_gain ?? 0) +
      (g.speed_gain ?? 0) +
      (g.dexterity_gain ?? 0),
  }));

  return (
    <section>
      <h2>Stat Growth</h2>
      <p className="muted">
        Time-series charts computed from your own gym sessions and custom stat
        columns. All native, no external APIs.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        <article className="card nu-inset">
          <h3>🏋️ Gym — total gains per session</h3>
          <LineChart points={gymPoints} label="Gym gains" />
        </article>
        {columns
          .filter((c) => c.type === "number")
          .map((c) => {
            const pts = entries
              .filter((e) => e.column_id === c.id)
              .map((e) => ({ x: e.recorded_at, y: parseFloat(e.value) || 0 }));
            return (
              <article key={c.id} className="card nu-inset">
                <h3>
                  {c.name}
                  {c.unit ? ` (${c.unit})` : ""}
                </h3>
                <LineChart points={pts} label={c.name} />
              </article>
            );
          })}
      </div>
    </section>
  );
}
