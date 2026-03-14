/**
 * Official brand colors for Dutch national political parties.
 * Used for initials-based party avatars.
 */
export const PARTY_COLORS: Record<string, string> = {
  // Major national parties
  "CDA": "#007B5F",
  "VVD": "#FF6600",
  "D66": "#01AF36",
  "GroenLinks-PvdA": "#5FA821",
  "GroenLinks": "#5FA821",
  "GL-PvdA": "#5FA821",
  "PvdA-GroenLinks": "#5FA821",
  "GROENLINKS / Partij van de Arbeid": "#5FA821",
  "GROENLINKS / Partij van de Arbeid (PvdA)": "#5FA821",
  "PvdA": "#DF111B",
  "ChristenUnie": "#00A7EB",
  "ChristenUnie-SGP": "#00A7EB",
  "SP": "#EE2A24",
  "SP (Socialistische Partij)": "#EE2A24",
  "SGP": "#EB6209",
  "SGP-ChristenUnie": "#EB6209",
  "FvD": "#841923",
  "Forum voor Democratie": "#841923",
  "FVD": "#841923",
  "Volt": "#582C83",
  "PVV": "#003D6B",
  "PVV (Partij voor de Vrijheid)": "#003D6B",
  "50PLUS": "#93117E",
  "PvdD": "#006B2D",
  "Partij voor de Dieren": "#006B2D",
  "BBB": "#91B631",
  "DENK": "#00ACA0",
  "Denk": "#00ACA0",
  "BVNL": "#1D2B5D",
  "JA21": "#004B93",
  "FNP": "#FFD700",
  "BIJ1": "#FFFF00",
  "NSC": "#1B365D",
  "Leefbaar": "#FF0000",
};

/**
 * Generate a deterministic color from a party name string.
 * Used for local parties not in the PARTY_COLORS map.
 */
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * Get the brand/generated color for a party.
 */
export function getPartyColor(partyName: string): string {
  // Check exact match first
  if (PARTY_COLORS[partyName]) return PARTY_COLORS[partyName];

  // Check if name contains a known party
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (partyName.includes(key) || key.includes(partyName)) return color;
  }

  return hashColor(partyName);
}

/**
 * Get 1-3 character initials from a party name.
 */
export function getPartyInitials(name: string): string {
  // Known abbreviations
  const abbrevs: Record<string, string> = {
    "CDA": "CDA",
    "VVD": "VVD",
    "D66": "D66",
    "SP": "SP",
    "SGP": "SGP",
    "PVV": "PVV",
    "PvdA": "PA",
    "PvdD": "PD",
    "FvD": "FvD",
    "FVD": "FvD",
    "BBB": "BBB",
    "DENK": "DNK",
    "Denk": "DNK",
    "BVNL": "BVN",
    "JA21": "J21",
    "FNP": "FNP",
    "BIJ1": "BJ1",
    "NSC": "NSC",
    "Volt": "V",
  };

  for (const [key, init] of Object.entries(abbrevs)) {
    if (name.includes(key)) return init;
  }

  // Generate from words
  const words = name.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}
