import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { downloadBlob } from "../lib/export";
export default function Settings() {
  const [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [identity, setIdentity] = useState<any>(null),
    [paused, setPaused] = useState(false),
    [persist, setPersist] = useState(false);
  useEffect(() => {
    void load().catch((e) =>
      setMessage(
        e instanceof Error ? e.message : "Unable to load account settings.",
      ),
    );
  }, []);
  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setSignedIn(!!user);
    if (!user) return;
    const [a, p] = await Promise.all([
      supabase
        .from("linked_torn_accounts")
        .select("torn_id,torn_name,key_access_level,revoked_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("tracking_paused")
        .eq("id", user.id)
        .single(),
    ]);
    if (a.error) throw a.error;
    if (p.error) throw p.error;
    setIdentity(a.data);
    setPaused(p.data?.tracking_paused ?? false);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    const submitted = key;
    setKey("");
    const { data, error } = await supabase.functions.invoke("sign-in-torn", {
      body: { apiKey: submitted, persist },
    });
    if (error || data?.error) {
      let message = data?.error ?? error?.message ?? "Unable to sign in.";
      if (error && "context" in error && error.context instanceof Response) {
        try {
          message = (await error.context.json()).error ?? message;
        } catch {}
      }
      throw new Error(message);
    }
    if (typeof data?.token_hash !== "string" || data.type !== "magiclink")
      throw new Error("No valid sign-in session was returned.");
    const verified = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "magiclink",
    });
    if (verified.error) throw verified.error;
    setMessage(`Signed in as ${data.torn_name} [${data.torn_id}]`);
  }
  async function link() {
    const { data, error } = await supabase.functions.invoke("link-torn-key", {
      body: { apiKey: key, persist },
    });
    setKey("");
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    setMessage(`Linked ${data.torn_name} [${data.torn_id}]`);
  }
  async function unlink() {
    const { data, error } = await supabase.functions.invoke("remove-ai-key", {
      body: { provider: "torn" },
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
  }
  async function pause() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ tracking_paused: !paused })
      .eq("id", user.id);
    if (error) throw error;
  }
  async function exportData() {
    const { data, error } = await supabase.functions.invoke("account-data", {
      body: { action: "export" },
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      "torn-account-export.json",
    );
  }
  async function deleteAccount() {
    if (
      !confirm(
        "Delete your app account and personal data? This cannot be undone. Shared settlement audit records may be retained.",
      )
    )
      return;
    const { data, error } = await supabase.functions.invoke("account-data", {
      body: { action: "delete" },
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    await supabase.auth.signOut();
  }
  return (
    <section>
      <h2>Account & privacy settings</h2>
      {message && (
        <p role="status" className="badge">
          {message}
        </p>
      )}
      {!signedIn ? (
        <article className="card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(signIn);
            }}
          >
            <h3>Continue with your Torn API key</h3>
            <p>
              Your Torn identity is your account. The first verified sign-in
              creates your app account automatically; later sign-ins return to
              it. No email address or app password is required.
            </p>
            <KeyDisclosure persist={persist} />
            <label>
              Torn API key
              <input
                className="nu-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                minLength={16}
                maxLength={16}
                required
                value={key}
                onChange={(e) => setKey(e.target.value.trim())}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
              />
              Retain my encrypted key for live refreshes and background
              verification
            </label>
            <p>
              Without retention, the key is used for sign-in only and any
              previously retained Torn key is removed. Ongoing API features need
              a retained key. Keep this key private: it is your sign-in
              credential.
            </p>
            <button
              className="nu-btn"
              disabled={busy || !/^[A-Za-z0-9]{16}$/.test(key)}
              type="submit"
            >
              {busy ? "Verifying Torn identity…" : "Continue with Torn"}
            </button>
            <p>
              Create a dedicated key in Torn Settings → API Keys. Minimal or
              Limited access is accepted; Full access is not required. Custom
              keys must allow identity verification. Public-only keys cannot
              sign in.
            </p>
          </form>
        </article>
      ) : (
        <>
          <article className="card">
            <h3>Torn identity</h3>
            <p>
              {identity && !identity.revoked_at
                ? `${identity.torn_name} [${identity.torn_id}] · ${identity.key_access_level}`
                : "No active Torn key linked"}
            </p>
            <KeyDisclosure persist={persist} />
            <label>
              Torn API key
              <input
                type="password"
                className="nu-input"
                value={key}
                autoComplete="off"
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
              />{" "}
              Store encrypted key for refreshes and background verification
            </label>
            <p>
              Without storage, identity remains linked but ongoing collection
              and verification are unavailable.
            </p>
            <button
              className="nu-btn"
              disabled={busy || !key}
              onClick={() => run(link)}
            >
              Link or replace key
            </button>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(unlink)}
            >
              Remove key
            </button>
          </article>
          <article className="card">
            <h3>Privacy controls</h3>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(pause)}
            >
              {paused ? "Resume tracking" : "Pause tracking"}
            </button>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(exportData)}
            >
              Export my data
            </button>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(deleteAccount)}
            >
              Delete app account
            </button>
            <p>
              Deletion removes personal app records and keys. Active marketplace
              liabilities must be settled first. Shared audit records retain
              pseudonymous identifiers; host backups follow their configured
              retention schedule.
            </p>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              Sign out
            </button>
          </article>
        </>
      )}
    </section>
  );
}

function KeyDisclosure({ persist }: { persist: boolean }) {
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
              refreshes and verification require key retention.
            </td>
            <td>
              {persist
                ? "Encrypted on the server until removed; never returned to the browser."
                : "Used for this request only, then discarded. No raw key is stored in your browser."}
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
