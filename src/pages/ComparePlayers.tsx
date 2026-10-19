import { useEffect, useRef, useState } from "react";
import SavedPresets from "../components/SavedPresets";
import KeyDisclosure from "../components/KeyDisclosure";
import { supabase } from "../lib/supabase";
import { functionError } from "../lib/function-error";
import {
  COMPARISON_METRICS,
  comparisonIds,
  fetchPlayerComparisons,
  type MetricId,
} from "../lib/player-comparison";
import { historySummary, type HistoryPoint } from "../lib/history";
type LiveRow = Awaited<ReturnType<typeof fetchPlayerComparisons>>[number];
type Evidence = {
  id: number;
  name: string;
  total: number | null;
  distribution: (number | null)[];
  source: string;
  at: string | null;
  level: number | null;
  status: string;
  samples: number;
  online: number | null;
  observed: string | null;
};
export default function ComparePlayers() {
  const [input, setInput] = useState(""),
    [days, setDays] = useState("30"),
    [metric, setMetric] = useState<MetricId>("attackswon");
  const [rows, setRows] = useState<LiveRow[]>([]),
    [evidence, setEvidence] = useState<Evidence[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [key, setKey] = useState(""),
    [mode, setMode] = useState("request"),
    [view, setView] = useState<{ ids: string; days: string } | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function reset() {
    generation.current++;
    setRows([]);
    setEvidence([]);
    setError("");
    setView(null);
    setBusy(false);
  }
  async function compare(idsInput = input, window = days) {
    const ids = comparisonIds(idsInput);
    if (mode === "request" && !/^[A-Za-z0-9]{16}$/.test(key))
      throw new Error(
        "Enter a request-only Torn key, or choose your stored key.",
      );
    const token = ++generation.current,
      submitted = key;
    setKey("");
    setBusy(true);
    setError("");
    setRows([]);
    setEvidence([]);
    setView({ ids: idsInput, days: window });
    try {
      const local = async () => {
        const since = new Date(
          Date.now() - Number(window) * 86400000,
        ).toISOString();
        const [estimates, spies, targets, observations] = await Promise.all([
          supabase
            .from("estimates")
            .select("*")
            .in("torn_player_id", ids)
            .gte("created_at", since)
            .order("created_at", { ascending: false }),
          supabase
            .from("spy_reports")
            .select("*")
            .in("target_torn_id", ids)
            .gte("reported_at", since)
            .order("reported_at", { ascending: false }),
          supabase
            .from("target_list_entries")
            .select("*")
            .in("torn_player_id", ids),
          supabase
            .from("player_observations")
            .select("*")
            .in("torn_player_id", ids)
            .gte("observed_at", since)
            .order("observed_at", { ascending: false }),
        ]);
        if (
          estimates.error ||
          spies.error ||
          targets.error ||
          observations.error
        )
          throw (
            estimates.error ??
            spies.error ??
            targets.error ??
            observations.error
          );
        return ids.map((id) => {
          const estimate = estimates.data?.find(
              (item) => Number(item.torn_player_id) === id,
            ),
            spy = spies.data?.find(
              (item) => Number(item.target_torn_id) === id,
            );
          const useSpy =
            spy &&
            (!estimate ||
              Date.parse(spy.reported_at) >= Date.parse(estimate.created_at));
          const value = useSpy ? spy : estimate?.value;
          const target = targets.data?.find(
              (item) => Number(item.torn_player_id) === id,
            ),
            observed =
              observations.data?.filter(
                (item) => Number(item.torn_player_id) === id,
              ) ?? [];
          const numeric = (field: string) =>
            typeof value?.[field] === "number" &&
            Number.isFinite(value[field]) &&
            value[field] >= 0
              ? value[field]
              : null;
          return {
            id,
            name: target?.player_name ?? spy?.target_name ?? "Unknown",
            level: observed[0]?.level ?? target?.level ?? null,
            status: observed[0]?.status ?? target?.status ?? "Unknown",
            samples: observed.length,
            online: observed.length
              ? observed.filter(
                  (item) => item.last_action?.toLowerCase() === "online",
                ).length / observed.length
              : null,
            observed: observed[0]?.observed_at ?? null,
            total: numeric("total"),
            distribution: ["strength", "defense", "speed", "dexterity"].map(
              numeric,
            ),
            source: useSpy
              ? "Manually imported spy report"
              : (estimate?.source ?? "No authorized battle-stat evidence"),
            at: useSpy ? spy.reported_at : (estimate?.created_at ?? null),
          };
        });
      };
      if (mode === "saved") {
        const saved = await local();
        if (token === generation.current) setEvidence(saved);
        return;
      }
      const request = async (
        endpoint_id: string,
        parameters: Record<string, string>,
      ) => {
        if (token !== generation.current)
          throw new Error("Comparison changed; fetch cancelled.");
        const { data, error } = await supabase.functions.invoke("torn-data", {
          body: {
            endpoint_id,
            parameters,
            ...(mode === "request" ? { apiKey: submitted } : {}),
          },
        });
        if (error || data?.error) {
          const problem = await functionError(data, error);
          Object.assign(problem, { status: (error as any)?.context?.status });
          throw problem;
        }
        return data;
      };
      const [official, saved] = await Promise.allSettled([
        fetchPlayerComparisons(ids, window, request),
        local(),
      ]);
      if (token !== generation.current) return;
      if (saved.status === "fulfilled") setEvidence(saved.value);
      if (official.status === "rejected") throw official.reason;
      setRows(official.value);
      if (saved.status === "rejected")
        setError(
          "Live Torn data loaded; saved battle-stat evidence could not be read.",
        );
    } catch (error) {
      if (token === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Unable to fetch comparison.",
        );
      throw error;
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  const metricLabel = COMPARISON_METRICS.find((item) => item.id === metric)!;
  return (
    <section>
      <h2>Compare Players</h2>
      <p>
        Load a saved preset or enter 2–5 player IDs to fetch profiles and seven
        public statistics from Torn. Trends compare Torn's actual dated values
        with the selected historical window; missing or private values remain
        unknown.
      </p>
      <SavedPresets
        kind="comparison"
        loadLabel="Load & fetch comparison"
        config={{ version: 1, ids: input, days, metric }}
        onLoad={async (config) => {
          if (
            config?.version !== 1 ||
            typeof config.ids !== "string" ||
            !["7", "30", "90", "365"].includes(config.days) ||
            (config.metric !== undefined &&
              !COMPARISON_METRICS.some((item) => item.id === config.metric))
          )
            throw new Error("Invalid comparison preset.");
          comparisonIds(config.ids);
          setInput(config.ids);
          setDays(config.days);
          setMetric(config.metric ?? "attackswon");
          await compare(config.ids, config.days);
        }}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void compare().catch((error) =>
            setError(
              error instanceof Error ? error.message : "Unable to compare.",
            ),
          );
        }}
      >
        <label>
          Player IDs
          <input
            className="nu-input"
            aria-label="Player IDs"
            value={input}
            onChange={(event) => {
              reset();
              setInput(event.target.value);
            }}
            placeholder="Two to five Torn IDs"
            disabled={busy}
            required
          />
        </label>
        <label>
          Comparison window
          <select
            className="nu-input"
            value={days}
            disabled={busy}
            onChange={(event) => {
              reset();
              setDays(event.target.value);
            }}
          >
            {[7, 30, 90, 365].map((value) => (
              <option value={value} key={value}>
                {value} days
              </option>
            ))}
          </select>
        </label>
        <label>
          Key to use
          <select
            className="nu-input"
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value);
              setKey("");
            }}
          >
            <option value="request">Request-only Torn key</option>
            <option value="stored">My encrypted key from Settings</option>
            <option value="saved">
              Saved observations only (no API request)
            </option>
          </select>
        </label>
        {mode === "request" && (
          <>
            <KeyDisclosure persist={false} />
            <label>
              Torn API key
              <input
                className="nu-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                minLength={16}
                maxLength={16}
                value={key}
                onChange={(event) => setKey(event.target.value.trim())}
                required
                disabled={busy}
              />
            </label>
            <p>
              The key is used for this comparison only and cleared from the form
              when fetching starts. Observations are saved privately in the
              data-browser cache.
            </p>
          </>
        )}
        <button className="nu-btn" disabled={busy}>
          {busy
            ? "Fetching player data and trends…"
            : "Fetch / refresh comparison"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {view && (
        <p>
          Requested players: {view.ids} · {view.days}-day comparison. Torn may
          return the nearest available date; observation timestamps are shown
          below.
        </p>
      )}
      <label>
        Statistic to compare
        <select
          className="nu-input"
          value={metric}
          onChange={(event) => setMetric(event.target.value as MetricId)}
        >
          {COMPARISON_METRICS.map((item) => (
            <option value={item.id} key={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {!!rows.length && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Level</th>
                <th>Status</th>
                <th>
                  {metricLabel.label} ({metricLabel.unit})
                </th>
                <th>Change between returned observations</th>
                <th>Latest stat observation</th>
                <th>Profile fetched</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const summary = historySummary(row.metrics[metric] ?? []),
                  current = row.current[metric];
                return (
                  <tr key={row.id}>
                    <td>
                      {row.profile?.name ?? "Unknown"} [{row.id}]
                    </td>
                    <td>{row.profile?.level ?? "Unknown"}</td>
                    <td>{row.profile?.status?.state ?? "Unknown"}</td>
                    <td>
                      {current ? current.value.toLocaleString() : "Unavailable"}
                    </td>
                    <td>
                      {summary.delta === null
                        ? "Insufficient observations"
                        : `${summary.delta.toLocaleString()}${summary.percent === null ? "" : ` (${summary.percent.toFixed(2)}%)`}`}
                    </td>
                    <td>
                      {current
                        ? new Date(current.time).toLocaleString()
                        : "Unavailable"}
                    </td>
                    <td>
                      {row.fetchedAt
                        ? new Date(row.fetchedAt).toLocaleString()
                        : "Unavailable"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.map((row) => (
        <article className="card" key={row.id}>
          <h3>
            {row.profile?.name ?? `Player ${row.id}`} · {metricLabel.label}
          </h3>
          {row.warnings.map((warning) => (
            <p role="status" key={warning}>
              {warning}
            </p>
          ))}
          <ComparisonTrend
            points={row.metrics[metric] ?? []}
            label={`${row.profile?.name ?? row.id}: ${metricLabel.label}`}
          />
          <details>
            <summary>All fetched statistics and dated values</summary>
            <table>
              <thead>
                <tr>
                  <th>Statistic</th>
                  <th>Observed UTC</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_METRICS.flatMap((item) =>
                  (row.metrics[item.id] ?? []).map((point) => (
                    <tr key={`${item.id}:${point.time}`}>
                      <td>{item.label}</td>
                      <td>{point.time}</td>
                      <td>{point.value.toLocaleString()}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </details>
        </article>
      ))}
      {!!evidence.length && (
        <details>
          <summary>
            Saved observations and authorized battle-stat evidence
          </summary>
          <p>
            Public levels and activity do not establish private battle stats.
            Imported spy timestamps are import times; no private totals are
            inferred. Activity percentages cover collected samples only (up to
            1,000 rows per source), not continuous activity.
          </p>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Source</th>
                <th>Total</th>
                <th>STR / DEF / SPD / DEX</th>
                <th>Evidence time</th>
                <th>Difference from first total</th>
                <th>Saved level/status</th>
                <th>Observed online</th>
                <th>Samples</th>
                <th>Last saved observation</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.name} [{item.id}]
                  </td>
                  <td>{item.source}</td>
                  <td>{item.total ?? "Unknown"}</td>
                  <td>
                    {item.distribution
                      .map((value) =>
                        value === null ? "Unknown" : value.toLocaleString(),
                      )
                      .join(" / ")}
                  </td>
                  <td>
                    {item.at ? new Date(item.at).toLocaleString() : "Unknown"}
                  </td>
                  <td>
                    {item.total !== null && evidence[0]?.total !== null
                      ? (item.total - evidence[0].total).toLocaleString()
                      : "Unknown"}
                  </td>
                  <td>
                    {item.level ?? "Unknown"} / {item.status}
                  </td>
                  <td>
                    {item.online === null
                      ? "Unknown"
                      : `${(item.online * 100).toFixed(1)}%`}
                  </td>
                  <td>{item.samples}</td>
                  <td>
                    {item.observed
                      ? new Date(item.observed).toLocaleString()
                      : "Unknown"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {!busy && mode === "saved" && !!evidence.length && (
        <p>
          Showing saved observations only. Choose a Torn key to fetch live
          profiles and dated trends.
        </p>
      )}
      {!busy && !rows.length && !evidence.length && !error && (
        <p>
          No comparison has been fetched. Enter a key or choose stored-key
          access, then load a preset or fetch the selected players.
        </p>
      )}
    </section>
  );
}
export function ComparisonTrend({
  points,
  label,
}: {
  points: HistoryPoint[];
  label: string;
}) {
  const summary = historySummary(points);
  if (summary.points.length < 2)
    return (
      <p>
        Two distinct dated observations are needed for a trend. Torn may not
        retain this statistic for the requested date.
      </p>
    );
  const first = Date.parse(summary.first.time),
    duration = Date.parse(summary.last.time) - first || 1;
  const min = Math.min(...summary.points.map((point) => point.value)),
    range = Math.max(...summary.points.map((point) => point.value)) - min || 1;
  return (
    <>
      <svg
        role="img"
        aria-label={label + " dated observations"}
        viewBox="0 0 600 190"
        style={{ width: "100%", maxHeight: 240 }}
      >
        <title>{label}</title>
        {summary.points.map((point) => (
          <circle
            key={point.time}
            cx={15 + ((Date.parse(point.time) - first) / duration) * 570}
            cy={170 - ((point.value - min) / range) * 150}
            r="5"
            fill="var(--accent)"
          >
            <title>
              {point.time}: {point.value}
            </title>
          </circle>
        ))}
      </svg>
      <p>
        {summary.first.time}: {summary.first.value.toLocaleString()} →{" "}
        {summary.last.time}: {summary.last.value.toLocaleString()}. Intermediate
        changes are unknown; points are not a continuous history.
      </p>
    </>
  );
}
