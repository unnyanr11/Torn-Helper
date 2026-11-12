export default function KeyDisclosure({
  persist,
  session = false,
  browserCopy = false,
  requiredBackend = false,
}: {
  persist: boolean;
  session?: boolean;
  browserCopy?: boolean;
  requiredBackend?: boolean;
}) {
  return (
    <div
      className="key-disclosure"
      role="region"
      aria-label="Key privacy and access disclosure"
      tabIndex={0}
      style={{ overflowX: "auto" }}
    >
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
              {requiredBackend
                ? `Encrypted backend storage is required while the app account is active; the server key is never returned to the frontend. ${browserCopy?'A separate user-entered copy is also held in page memory until reload or sign-out.':'This form will not retain a browser copy.'} Account deletion removes the backend key; key revocation is available in Torn.`
                : persist
                ? browserCopy ? "A separate copy of your entered key is held in page memory until reload or sign-out. The backend copy is encrypted for updates and is never downloaded or returned to the frontend. Use a trusted device." : "Encrypted on the server until removed; the server copy is never returned to the browser. A separate copy held in Settings may exist for this session."
                : session
                  ? "This form keeps the request-only key in page memory until you leave or reload; it does not persist it. Session copies entered separately in Settings are unchanged."
                  : "This form uses the key for this request only and does not save it. Session copies entered separately in Settings are unchanged."}
            </td>
            <td>
              Full Access is recommended for the widest feature support,
              including activity logs used to verify campaign entries. Minimal
              and Limited keys support fewer features. Custom keys must expose
              identity/key information and the selections each tool needs.
              Public-only keys cannot sign in. All Torn API access is read-only.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
