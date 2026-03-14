export interface Municipality {
  id: string;
  name: string;
  slug: string;
  language: string;
  numParties: number;
  numStatements: number;
}

export interface MunicipalityData {
  id: string;
  name: string;
  slug: string;
  parties: Party[];
  statements: Statement[];
  shootoutStatements?: Statement[];
}

export interface Party {
  id: number;
  name: string;
  nameEn?: string;
  fullName: string;
  website: string;
  hasSeats: boolean;
  participates: boolean;
  positions: Record<number, PartyPosition>;
}

export interface PartyPosition {
  position: "agree" | "disagree" | "neither";
  explanation: string;
  explanationEn?: string;
}

export interface Statement {
  id: number;
  index: number;
  theme: string;
  themeEn?: string;
  themeId: string;
  title: string;
  titleEn?: string;
  moreInfo: string;
  moreInfoEn?: string;
  pro: string;
  proEn?: string;
  con: string;
  conEn?: string;
  isShootout: boolean;
}

export type UserAnswer = "agree" | "disagree" | "neither" | "skip";

export interface PartyMatch {
  partyId: number;
  partyName: string;
  partyNameEn?: string;
  matchPercentage: number;
  agreeCount: number;
  disagreeCount: number;
  neitherCount: number;
  totalAnswered: number;
}
