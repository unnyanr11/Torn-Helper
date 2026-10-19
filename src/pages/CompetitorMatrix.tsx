import { COMPETITORS } from '../data/competitors';

export default function CompetitorMatrix() {
  return (
    <section>
      <h2>Competitor Coverage Matrix</h2>
      <p className="muted">How Torn Command Center compares to popular Torn tools across key features. Static reference based on publicly known feature sets.</p>
      <article className="card nu-inset" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr><th style={{ textAlign: 'left' }}>Feature</th><th>Torn CC</th><th>TornTools</th><th>YATA</th><th>TornStats</th></tr>
          </thead>
          <tbody>
            {COMPETITORS.map((r) => (
              <tr key={r.feature}>
                <td style={{ textAlign: 'left' }}>{r.feature}</td>
                <td style={{ textAlign: 'center' }}>{r.tcc}</td>
                <td style={{ textAlign: 'center' }}>{r.tornTools}</td>
                <td style={{ textAlign: 'center' }}>{r.yata}</td>
                <td style={{ textAlign: 'center' }}>{r.tornStats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
