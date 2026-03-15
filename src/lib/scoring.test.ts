import { describe, it, expect } from "vitest";
import { calculateMatches } from "./scoring";
import type { MunicipalityData, UserAnswer } from "./types";

const mockData: MunicipalityData = {
  id: "TEST",
  name: "Test Municipality",
  slug: "test",
  parties: [
    {
      id: 1, name: "Party A", fullName: "Party A", website: "", hasSeats: true, participates: true,
      positions: {
        101: { position: "agree", explanation: "" },
        102: { position: "disagree", explanation: "" },
        103: { position: "neither", explanation: "" },
        104: { position: "agree", explanation: "" },
      },
    },
    {
      id: 2, name: "Party B", fullName: "Party B", website: "", hasSeats: true, participates: true,
      positions: {
        101: { position: "disagree", explanation: "" },
        102: { position: "agree", explanation: "" },
        103: { position: "agree", explanation: "" },
        104: { position: "disagree", explanation: "" },
      },
    },
    {
      id: 3, name: "Non-participating", fullName: "Non-participating", website: "", hasSeats: false, participates: false,
      positions: { 101: { position: "agree", explanation: "" } },
    },
  ],
  statements: [
    { id: 101, index: 1, theme: "Housing", themeId: "housing", title: "Build more", moreInfo: "", pro: "", con: "", isShootout: false },
    { id: 102, index: 2, theme: "Safety", themeId: "safety", title: "More cameras", moreInfo: "", pro: "", con: "", isShootout: false },
    { id: 103, index: 3, theme: "Green", themeId: "green", title: "More parks", moreInfo: "", pro: "", con: "", isShootout: false },
    { id: 104, index: 4, theme: "Traffic", themeId: "traffic", title: "Less cars", moreInfo: "", pro: "", con: "", isShootout: false },
  ],
};

describe("calculateMatches", () => {
  it("calculates 100% for perfect agreement", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree", 102: "disagree", 104: "agree" };
    const results = calculateMatches(mockData, answers);
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(100);
  });

  it("calculates 0% for total disagreement", () => {
    const answers: Record<number, UserAnswer> = { 101: "disagree", 102: "agree", 104: "disagree" };
    const results = calculateMatches(mockData, answers);
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(0);
  });

  it("excludes non-participating parties", () => {
    const results = calculateMatches(mockData, { 101: "agree" });
    expect(results.length).toBe(2);
  });

  it("skips unanswered questions", () => {
    const results = calculateMatches(mockData, { 101: "agree", 102: "skip" });
    expect(results.find((r) => r.partyId === 1)!.totalAnswered).toBe(1);
  });

  it("priority statements get 2x weight", () => {
    const results = calculateMatches(mockData, { 101: "agree", 102: "agree" }, [101]);
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(66.7);
  });

  it("filters by selectedPartyIds", () => {
    const results = calculateMatches(mockData, { 101: "agree" }, [], [1]);
    expect(results.length).toBe(1);
    expect(results[0].partyId).toBe(1);
  });

  it("sorts descending by match %", () => {
    const results = calculateMatches(mockData, { 101: "agree", 102: "agree", 103: "agree", 104: "agree" });
    expect(results[0].matchPercentage).toBeGreaterThanOrEqual(results[1].matchPercentage);
  });

  it("neither = 0.5 match", () => {
    const results = calculateMatches(mockData, { 103: "agree" });
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(50);
  });

  it("no priority = equal weight", () => {
    const results = calculateMatches(mockData, { 101: "agree", 102: "disagree" });
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(100);
  });

  it("dealbreaker weighted mode gives 3x weight", () => {
    // User agrees on 101 (dealbreaker, 3x) and disagrees on 102 (1x)
    // Party A: agrees 101, disagrees 102 -> match on both = 100%
    const results = calculateMatches(mockData, { 101: "agree", 102: "disagree" }, [], null, [101], "weighted");
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(100);
    // Party B: disagrees 101 (dealbreaker violated), agrees 102 -> 0 match on 4 weight = 0%
    const partyB = results.find((r) => r.partyId === 2)!;
    expect(partyB.matchPercentage).toBe(0);
    expect(partyB.dealbreakersViolated).toEqual([101]);
  });

  it("dealbreaker + priority stacks to 6x", () => {
    // Statement 101 is both priority (2x) and dealbreaker (3x) = 6x
    // Statement 102 is normal (1x)
    // User agrees on 101, agrees on 102
    // Party A: agrees 101, disagrees 102 -> match=6, total=7, pct=85.7%
    const results = calculateMatches(mockData, { 101: "agree", 102: "agree" }, [101], null, [101], "weighted");
    expect(results.find((r) => r.partyId === 1)!.matchPercentage).toBe(85.7);
  });

  it("dealbreaker strict mode eliminates violating parties", () => {
    // User agrees on 101, Party B disagrees on 101
    const results = calculateMatches(mockData, { 101: "agree" }, [], null, [101], "strict");
    const partyB = results.find((r) => r.partyId === 2)!;
    expect(partyB.isEliminated).toBe(true);
    expect(partyB.dealbreakersViolated).toEqual([101]);
    // Party A agrees, should not be eliminated
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.isEliminated).toBeUndefined();
  });

  it("dealbreaker strict mode: eliminated parties sort to bottom", () => {
    // Party B has higher match on 102+103+104 but violates dealbreaker on 101
    const results = calculateMatches(
      mockData,
      { 101: "agree", 102: "agree", 103: "agree", 104: "disagree" },
      [], null, [101], "strict"
    );
    // Party A: agrees 101, disagrees 102, neither 103 (0.5), agrees 104 -> not eliminated
    // Party B: disagrees 101 (eliminated), agrees 102, agrees 103, disagrees 104
    const lastParty = results[results.length - 1];
    expect(lastParty.partyId).toBe(2);
    expect(lastParty.isEliminated).toBe(true);
  });

  it("dealbreaker on skipped question has no effect", () => {
    const results = calculateMatches(mockData, { 101: "skip", 102: "agree" }, [], null, [101], "strict");
    const partyB = results.find((r) => r.partyId === 2)!;
    expect(partyB.isEliminated).toBeUndefined();
    expect(partyB.dealbreakersViolated).toBeUndefined();
  });

  it("no dealbreakers = backward compatible", () => {
    const results = calculateMatches(mockData, { 101: "agree", 102: "disagree" });
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.dealbreakersViolated).toBeUndefined();
    expect(partyA.isEliminated).toBeUndefined();
    expect(partyA.matchPercentage).toBe(100);
  });
});
