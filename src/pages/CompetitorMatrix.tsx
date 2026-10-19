import { useState } from "react";
import { COMPETITOR_MATRIX, MatrixRow } from "../data/competitors";

export default function CompetitorMatrix() {
  const [filter, setFilter] = useState("");
  const rows = COMPETITOR_MATRIX.filter(
    (r) =>
      r.feature.toLowerCase().includes(filter.toLowerCase()) ||
      r.competitor.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <section>
      <h2>Competitor Coverage Matrix</h2>
      <p className="muted">
        Public-documentation coverage audit. No partial, blocked or
        authenticated-but-unverified workflow is counted as delivered. Screens
        alone do not establish competitor parity.
      </p>
      <input
        className="nu-input"
        placeholder="Filter by feature or competitor"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #555", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Feature</th>
              <th style={{ padding: 8 }}>Competitor</th>
              <th style={{ padding: 8 }}>Source</th>
              <th style={{ padding: 8 }}>Checked</th>
              <th style={{ padding: 8 }}>Pricing</th>
              <th style={{ padding: 8 }}>Acceptance test</th>
              <th style={{ padding: 8 }}>Our screen / status</th>
              <th style={{ padding: 8 }}>Source verification</th>
              <th style={{ padding: 8 }}>Dependency blocker</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: MatrixRow, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 8 }}>{r.feature}</td>
                <td style={{ padding: 8 }}>{r.competitor}</td>
                <td style={{ padding: 8 }}>
                  {r.sourceUrl ? (
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                      link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ padding: 8 }}>{r.dateChecked}</td>
                <td style={{ padding: 8 }}>
                  <span className="badge">{r.freemium}</span>
                </td>
                <td style={{ padding: 8 }}>{r.acceptanceTest}</td>
                <td style={{ padding: 8 }}>
                  {r.screen}: {r.status}
                </td>
                <td style={{ padding: 8 }}>{r.verification}</td>
                <td style={{ padding: 8 }}>
                  {r.externalDependency || "Workflow acceptance still pending"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted">No matching rows.</p>}
    </section>
  );
}
