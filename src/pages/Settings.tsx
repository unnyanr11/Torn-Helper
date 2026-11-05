import { useQueryClient } from "@tanstack/react-query";
import BrowserTornKeyCard from "../components/BrowserTornKeyCard";
import {commitVerifiedBrowserKey,removeBrowserTornKey,notifyBrowserKeyChange} from '../lib/browser-torn-key';
import KeyDisclosure from "../components/KeyDisclosure";
import { functionError } from "../lib/function-error";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { downloadBlob } from "../lib/export";
export default function Settings() {
  const client=useQueryClient();
  const [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [identity, setIdentity] = useState<any>(null),
    [paused, setPaused] = useState(false),
    [persist, setPersist] = useState(false),
    [hasStoredKey, setHasStoredKey] = useState(false),
    [ownerId,setOwnerId]=useState<string|null>(null);
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
    setSignedIn(!!user);setOwnerId(user?.id??null);
    if (!user) return;
    const [a, p, credential] = await Promise.all([
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
      supabase
        .from("encrypted_credentials")
        .select("provider")
        .eq("user_id", user.id)
        .eq("provider", "torn")
        .maybeSingle(),
    ]);
    if (a.error) throw a.error;
    if (p.error) throw p.error;
    if (credential.error) throw credential.error;
    setHasStoredKey(Boolean(credential.data));
    setIdentity(a.data);
    setPaused(p.data?.tracking_paused ?? false);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
      client.removeQueries({queryKey:["torn-verification"]});
      await client.invalidateQueries({queryKey:["torn-connection"]});
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function activeOwner(){const session=await supabase.auth.getSession();return session.data.session?.user.id??null;}
  async function saveBrowserCopy(account:string,tornId:number,submitted:string,retained:boolean){
    try{await commitVerifiedBrowserKey({ownerId:account,tornId,key:submitted,persist:retained},activeOwner,()=>localStorage);notifyBrowserKeyChange(account);return retained?' Browser copy saved; backend copy is encrypted.':' Persistent copies removed.';}
    catch{return retained?' The backend copy is encrypted, but this browser could not save its copy. Background updates can still use the backend copy.':' The backend copy was removed, but this browser could not confirm removal of its local copy. Clear this site’s browser storage.';}
  }
  async function signIn() {
    const submitted = key;
    setKey("");
    const { data, error } = await supabase.functions.invoke("sign-in-torn", {
      body: { apiKey: submitted, persist },
    });
    if (error || data?.error) {
      throw await functionError(data, error, "Unable to sign in.");
    }
    if (typeof data?.token_hash !== "string" || data.type !== "magiclink")
      throw new Error("No valid sign-in session was returned.");
    const verified = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "magiclink",
    });
    if (verified.error) throw verified.error;
    const account=verified.data.user?.id??verified.data.session?.user.id;
    if(!account)throw new Error('A verified session was not returned.');
    const storageMessage=await saveBrowserCopy(account,Number(data.torn_id),submitted,data.persistent===true);
    setMessage(`Signed in as ${data.torn_name} [${data.torn_id}].${storageMessage}`);
  }
  async function link() {
    const account=await activeOwner();if(!account)throw new Error('Sign in first.');
    const submitted=key.trim();setKey('');
    const { data, error } = await supabase.functions.invoke("link-torn-key", {
      body: { apiKey: submitted, persist },
    });
    setKey("");
    if (error || data?.error) throw await functionError(data, error);
    const storageMessage=await saveBrowserCopy(account,Number(data.torn_id),submitted,data.persistent===true);
    setMessage(`Linked ${data.torn_name} [${data.torn_id}].${storageMessage}`);
  }
  async function unlink() {
    const account=await activeOwner();if(!account)throw new Error('Sign in first.');
    const { data, error } = await supabase.functions.invoke("remove-ai-key", {
      body: { provider: "torn" },
    });
    if (error || data?.error) throw await functionError(data, error);
    try{removeBrowserTornKey(localStorage,account);notifyBrowserKeyChange(account);setMessage('Browser and backend key copies removed.');}
    catch{setMessage('Backend key removed. This browser blocked local removal; clear this site’s browser storage.');}
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
    if (error || data?.error) throw await functionError(data, error);
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
    const account=await activeOwner();
    const { data, error } = await supabase.functions.invoke("account-data", {
      body: { action: "delete" },
    });
    if (error || data?.error) throw await functionError(data, error);
    if(account){try{removeBrowserTornKey(localStorage,account);notifyBrowserKeyChange(account);}catch{setMessage('Account deleted. Clear this site’s browser storage to remove its local key copy.');}}
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
            <KeyDisclosure persist={persist} browserCopy={persist} />
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
              Save a copy in this browser and an encrypted copy on the backend for updates
            </label>
            <p>
              The browser copy comes only from the key you enter here; the backend copy is never downloaded. Use a trusted device. Without retention, sign-in removes your previous backend key and this account’s local browser copy. Background updates require the encrypted backend copy. Keep this key private: it is your sign-in credential.
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
            <p>
              {hasStoredKey
                ? "Encrypted backend key stored for updates; it is never returned to the frontend."
                : "No Torn key stored. Use a request-only key on Overview or enable encrypted storage below."}
            </p>
            <KeyDisclosure persist={persist} browserCopy={persist} />
            <label>
              Torn API key
              <input
                type="password"
                className="nu-input"
                value={key}
                autoComplete="off"
                onChange={(e) => setKey(e.target.value.trim())}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
              />{" "}
              Save in this browser and encrypt on the backend for updates
            </label>
            <p>
              Both storage locations are disclosed: this browser keeps the copy you enter, and the backend keeps an encrypted copy for updates. Turning storage off while linking removes both persistent copies. Identity remains linked.
            </p>
            <button
              className="nu-btn"
              disabled={busy || !/^[A-Za-z0-9]{16}$/.test(key.trim())}
              onClick={() => run(link)}
            >
              Link or replace key
            </button>
            <button
              className="nu-btn"
              disabled={busy}
              onClick={() => run(unlink)}
            >
              Remove browser and backend copies
            </button>
          </article>
          {ownerId&&<BrowserTornKeyCard key={ownerId} ownerId={ownerId} disabled={busy}/>}
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
