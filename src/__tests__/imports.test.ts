import { describe, it, expect } from "vitest";
import { parseDelimited, parseSpyReports } from "../lib/imports";
describe("bounded manual evidence imports", () => {
  it("parses quoted commas, escaped quotes, CRLF, BOM and TSV", () => {
    expect(parseDelimited('\ufeff1,"Name, with ""quotes""",3\r\n')).toEqual([
      ["1", 'Name, with "quotes"', "3"],
    ]);
    expect(parseDelimited("1\tName\t3")).toEqual([["1", "Name", "3"]]);
  });
  it("fails the whole import on malformed or over-limit input", () => {
    for (const input of ['1,"unclosed', '1,"closed"x', '1,abc"def'])
      expect(() => parseDelimited(input)).toThrow();
    expect(() => parseDelimited("x".repeat(1000001))).toThrow(/1 MB/);
    expect(() => parseDelimited(Array(501).fill("1,2").join("\n"))).toThrow(
      /500/,
    );
  });
  it("retains explicit zero but never fabricates missing or malformed stats", () => {
    expect(
      parseSpyReports('ID,Name,STR,DEF,SPD,DEX\n123,"Valid, Name",0,1.5,2,3')[0]
        .total,
    ).toBe(6.5);
    for (const row of [
      "123,A,,1,2,3",
      "123,A,abc,1,2,3",
      "123,A,-1,1,2,3",
      "1.5,A,1,2,3,4",
      "123,A,Infinity,1,2,3",
      "123,A,1,2,3",
      "123,,1,2,3,4",
      "123,A,1,2,3,4\n123,B,2,3,4,5",
    ])
      expect(() => parseSpyReports(row)).toThrow();
  });
});
