import { useEffect, useRef, useState } from "react";
import { CAPABILITIES } from "../api/capabilities";
import type { Capability } from "../api/types";
import { supabase } from "../lib/supabase";
import { functionError } from "../lib/function-error";
import { downloadBlob } from "../lib/export";
import KeyDisclosure from "../components/KeyDisclosure";
import ApiParameterField from "../components/ApiParameterField";
import { useTornChoices } from "../hooks/useTornChoices";
import { parameterChoices } from "../lib/torn-choices";
import TornDataView from "../components/TornDataView";
const groups: Record<string, string> = {
  user: "My player & player lookups",
  faction: "Faction",
  company: "Company",
  market: "Markets",
  property: "Properties",
  racing: "Racing",
  forum: "Forums",
  torn: "Game reference data",
  key: "Key permissions & usage",
};
function clean(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function initialValues() {
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  return Object.fromEntries(initialSection().parameters.filter(p => params.has(p.name)).map(p => [p.name, params.get(p.name)!]));
}
function initialSection() {
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  return (
    CAPABILITIES.find((c) => c.id === params.get("section")) ??
    CAPABILITIES.find((c) => c.path === "/user/profile")!
  );
}
type Result = {
  endpoint_id: string;
  payload: unknown;
  fetched_at: string;
  cached: boolean;
  parameters: Record<string, string>;
  next_parameters: Record<string, string> | null;
};
export default function LiveFeeds() {
  const first = initialSection();
  const savedChoices = useTornChoices();
  const [group, setGroup] = useState(first.group),
    [sectionId, setSectionId] = useState(first.id),
    [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(initialValues),
    [key, setKey] = useState(""),
    [keyMode, setKeyMode] = useState("request"),
    [memory, setMemory] = useState(false);
  const [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const generation = useRef(0);
  const section = CAPABILITIES.find((c) => c.id === sectionId)!;
  const available = CAPABILITIES.filter(
    (c) =>
      c.group === group &&
      `${c.summary} ${c.path}`.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    const route = () => {
      const next = initialSection();
      generation.current++;
      setGroup(next.group);
      setSectionId(next.id);
      setValues(initialValues());
      setResult(null);
      setError("");
      setBusy(false);
    };
    window.addEventListener("hashchange", route);
    return () => {
      generation.current++;
      window.removeEventListener("hashchange", route);
    };
  }, []);
  function choose(next: Capability) {
    generation.current++;
    setGroup(next.group);
    setSectionId(next.id);
    setValues({});
    setResult(null);
    setError("");
    setMessage("");
    setBusy(false);
  }
  async function fetchSection(parameters = values) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    const submitted = key;
    if (!memory) setKey("");
    try {
      const { data, error } = await supabase.functions.invoke("torn-data", {
        body: {
          endpoint_id: section.id,
          parameters,
          ...(keyMode === "request" ? { apiKey: submitted } : {}),
        },
      });
      if (error || data?.error) throw await functionError(data, error);
      if (current === generation.current) {
        setResult(data);
        setValues(data.parameters);
      }
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error ? error.message : "Unable to fetch data.",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function clearSaved() {
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const removed = await supabase
      .from("torn_data_cache")
      .delete()
      .eq("user_id", user.id);
    if (removed.error) setError(removed.error.message);
    else {
      setResult(null);
      setMessage("Saved data-browser observations removed.");
    }
  }
  const parameters = section.parameters.filter((p) =>
    ["path", "query"].includes(p.location),
  );
  const ready = keyMode === "stored" || /^[A-Za-z0-9]{16}$/.test(key);
  return (
    <section>
      <h2>Torn Data Browser</h2>
      <p><a className="nu-btn" href="#Overview">My Torn — load all personal data as a dashboard ↗</a></p>
      <p>
        All {CAPABILITIES.length} documented Torn read sections are connected.
        Choose what to fetch. Full Access offers the widest key permissions;
        Torn still controls access to other players, faction and company data.
      </p>
      <p>
        Data loads only when requested. Successful results are cached privately
        for 60 seconds. Up to 100 recent requests are saved; older-than-24-hour
        records are removed on your next successful fetch. Export or clear
        observations below.
      </p>
      <label>
        Category
        <select
          className="nu-input"
          value={group}
          disabled={busy}
          onChange={(event) => {
            setSearch("");
            choose(CAPABILITIES.find((c) => c.group === event.target.value)!);
          }}
        >
          {Object.entries(groups).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Search this category
        <input
          className="nu-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search section names"
        />
      </label>
      <label>
        Data section
        <select
          className="nu-input"
          value={sectionId}
          disabled={busy}
          onChange={(event) =>
            choose(CAPABILITIES.find((c) => c.id === event.target.value)!)
          }
        >
          {!available.some((c) => c.id === section.id) && (
            <option value={section.id}>{section.summary}</option>
          )}
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.summary} · {c.path}
            </option>
          ))}
        </select>
      </label>
      {!available.length && <p>No matching sections in this category.</p>}
      <article className="card">
        <h3>{section.summary}</h3>
        <p>{clean(section.description)}</p>
        <p>
          Key access:{" "}
          {section.requiredAccess === "Unknown"
            ? "Depends on the selected data; checked by Torn"
            : section.requiredAccess}
          . Requests use your linked Torn identity.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetchSection();
          }}
        >
          <label>
            Key to use
            <select
              className="nu-input"
              value={keyMode}
              disabled={busy}
              onChange={(event) => {
                setKeyMode(event.target.value);
                setKey("");
                setMemory(false);
              }}
            >
              <option value="request">Enter a key for this request</option>
              <option value="stored">Use my encrypted key from Settings</option>
            </select>
          </label>
          {keyMode === "request" && (
            <>
              <KeyDisclosure persist={false} session={memory} />
              <label>
                Torn API key
                <input
                  className="nu-input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  minLength={16}
                  maxLength={16}
                  value={key}
                  onChange={(event) => setKey(event.target.value.trim())}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={memory}
                  onChange={(event) => setMemory(event.target.checked)}
                />{" "}
                Keep this key in memory while this page is open, for loading
                more sections and pages
              </label>
              <p>
                Leaving this page or reloading clears the key. It is never saved
                in browser storage or in these observations.
              </p>
            </>
          )}
          {parameters.length > 0 && (
            <details open={parameters.some((p) => p.required)}>
              <summary>Section options and pagination</summary>
              {parameters.map(parameter => <div key={parameter.name} style={{marginBottom:'0.8rem'}}><ApiParameterField parameter={parameter} value={values[parameter.name]??''} onChange={value=>setValues({...values,[parameter.name]:value})} choices={parameterChoices(savedChoices.data??[],section.path,parameter.name)}/>{parameter.description&&<small>{clean(parameter.description)}</small>}</div>)}
            </details>
          )}
          <button className="nu-btn" disabled={busy || !ready}>
            {busy ? "Loading Torn data…" : "Fetch selected data"}
          </button>
        </form>
      </article>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {result && (
        <article className="card">
          <h3>Official Torn observation</h3>
          <p>
            Collected {new Date(result.fetched_at).toLocaleString()} ·{" "}
            {result.cached ? "Cached response" : "Fetched from Torn"}. This is a
            snapshot; refresh to check changes.
          </p>
          <details>
            <summary>Parameters used for this observation</summary>
            <pre>{JSON.stringify(result.parameters, null, 2)}</pre>
          </details>
          <button
            className="nu-btn"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(result, null, 2)], {
                  type: "application/json",
                }),
                "torn-data.json",
              )
            }
          >
            Download this page as JSON
          </button>
          {result.next_parameters && (
            <button
              className="nu-btn"
              disabled={busy || !ready}
              onClick={() => void fetchSection(result.next_parameters!)}
            >
              Load next page
            </button>
          )}
          {result.next_parameters && !ready && (
            <p>Re-enter your request-only key to fetch the next page.</p>
          )}
          {error && (
            <p>The observation below is from your last successful request.</p>
          )}
          <TornDataView value={result.payload} />
          <details><summary>Developer view: raw response</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "65vh", overflow: "auto" }}>{JSON.stringify(result.payload, null, 2)}</pre></details>
        </article>
      )}
      <button
        className="nu-btn"
        disabled={busy}
        onClick={() => void clearSaved()}
      >
        Clear saved data-browser observations
      </button>
      <p>
        For automatic stored-key access, configure encrypted key storage in{" "}
        <a href="#Settings">Settings</a>. This browser does not grant
        permissions that Torn denies.
      </p>
    </section>
  );
}
