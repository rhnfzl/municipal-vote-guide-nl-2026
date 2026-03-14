import { describe, it, expect } from "vitest";
import { calculateMatches } from "./scoring";
import type { MunicipalityData, UserAnswer } from "./types";

// Minimal test data
const mockData: MunicipalityData = {
  id: "TEST",
  name: "Test Municipality",
  slug: "test",
  parties: [
    {
      id: 1,
      name: "Party A",
      fullName: "Party A",
      website: "",
      hasSeats: true,
      participates: true,
      positions: {
        101: { position: "agree", explanation: "" },
        102: { position: "disagree", explanation: "" },
        103: { position: "neither", explanation: "" },
        104: { position: "agree", explanation: "" },
      },
    },
    {
      id: 2,
      name: "Party B",
      fullName: "Party B",
      website: "",
      hasSeats: true,
      participates: true,
      positions: {
        101: { position: "disagree", explanation: "" },
        102: { position: "agree", explanation: "" },
        103: { position: "agree", explanation: "" },
        104: { position: "disagree", explanation: "" },
      },
    },
    {
      id: 3,
      name: "Non-participating",
      fullName: "Non-participating",
      website: "",
      hasSeats: false,
      participates: false,
      positions: {
        101: { position: "agree", explanation: "" },
      },
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
  it("calculates 100% for perfect agreement (no neither)", () => {
    const answers: Record<number, UserAnswer> = {
      101: "agree",
      102: "disagree",
      104: "agree",
    };
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.matchPercentage).toBe(100);
  });

  it("calculates 0% for total disagreement (no neither)", () => {
    const answers: Record<number, UserAnswer> = {
      101: "disagree",
      102: "agree",
      104: "disagree",
    };
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.matchPercentage).toBe(0);
  });

  it("excludes non-participating parties", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree" };
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.partyId === 3)).toBeUndefined();
  });

  it("skips unanswered questions", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree", 102: "skip" };
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.totalAnswered).toBe(1);
    expect(partyA.matchPercentage).toBe(100);
  });

  it("strict mode eliminates parties failing dealbreakers", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree", 102: "agree" };
    const dealbreakers = new Set([102]); // Party A disagrees on 102
    const results = calculateMatches(mockData, answers, dealbreakers, "strict", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.isEliminated).toBe(true);
    expect(partyA.dealbreakersViolated).toContain(102);
  });

  it("weighted mode does not eliminate but weights 3x", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree", 102: "agree" };
    const dealbreakers = new Set([102]);
    const results = calculateMatches(mockData, answers, dealbreakers, "weighted", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.isEliminated).toBe(false);
    // Q101: agree=agree (weight 1, match 1), Q102: agree!=disagree (weight 3, match 0)
    // Total weight = 4, match = 1, pct = 25%
    expect(partyA.matchPercentage).toBe(25);
  });

  it("theme weighting doubles score impact", () => {
    const answers: Record<number, UserAnswer> = { 101: "agree", 102: "agree" };
    const weights = [{ themeId: "housing", weight: 2 }];
    const results = calculateMatches(mockData, answers, new Set(), "weighted", weights);
    const partyA = results.find((r) => r.partyId === 1)!;
    // Q101: housing, weight 2, match. Q102: safety, weight 1, no match.
    // Total weight = 3, match = 2, pct = 66.7%
    expect(partyA.matchPercentage).toBe(66.7);
  });

  it("sorts by match percentage descending", () => {
    const answers: Record<number, UserAnswer> = {
      101: "agree",
      102: "agree",
      103: "agree",
      104: "agree",
    };
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    expect(results[0].matchPercentage).toBeGreaterThanOrEqual(results[1].matchPercentage);
  });

  it("neither answers count as 0.5 match", () => {
    const answers: Record<number, UserAnswer> = { 103: "agree" };
    // Party A has position "neither" on 103, user says "agree"
    const results = calculateMatches(mockData, answers, new Set(), "weighted", []);
    const partyA = results.find((r) => r.partyId === 1)!;
    expect(partyA.matchPercentage).toBe(50);
  });
});
