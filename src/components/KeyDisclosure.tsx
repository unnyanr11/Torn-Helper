export default function KeyDisclosure({
  persist,
  session = false,
}: {
  persist: boolean;
  session?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Data storage</th>
            <th>Data sharing</th>
            <th>Purpose</th>
            <th>Key storage & sharing</th>
            <th>Access level</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Verified Torn ID/name and your app records persist until account
              deletion. History starts when collected. Backups follow the host
              retention policy.
            </td>
            <td>
              You and authorized service operators; marketplace participants see
              contract evidence. No key is sent to third-party tools.
            </td>
            <td>
              Verify your identity and open your private workspace. Optional
              refreshes can use a request-only key; background verification
              requires retention.
            </td>
            <td>
              {persist
                ? "Encrypted on the server until removed; never returned to the browser."
                : session
                  ? "Kept only in page memory until you leave or reload, never in persistent browser storage or the database."
                  : "Used for this request only, then discarded. No raw key is saved in browser storage."}
            </td>
            <td>
              Minimal or Limited access for sign-in. Limited selections are
              required for battle stats/attacks. Custom keys must expose
              identity/key information. Missing selections reduce available
              features.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
