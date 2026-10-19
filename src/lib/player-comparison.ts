import { historySummary, type HistoryPoint } from "./history";
export const COMPARISON_METRICS = [
  { id: "attackswon", label: "Attacks won", unit: "count" },
  { id: "defendswon", label: "Defends won", unit: "count" },
  { id: "criminaloffenses", label: "Criminal offenses", unit: "count" },
  { id: "traveltimes", label: "Trips made", unit: "count" },
  { id: "raceswon", label: "Races won", unit: "count" },
  { id: "revives", label: "Revives performed", unit: "count" },
  { id: "networth", label: "Net worth", unit: "Torn dollars" },
] as const;
export type MetricId = (typeof COMPARISON_METRICS)[number]["id"];
export function comparisonIds(input: string) {
  const ids = [
    ...new Set(
      input
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number),
    ),
  ];
  if (
    ids.length < 2 ||
    ids.length > 5 ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new Error("Enter 2–5 distinct positive player IDs.");
  return ids;
}
export function historicStatPoints(
  payloads: unknown[],
  metric: string,
): HistoryPoint[] {
  const values = new Map<string, number>();
  for (const payload of payloads) {
    const entries = (payload as any)?.personalstats;
    if (!Array.isArray(entries)) continue;
    for (const row of entries) {
      if (
        row?.name !== metric ||
        typeof row.value !== "number" ||
        !Number.isFinite(row.value) ||
        !Number.isSafeInteger(row.timestamp) ||
        row.timestamp <= 0
      )
        continue;
      const date = new Date(row.timestamp * 1000);
      if (!Number.isFinite(date.getTime())) continue;
      const time = date.toISOString();
      values.set(time, row.value);
    }
  }
  return historySummary([...values].map(([time, value]) => ({ time, value })))
    .points;
}
export type SectionRequest = (
  endpointId: string,
  parameters: Record<string, string>,
) => Promise<{ payload: any; fetched_at: string; cached?: boolean }>;
export async function fetchPlayerComparisons(
  ids: number[],
  days: string,
  request: SectionRequest,
  now = Date.now(),
) {
  if (!["7", "30", "90", "365"].includes(days))
    throw new Error("Choose a valid comparison window.");
  if (
    ids.length < 2 ||
    ids.length > 5 ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new Error("Invalid player IDs.");
  const names = COMPARISON_METRICS.map((metric) => metric.id).join(",");
  const current = Math.floor(now / 60000) * 60;
  const past = current - Number(days) * 86400;
  const rows: {
    id: number;
    profile: any;
    fetchedAt: string | null;
    metrics: Record<string, HistoryPoint[]>;
    current: Record<string, HistoryPoint | null>;
    warnings: string[];
  }[] = [];
  // One player at a time and at most three calls per player. The shared gateway
  // budgets every request, including request-only key ownership verification.
  for (const id of ids) {
    const warnings: string[] = [];
    const tasks = await Promise.allSettled([
      request("v2-user-{id}-profile", { id: String(id) }),
      request("v2-user-{id}-personalstats", {
        id: String(id),
        stat: names,
        timestamp: String(past),
      }),
      request("v2-user-{id}-personalstats", {
        id: String(id),
        stat: names,
        timestamp: String(current),
      }),
    ]);
    const labels = ["Profile", "Historical statistics", "Current statistics"];
    tasks.forEach((result, i) => {
      if (result.status === "rejected")
        warnings.push(
          `${labels[i]}: ${result.reason instanceof Error ? result.reason.message : "unavailable"}`,
        );
    });
    const profile = tasks[0].status === "fulfilled" ? tasks[0].value : null;
    const payloads = tasks
      .slice(1)
      .flatMap((result) =>
        result.status === "fulfilled" ? [result.value.payload] : [],
      );
    rows.push({
      id,
      profile: profile?.payload.profile ?? null,
      fetchedAt: profile?.fetched_at ?? null,
      metrics: Object.fromEntries(
        COMPARISON_METRICS.map((metric) => [
          metric.id,
          historicStatPoints(payloads, metric.id),
        ]),
      ),
      current: Object.fromEntries(
        COMPARISON_METRICS.map((metric) => [
          metric.id,
          tasks[2].status === "fulfilled"
            ? (historicStatPoints([tasks[2].value.payload], metric.id).slice(
                -1,
              )[0] ?? null)
            : null,
        ]),
      ),
      warnings,
    });
    // Do not continue exhausting quota or retrying a missing/invalid key for the next player.
    const failure = tasks.find((result) => result.status === "rejected");
    if (
      tasks.every((result) => result.status === "rejected") &&
      failure?.status === "rejected"
    ) {
      if ([401, 409, 429].includes((failure.reason as any)?.status)) break;
    }
  }
  if (
    !rows.some(
      (row) =>
        row.profile ||
        Object.values(row.metrics).some((points) => points.length),
    )
  )
    throw new Error(
      rows.flatMap((row) => row.warnings).join(" ") ||
        "No player observations were returned.",
    );
  return rows;
}
