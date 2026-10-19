export default function Discord() {
  return (
    <section>
      <h2>Discord Integration</h2>
      <article className="card">
        <p role="status">
          Unavailable: secure server-side webhook storage, channel verification
          and delivery have not been configured.
        </p>
        <p>
          The app does not collect webhook URLs or send Discord messages. In-app
          alerts remain available on the Alerts and Notifications pages.
        </p>
      </article>
    </section>
  );
}
