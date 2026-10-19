/** Bounded RFC4180-style CSV/TSV parser. Malformed rows fail the entire import. */
export function parseDelimited(text: string): string[][] {
  if (!text.trim()) throw new Error("Paste a CSV or TSV document.");
  if (new TextEncoder().encode(text).length > 1000000)
    throw new Error("Import limit: 1 MB.");
  text = text.replace(/^\uFEFF/, "");
  const delimiter = text
    .slice(0, text.indexOf("\n") < 0 ? undefined : text.indexOf("\n"))
    .includes("\t")
    ? "\t"
    : ",";
  const rows: string[][] = [],
    row: string[] = [];
  let cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };
  const line = () => {
    field();
    if (row.some((v) => v !== "")) rows.push([...row]);
    row.length = 0;
    if (rows.length > 500) throw new Error("Import limit: 500 rows.");
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      if (cell || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
    } else if (ch === delimiter) field();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line();
    } else if (closed && ch.trim())
      throw new Error("Unexpected text after a quoted field.");
    else if (!closed) cell += ch;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length || closed) line();
  return rows;
}
export interface ImportedSpy {
  target_torn_id: number;
  target_name: string;
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
  total: number;
}
export function parseSpyReports(text: string): ImportedSpy[] {
  const rows = parseDelimited(text);
  if (rows[0]?.[0].toLowerCase() === "id") rows.shift();
  if (!rows.length) throw new Error("No spy report data rows.");
  const seen = new Set<number>();
  return rows.map((r, i) => {
    if (r.length !== 6)
      throw new Error(`Row ${i + 1}: expected ID, Name, STR, DEF, SPD, DEX.`);
    const id = Number(r[0]),
      stats = r.slice(2).map(Number),
      total = stats.reduce((s, n) => s + n, 0);
    if (
      !r[0] ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !r[1] ||
      r[1].length > 80 ||
      r.slice(2).some((v) => !v) ||
      stats.some((n) => !Number.isFinite(n) || n < 0) ||
      total > Number.MAX_SAFE_INTEGER
    )
      throw new Error(
        `Row ${i + 1}: valid ID, name and four nonnegative numeric stats are required. Missing stats cannot become zero.`,
      );
    if (seen.has(id))
      throw new Error(`Row ${i + 1}: duplicate player ID ${id}.`);
    seen.add(id);
    return {
      target_torn_id: id,
      target_name: r[1],
      strength: stats[0],
      defense: stats[1],
      speed: stats[2],
      dexterity: stats[3],
      total,
    };
  });
}
