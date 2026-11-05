import { describe, expect, it } from "vitest";
import { computeStats, detectMapping, parseAmount, parseCrmCsv, parseDate, statusFromStage, canonicalReason } from "../src/lib/crm";

describe("parseAmount", () => {
  it("handles currency formats", () => {
    expect(parseAmount("$42,000")).toBe(42000);
    expect(parseAmount("42k")).toBe(42000);
    expect(parseAmount("1.5M")).toBe(1500000);
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
    expect(parseAmount("(500)")).toBe(-500);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses common formats", () => {
    expect(parseDate("2026-10-21")).toBe("2026-10-21");
    expect(parseDate("10/21/2026")).toBe("2026-10-21");
    expect(parseDate("21/10/2026")).toBe("2026-10-21");
    expect(parseDate("2026-13-40")).toBeNull();
    expect(parseDate("garbage")).toBeNull();
  });
});

describe("status", () => {
  it("maps stages", () => {
    expect(statusFromStage("Closed Won")).toBe("won");
    expect(statusFromStage("closedlost")).toBe("lost");
    expect(statusFromStage("closedwon")).toBe("won");
    expect(statusFromStage("Closed Lost")).toBe("lost");
    expect(statusFromStage("Demo scheduled")).toBe("open");
  });
});

describe("mapping + parse", () => {
  it("detects HubSpot export headers", () => {
    const m = detectMapping(["Deal Name", "Deal Stage", "Amount", "Close Date", "Create Date", "Closed Lost Reason", "Associated Company"]);
    expect(m.name).toBe("Deal Name");
    expect(m.stage).toBe("Deal Stage");
    expect(m.lostReason).toBe("Closed Lost Reason");
    expect(m.company).toBe("Associated Company");
  });
  it("parses CSV with BOM, quotes and empty rows", () => {
    const csv = "﻿Deal Name,Deal Stage,Amount,Closed Lost Reason,Create Date,Close Date\n\"Acme, Inc\",Closed Won,\"$12,000\",,2026-01-01,2026-02-10\nBeta,Closed Lost,8000,Too expensive for budget,2026-01-05,2026-02-01\n,,,,,\nGamma,Demo,5000,,2026-03-01,\n";
    const r = parseCrmCsv(csv);
    expect(r.deals).toHaveLength(3);
    expect(r.deals[0].name).toBe("Acme, Inc");
    expect(r.deals[0].amount).toBe(12000);
    const s = computeStats(r.deals, new Date("2026-06-01"));
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.medianCycleDays).toBe(40);
    expect(s.topLossReasons[0].reason).toBe("Price / budget");
    expect(s.stalledOpen).toBe(1);
  });
  it("warns on files without headers we know", () => {
    const r = parseCrmCsv("foo,bar\n1,2\n");
    expect(r.deals).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    expect(parseCrmCsv("").deals).toHaveLength(0);
  });
  it("canonicalises reasons", () => {
    expect(canonicalReason("Went with competitor FourKites")).toBe("Chose a competitor");
    expect(canonicalReason("They built it in-house with BI")).toBe("Built in-house / internal tool");
  });
});
