/** Record only actual numeric API leaves; never coerce missing fields or strings. */
export function personalStatValues(
  payload: Record<string, unknown>,
): Record<string, number> {
  const values: Record<string, number> = {};
  function visit(value: unknown, path: string, depth: number) {
    if (typeof value === "number" && Number.isFinite(value)) {
      values[path] = value;
      return;
    }
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      depth > 12
    )
      return;
    for (const [key, child] of Object.entries(value)) {
      if (
        !/^[a-zA-Z0-9_]+$/.test(key) ||
        /key|token|secret|credential/i.test(key)
      )
        continue;
      visit(child, path + "." + key, depth + 1);
    }
  }
  for (const category of ["battlestats", "personalstats"])
    visit(payload[category], category, 0);
  return values;
}
