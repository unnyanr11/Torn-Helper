import { useState } from "react";
import { CAPABILITIES } from "../api/capabilities";

export default function ApiUsage() {
  const [filter, setFilter] = useState("");
  return (
    <section>
      <h2>API Usage</h2>
      <p className="muted">
        Capability registry. Generated entries from the official OpenAPI spec
        are marked unverified until their access level, privacy scope and
        refresh policy are reviewed.
      </p>
      <label>
        Search endpoints
        <input
          className="nu-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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
