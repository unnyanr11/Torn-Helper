export default function TornKeyHelp() {
  return <aside className="torn-key-help" aria-label="Why we recommend Full Access">
    <p><strong>Recommended: Full Access for the widest feature support.</strong> Log-based tools, including automatic campaign entry verification, need access to your activity logs.</p>
    <p>Torn’s API is read-only: even a Full Access key cannot send money or items, attack, or change your Torn account. It can read sensitive information, including private stats, finances and activity logs. Only provide a key if you’re comfortable granting that access.</p>
    <details><summary>Which key permissions do my tools need?</summary>
      <table><thead><tr><th>Access</th><th>Typical use</th></tr></thead><tbody>
        <tr><td>Public Only</td><td>Public data lookups. Sign-in requires a key that exposes your identity.</td></tr>
        <tr><td>Minimal Access</td><td>Identity and the basic personal sections allowed by Torn.</td></tr>
        <tr><td>Limited Access</td><td>Additional personal sections. Private activity logs may still be restricted.</td></tr>
        <tr><td>Full Access</td><td>Broadest coverage, including private logs for entry and attack verification. Faction leadership and company roles still apply.</td></tr>
        <tr><td>Custom</td><td>Only the selections you enable. Include identity/key information and the selections required by each tool.</td></tr>
      </tbody></table>
      <p>The result of each live request confirms whether that specific section is permitted. See Torn connection for the last successful check.</p>
    </details>
    <p>Create a separate key named “Torn Helper” in <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener noreferrer">Torn Settings → API Keys</a>. You can pause or revoke it there anytime. Lower-access keys still work for supported features; some tools will be unavailable.</p>
  </aside>;
}
