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
});
