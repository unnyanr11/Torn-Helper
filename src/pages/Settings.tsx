import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { downloadBlob } from "../lib/export";
export default function Settings({
  passwordRecovery = false,
  onPasswordUpdated = () => {},
}: {
  passwordRecovery?: boolean;
  onPasswordUpdated?: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [identity, setIdentity] = useState<any>(null),
    [paused, setPaused] = useState(false),
    [persist, setPersist] = useState(true);
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
  async function auth(signup: boolean) {
    const result = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    setPassword("");
    setMessage(
      signup
        ? "Account created. Check your email if confirmation is required."
        : "Signed in",
    );
  }
  async function resetPassword() {
    if (!email.trim()) throw new Error("Enter your email address first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    setMessage(
      "If an account exists for that email, a password reset link will be sent.",
    );
  }
  async function updatePassword() {
    if (password.length < 8 || password !== confirmation)
      throw new Error(
        "Use at least 8 characters and make both passwords match.",
      );
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPassword("");
    setConfirmation("");
    setMessage("Password updated.");
    onPasswordUpdated();
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
  if (passwordRecovery)
    return (
      <section>
        <h2>Reset your app password</h2>
        {message && <p role="status">{message}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(updatePassword);
          }}
        >
          <label>
            New password
            <input
              className="nu-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              className="nu-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button className="nu-btn" disabled={busy} type="submit">
            Save new password
          </button>
        </form>
      </section>
    );
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
              void run(() => auth(false));
            }}
          >
            <h3>Sign in to your app account</h3>
            <p>
              This password is for Torn Command Center. Never enter your Torn
              password.
            </p>
            <label>
              Email
              <input
                className="nu-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              App password
              <input
                className="nu-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="nu-btn" disabled={busy} type="submit">
              Sign in
            </button>
            <button
              className="nu-btn"
              disabled={busy || password.length < 8}
              type="button"
              onClick={() => run(() => auth(true))}
            >
              Create account
            </button>
            <button
              className="nu-btn"
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => run(resetPassword)}
            >
              Forgot password
            </button>
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
                    Persistent until deletion; history starts when collected.
                    Backups expire under the host retention policy.
                  </td>
                  <td>
                    You and authorized service operators; marketplace
                    participants see contract evidence.
                  </td>
                  <td>
                    Read-only companion data, planning, and loss verification.
                  </td>
                  <td>
                    {persist
                      ? "Encrypted server-side until removal. Never forwarded to third parties."
                      : "Used once for identity verification; not retained."}
                  </td>
                  <td>
                    Public: identity; Minimal: bars; Limited: battle stats and
                    attacks. Custom selections may reduce features.
                  </td>
                </tr>
              </tbody>
            </table>
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
