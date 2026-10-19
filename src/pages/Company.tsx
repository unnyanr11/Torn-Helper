import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Snapshot {
  id: string;
  company_name: string | null;
  daily_profit: string | null;
  employees: number | null;
  snapshot_date: string;
}

export default function Company() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [name, setName] = useState("");
  const [profit, setProfit] = useState("");
  const [employees, setEmployees] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("company_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setSnapshots(data ?? []);
  }

  async function addSnapshot() {
    const { error } = await supabase.from("company_snapshots").insert({
      company_name: name.trim() || null,
      daily_profit: profit || null,
      employees: employees ? parseInt(employees) : null,
    });
    if (error) setError(error.message);
    else {
      setProfit("");
      setEmployees("");
      load();
    }
  }

  return (
    <section>
      <h2>Company</h2>
      <p className="muted">
        Saved daily snapshots. Use the official Torn data link above for company
        data available to your key and company role.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log daily snapshot</h3>
        <input
          className="nu-input"
          placeholder="Company name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Daily profit"
          value={profit}
          onChange={(e) => setProfit(e.target.value)}
        />
        <input
          className="nu-input"
          placeholder="Employees"
          value={employees}
          onChange={(e) => setEmployees(e.target.value)}
        />
        <button className="nu-btn" onClick={addSnapshot}>
          Save snapshot
        </button>
      </article>
      <article className="card nu-raised">
        <h3>Recent snapshots</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Profit</th>
              <th>Employees</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id}>
                <td>{s.snapshot_date}</td>
                <td>{s.company_name ?? "—"}</td>
                <td>{s.daily_profit ?? "—"}</td>
                <td>{s.employees ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length === 0 && <p className="muted">No snapshots yet.</p>}
      </article>
    </section>
  );
}
