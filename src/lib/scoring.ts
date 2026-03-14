import type {
  UserAnswer,
  PartyMatch,
  MunicipalityData,
} from "./types";

/**
 * Calculate party matches using StemWijzer-compatible scoring.
 * Priority statements get 2x weight (matches StemWijzer exactly).
 */
export function calculateMatches(
  data: MunicipalityData,
  answers: Record<number, UserAnswer>,
  priorityStatements: number[] = [],
  selectedPartyIds: number[] | null = null,
): PartyMatch[] {
  const prioritySet = new Set(priorityStatements);

  return data.parties
    .filter((party) => {
      if (!party.participates) return false;
      if (selectedPartyIds !== null && !selectedPartyIds.includes(party.id)) return false;
      return true;
    })
    .map((party) => {
      let totalWeight = 0;
      let matchWeight = 0;
      let agreeCount = 0;
      let disagreeCount = 0;
      let neitherCount = 0;
      let totalAnswered = 0;

      for (const stmt of data.statements) {
        const userAnswer = answers[stmt.id];
        if (!userAnswer || userAnswer === "skip") continue;

        const partyPos = party.positions[stmt.id];
        if (!partyPos) continue;

        totalAnswered++;

        // Priority statements get 2x weight (matching StemWijzer)
        const weight = prioritySet.has(stmt.id) ? 2 : 1;
        totalWeight += weight;

        if (userAnswer === "neither" || partyPos.position === "neither") {
          matchWeight += weight * 0.5;
          neitherCount++;
        } else if (userAnswer === partyPos.position) {
          matchWeight += weight;
          agreeCount++;
        } else {
          disagreeCount++;
        }
      }

      const matchPercentage =
        totalWeight > 0 ? Math.round((matchWeight / totalWeight) * 1000) / 10 : 0;

      return {
        partyId: party.id,
        partyName: party.name,
        partyNameEn: party.nameEn,
        matchPercentage,
        agreeCount,
        disagreeCount,
        neitherCount,
        totalAnswered,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

/**
 * Generate a theme-based match summary explaining why user matches a party.
 */
export function generateMatchSummary(
  data: MunicipalityData,
  answers: Record<number, UserAnswer>,
  partyId: number,
  locale: string
): { agreeThemes: string[]; disagreeThemes: string[] } {
  const party = data.parties.find((p) => p.id === partyId);
  if (!party) return { agreeThemes: [], disagreeThemes: [] };

  const agreeByTheme: Record<string, number> = {};
  const disagreeByTheme: Record<string, number> = {};

  for (const stmt of data.statements) {
    const userAnswer = answers[stmt.id];
    if (!userAnswer || userAnswer === "skip") continue;

    const partyPos = party.positions[stmt.id];
    if (!partyPos) continue;

    const theme = locale === "en" && stmt.themeEn ? stmt.themeEn : stmt.theme;

    if (userAnswer === partyPos.position) {
      agreeByTheme[theme] = (agreeByTheme[theme] || 0) + 1;
    } else if (userAnswer !== "neither" && partyPos.position !== "neither") {
      disagreeByTheme[theme] = (disagreeByTheme[theme] || 0) + 1;
    }
  }

  const agreeThemes = Object.entries(agreeByTheme)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([theme]) => theme);

  const disagreeThemes = Object.entries(disagreeByTheme)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  return { agreeThemes, disagreeThemes };
}

/**
 * Generate a political profile summary for the user.
 * Analyzes answers to categorize user's political stance.
 */
export function generatePoliticalProfile(
  data: MunicipalityData,
  answers: Record<number, UserAnswer>,
  locale: string,
): {
  summary: string;
  topThemes: string[];
  stance: string;
} {
  // Count agree/disagree by broad category
  const categories: Record<string, { agree: number; disagree: number }> = {};

  for (const stmt of data.statements) {
    const answer = answers[stmt.id];
    if (!answer || answer === "skip" || answer === "neither") continue;

    const theme = locale === "en" && stmt.themeEn ? stmt.themeEn : stmt.theme;
    if (!categories[theme]) categories[theme] = { agree: 0, disagree: 0 };
    if (answer === "agree") categories[theme].agree++;
    else categories[theme].disagree++;
  }

  // Find themes user cares most about (most agree OR disagree = strong opinion)
  const topThemes = Object.entries(categories)
    .sort((a, b) => (b[1].agree + b[1].disagree) - (a[1].agree + a[1].disagree))
    .slice(0, 4)
    .map(([theme]) => theme);

  // Calculate overall agree ratio
  const totalAgree = Object.values(categories).reduce((s, c) => s + c.agree, 0);
  const totalDisagree = Object.values(categories).reduce((s, c) => s + c.disagree, 0);
  const total = totalAgree + totalDisagree;
  const agreeRatio = total > 0 ? totalAgree / total : 0.5;

  // Generate stance description
  let stance: string;
  if (locale === "en") {
    if (agreeRatio > 0.7) stance = "You tend to agree with most proposals - you're open to change and new policies.";
    else if (agreeRatio > 0.55) stance = "You have a moderate stance - you agree with some proposals and disagree with others.";
    else if (agreeRatio > 0.4) stance = "You're balanced - you carefully weigh each issue on its merits.";
    else stance = "You tend to disagree with most proposals - you prefer the current approach on many issues.";
  } else {
    if (agreeRatio > 0.7) stance = "Je bent het vaak eens met voorstellen - je staat open voor verandering en nieuw beleid.";
    else if (agreeRatio > 0.55) stance = "Je hebt een gematigd standpunt - je bent het met sommige voorstellen eens en met andere oneens.";
    else if (agreeRatio > 0.4) stance = "Je bent evenwichtig - je weegt elk onderwerp zorgvuldig af.";
    else stance = "Je bent het vaak oneens met voorstellen - je geeft de voorkeur aan de huidige aanpak.";
  }

  const summary = locale === "en"
    ? `You have strong opinions on ${topThemes.slice(0, 3).join(", ")}. ${stance}`
    : `Je hebt sterke meningen over ${topThemes.slice(0, 3).join(", ")}. ${stance}`;

  return { summary, topThemes, stance };
}
