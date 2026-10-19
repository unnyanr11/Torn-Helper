// Torn Command Center - export utilities with formula-injection prevention

export function sanitizeCell(value: unknown): string {
  const s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return '';
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = sanitizeCell(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
}

export async function toXlsx(rows: Record<string, unknown>[], sheetName = 'Report'): Promise<Blob> {
  const XLSX = await import('https://esm.sh/xlsx@0.18.5');
  const sanitized = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k] = sanitizeCell(v);
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(sanitized);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
