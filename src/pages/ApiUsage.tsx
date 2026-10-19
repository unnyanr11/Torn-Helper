import { CAPABILITIES } from '../api/capabilities';

export default function ApiUsage() {
  return (
    <section>
      <h2>API Usage</h2>
      <p className="muted">Capability registry. Generated entries from the official OpenAPI spec are marked unverified until their access level, privacy scope and refresh policy are reviewed.</p>
      <div className="grid">
        {CAPABILITIES.map((c) => (
          <article key={c.id} className="card nu-raised">
            <h3>{c.group} · {c.path}</h3>
            <p className="value" style={{ fontSize: '1rem' }}>{c.summary}</p>
            <div className="meta">
              <span className="badge">{c.version}</span>
              <span className="badge">{c.requiredAccess}</span>
              <span className="badge">{c.privacy}</span>
              <span className="badge">{c.pagination}</span>
              <span className={`badge ${c.verified ? 'ok' : 'warn'}`}>{c.verified ? '✓ Verified' : '⚠ Needs review'}</span>
            </div>
            {c.queryParams.length > 0 && <p className="muted">Params: {c.queryParams.join(', ')}</p>}
            <p className="muted">Features: {c.features.length ? c.features.join(', ') : 'none mapped yet'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
