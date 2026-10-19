export default function NotificationPrefs() {
  return (
    <section>
      <h2>Notification Preferences</h2>
      <article className="card">
        <h3>In-app notifications</h3>
        <p>
          Configure rules on <a href="#Alerts">Alerts</a> and read generated
          notifications on <a href="#Notifications">Notifications</a>.
        </p>
      </article>
      <article className="card">
        <h3>Email and Web Push</h3>
        <p role="status">
          Unavailable: delivery workers, verified recipient routing and push
          subscriptions are not configured. No email or push notification
          preference is enabled by this screen.
        </p>
      </article>
    </section>
  );
}
