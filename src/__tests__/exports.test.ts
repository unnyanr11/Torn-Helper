import { describe, it, expect } from "vitest";
import { toCsv, toXlsx, sanitizeCell } from "../lib/export";
import { Workbook } from "exceljs";
describe("portable report exports", () => {
  it("sanitizes formulas in headers and values and quotes multiline cells", () => {
    const csv = toCsv([{ "=header": " =1+1", note: 'a,"b"\nc' }]);
    expect(csv).toContain("'=header");
    expect(csv).toContain("' =1+1");
    expect(csv).toContain('"a,""b""\nc"');
  });
  it("treats control-prefixed formula candidates as text", () => {
    for (const value of ["=1", "+1", "-1", "@SUM(1)", "\n=1", "\t=1", "  =1"])
      expect(sanitizeCell(value)).toBe("'" + value);
  });
  it("creates a genuine readable XLSX without formula cells", async () => {
    const blob = await toXlsx([{ label: "=SUM(1,2)", amount: 100 }], "Report");
    const buffer = await blob.arrayBuffer();
    expect(new Uint8Array(buffer).slice(0, 2)).toEqual(
      new Uint8Array([80, 75]),
    );
    const book = new Workbook();
    await book.xlsx.load(buffer);
    expect(book.worksheets[0].getCell("A2").value).toBe("'=SUM(1,2)");
  });
});

import {
  shareIsActive,
  redactReport,
} from "../../supabase/functions/_shared/reports";
describe("shared snapshot privacy", () => {
  it("rejects expired, revoked and unsupported-audience shares", () => {
    const share = {
      expires_at: "2026-10-20T00:00:00Z",
      revoked: false,
      audience: "link",
    };
    const now = Date.parse("2026-10-19T00:00:00Z");
    expect(shareIsActive(share, now)).toBe(true);
    expect(shareIsActive({ ...share, revoked: true }, now)).toBe(false);
    expect(shareIsActive(share, Date.parse("2026-10-21T00:00:00Z"))).toBe(
      false,
    );
    expect(shareIsActive({ ...share, audience: "private" }, now)).toBe(false);
  });
  it("redacts nested credentials from public snapshots", () => {
    expect(
      redactReport([
        {
          name: "record",
          nested: { api_key: "secret", strength: 10 },
          token_encrypted: "secret",
        },
      ]),
    ).toEqual([{ name: "record", nested: { strength: 10 } }]);
  });
});
