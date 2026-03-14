import type { UserAnswer } from "./types";

/**
 * Encode questionnaire answers into a compact URL-safe string.
 * Format: statementId:answer pairs, base64 encoded.
 * a=agree, d=disagree, n=neither, s=skip
 */
export function encodeAnswers(answers: Record<number, UserAnswer>): string {
  const shortMap: Record<UserAnswer, string> = {
    agree: "a",
    disagree: "d",
    neither: "n",
    skip: "s",
  };

  const pairs = Object.entries(answers)
    .map(([id, answer]) => `${id}:${shortMap[answer]}`)
    .join(",");

  // Base64 encode for URL safety
  if (typeof window !== "undefined") {
    return btoa(pairs);
  }
  return Buffer.from(pairs).toString("base64");
}

/**
 * Decode a base64-encoded answer string back to answers.
 */
export function decodeAnswers(encoded: string): Record<number, UserAnswer> | null {
  try {
    const decoded = typeof window !== "undefined"
      ? atob(encoded)
      : Buffer.from(encoded, "base64").toString();

    const expandMap: Record<string, UserAnswer> = {
      a: "agree",
      d: "disagree",
      n: "neither",
      s: "skip",
    };

    const answers: Record<number, UserAnswer> = {};
    for (const pair of decoded.split(",")) {
      const [id, short] = pair.split(":");
      if (id && short && expandMap[short]) {
        answers[parseInt(id)] = expandMap[short];
      }
    }

    return Object.keys(answers).length > 0 ? answers : null;
  } catch {
    return null;
  }
}

/**
 * Compare two sets of answers and generate comparison stats.
 */
export function compareAnswers(
  myAnswers: Record<number, UserAnswer>,
  friendAnswers: Record<number, UserAnswer>,
): {
  totalCompared: number;
  agreed: number;
  disagreed: number;
  agreementPercentage: number;
  agreedIds: number[];
  disagreedIds: number[];
} {
  let totalCompared = 0;
  let agreed = 0;
  let disagreed = 0;
  const agreedIds: number[] = [];
  const disagreedIds: number[] = [];

  for (const [idStr, myAnswer] of Object.entries(myAnswers)) {
    const id = parseInt(idStr);
    const friendAnswer = friendAnswers[id];
    if (!friendAnswer || myAnswer === "skip" || friendAnswer === "skip") continue;

    totalCompared++;
    if (myAnswer === friendAnswer) {
      agreed++;
      agreedIds.push(id);
    } else {
      disagreed++;
      disagreedIds.push(id);
    }
  }

  const agreementPercentage = totalCompared > 0
    ? Math.round((agreed / totalCompared) * 100)
    : 0;

  return { totalCompared, agreed, disagreed, agreementPercentage, agreedIds, disagreedIds };
}
