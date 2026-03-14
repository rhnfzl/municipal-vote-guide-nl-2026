import type {
  UserAnswer,
  PartyMatch,
  DealBreakerMode,
  ThemeWeight,
  MunicipalityData,
} from "./types";

export function calculateMatches(
  data: MunicipalityData,
  answers: Record<number, UserAnswer>,
  dealbreakers: Set<number>,
  mode: DealBreakerMode,
  themeWeights: ThemeWeight[]
): PartyMatch[] {
  const weightMap = new Map(themeWeights.map((tw) => [tw.themeId, tw.weight]));

  return data.parties
    .filter((party) => party.participates)
    .map((party) => {
      let totalWeight = 0;
      let matchWeight = 0;
      let agreeCount = 0;
      let disagreeCount = 0;
      let neitherCount = 0;
      let totalAnswered = 0;
      const dealbreakersViolated: number[] = [];

      for (const stmt of data.statements) {
        const userAnswer = answers[stmt.id];
        if (!userAnswer || userAnswer === "skip") continue;

        const partyPos = party.positions[stmt.id];
        if (!partyPos) continue;

        totalAnswered++;

        let weight = 1;
        const themeWeight = weightMap.get(stmt.themeId);
        if (themeWeight && themeWeight > 1) weight *= themeWeight;
        if (dealbreakers.has(stmt.id) && mode === "weighted") weight *= 3;

        totalWeight += weight;

        if (userAnswer === "neither" || partyPos.position === "neither") {
          matchWeight += weight * 0.5;
          neitherCount++;
        } else if (userAnswer === partyPos.position) {
          matchWeight += weight;
          agreeCount++;
        } else {
          disagreeCount++;
          if (dealbreakers.has(stmt.id)) {
            dealbreakersViolated.push(stmt.id);
          }
        }
      }

      const matchPercentage =
        totalWeight > 0 ? Math.round((matchWeight / totalWeight) * 1000) / 10 : 0;

      const isEliminated =
        mode === "strict" && dealbreakersViolated.length > 0;

      return {
        partyId: party.id,
        partyName: party.name,
        partyNameEn: party.nameEn,
        matchPercentage,
        agreeCount,
        disagreeCount,
        neitherCount,
        totalAnswered,
        dealbreakersViolated,
        isEliminated,
      };
    })
    .sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      return b.matchPercentage - a.matchPercentage;
    });
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
