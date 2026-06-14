import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatIdrFromCents } from "@/utils/format";

describe("formatIdrFromCents", () => {
  it("formats IDR without decimals", () => {
    const formatted = formatIdrFromCents(69000 * 100);
    expect(formatted).toContain("69");
    expect(formatted).toContain("000");
  });
});

describe("formatCompactNumber", () => {
  it("returns a string", () => {
    expect(typeof formatCompactNumber(12345)).toBe("string");
  });
});

