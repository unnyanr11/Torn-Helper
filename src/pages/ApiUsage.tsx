import SelectEntry from "../components/SelectEntry";
import { useState } from "react";
import { CAPABILITIES } from "../api/capabilities";

export default function ApiUsage() {
  const [filter, setFilter] = useState("");
  return (
    <section>
      <h2>API Usage</h2>
      <p className="muted">
        Connected sections from the official Torn specification. Open any section
        to fetch data through the private data browser. Access labels describe
        documented requirements; Torn checks your actual key and role permissions.
      </p>
      <label>
        Search endpoints
        <SelectEntry label="Endpoint" value={filter} onChange={e=>setFilter(e.target.value)} options={CAPABILITIES.map(c=>({value:c.path,label:`${c.group} · ${c.path}`}))} emptyText="All endpoints"/>
      </label>
      <p>
        {CAPABILITIES.length} official read endpoints; browsing does not poll
        them.
      </p>
      <div className="grid">
        {CAPABILITIES.filter((c) =>
          (c.path + " " + c.summary)
            .toLowerCase()
            .includes(filter.toLowerCase()),
        ).map((c) => (
          <article key={c.id} className="card nu-raised">
            <h3>
              {c.group} · {c.path}
            </h3>
            <p className="value" style={{ fontSize: "1rem" }}>
              {c.summary}
            </p>
            <div className="meta">
              <span className="badge">{c.version}</span>
              <span className="badge">{c.requiredAccess}</span>
              <span className="badge">{c.privacy}</span>
              <span className="badge">{c.pagination}</span>
              <span className={`badge ${c.verified ? "ok" : "warn"}`}>
                {c.verified ? "✓ Verified" : "⚠ Needs review"}
              </span>
            </div>
            <a
              className="nu-btn"
              href={`#Live%20Feeds?section=${encodeURIComponent(c.id)}`}
            >
              Open this data section
            </a>
            {c.queryParams.length > 0 && (
              <p className="muted">Params: {c.queryParams.join(", ")}</p>
            )}
            <p className="muted">
              Features:{" "}
              {c.features.length ? c.features.join(", ") : "none mapped yet"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
