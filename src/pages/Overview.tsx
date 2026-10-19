import { DEMO_NEXT, DEMO_WIDGETS } from '../demoData';

export default function Overview() {
  return (
    <section>
      <h2>Overview</h2>
      <div className="grid">
        {DEMO_WIDGETS.map((w) => (
          <article key={w.title} className="card nu-raised">
            <h3>{w.title}</h3>
            <p className="value">{w.value}</p>
            <p className="muted">{w.note}</p>
            <div className="meta">
              <span className="badge">Source: {w.source}</span>
              <span className="badge">Updated: {w.updated}</span>
              <span className={`badge ${w.stale ? 'warn' : 'ok'}`}>{w.stale ? '⚠ Stale' : '✓ Fresh'}</span>
              <span className="badge">Needs: {w.permission}</span>
            </div>
          </article>
        ))}
      </div>
      <article className="card nu-inset">
        <h3>What should I do next? <span className="badge">advisory</span></h3>
        <ul>
          {DEMO_NEXT.map((n) => (
            <li key={n.text}><strong>{n.text}</strong><br /><span className="muted">Inputs: {n.why}</span></li>
          ))}
        </ul>
      </article>
    </section>
  );
}
