export interface HistoryPoint {
  time: string;
  value: number;
}
export function historySummary(points: HistoryPoint[], gapHours = 24) {
  const sorted = points
    .filter(
      (p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.time)),
    )
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const gaps = sorted.slice(1).flatMap((p, i) => {
    const hours = (Date.parse(p.time) - Date.parse(sorted[i].time)) / 3600000;
    return hours > gapHours
      ? [{ from: sorted[i].time, to: p.time, hours }]
      : [];
  });
  const first = sorted[0],
    last = sorted[sorted.length - 1];
  const delta = sorted.length >= 2 ? last.value - first.value : null;
  return {
    points: sorted,
    first,
    last,
    delta,
    percent:
      delta !== null && first.value !== 0
        ? (delta / Math.abs(first.value)) * 100
        : null,
    gaps,
  };
}
