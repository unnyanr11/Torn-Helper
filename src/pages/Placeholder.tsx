export default function Placeholder({ name }: { name: string }) {
  return (
    <section>
      <h2>{name}</h2>
      <article className="card nu-inset">
        <p><span className="badge">Not built yet</span></p>
        <p className="muted">This module is on the delivery checklist and will be implemented in a later step. No mock data is shown here.</p>
      </article>
    </section>
  );
}
