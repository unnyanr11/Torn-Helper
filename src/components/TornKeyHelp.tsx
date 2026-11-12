export default function TornKeyHelp() {
  return <aside className="torn-key-help" aria-label="Why we recommend Full Access">
    <p><strong>Recommended: Full Access for the widest feature support.</strong> Log-based tools, including automatic campaign entry verification, need access to your activity logs.</p>
    <p>Torn’s API is read-only: even a Full Access key cannot send money or items, attack, or change your Torn account. It can read sensitive information, including private stats, finances and activity logs. Only provide a key if you’re comfortable granting that access.</p>
    <p>Create a separate key named “Torn Helper” in <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener noreferrer">Torn Settings → API Keys</a>. You can pause or revoke it there anytime. Lower-access keys still work for supported features; some tools will be unavailable.</p>
  </aside>;
}
