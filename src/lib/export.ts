// Torn Command Center - export utilities with formula-injection prevention

export function sanitizeCell(value: unknown): string {
  const s = String(value ?? "");
  if (/^(?:[=+\-@\t\r\n]|\s+[=+\-@])/.test(s)) return `'${s}`;
  return s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  headers?: string[],
): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = sanitizeCell(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.map(escape).join(","),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
}

export async function toXlsx(
  rows: Record<string, unknown>[],
  sheetName = "Report",
): Promise<Blob> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(
    sheetName.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31),
  );
  const keys = rows.length ? Object.keys(rows[0]) : [];
  ws.addRow(keys.map(sanitizeCell));
  rows.forEach((row) => ws.addRow(keys.map((key) => sanitizeCell(row[key]))));
  return new Blob([await wb.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
