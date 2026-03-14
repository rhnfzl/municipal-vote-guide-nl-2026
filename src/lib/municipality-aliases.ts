/**
 * Municipality name aliases for search.
 * Maps alternate names (English names, common abbreviations, nicknames)
 * to the official municipality slug.
 */
export const MUNICIPALITY_ALIASES: Record<string, string[]> = {
  "s-hertogenbosch": ["Den Bosch", "den bosch", "hertogenbosch"],
  "s-gravenhage": ["The Hague", "the hague", "Den Haag", "den haag"],
  "utrecht": ["Utrecht city"],
  "amsterdam": ["A'dam"],
  "rotterdam": ["R'dam"],
  "groningen": ["Groningen city"],
  "eindhoven": ["Eindhoven city", "Eindhoven (NB)"],
  "maastricht": ["Maastricht city"],
  "tilburg": ["Tilburg city"],
  "nijmegen": ["Nimwegen", "Nijmegen city"],
  "arnhem": ["Arnhem city"],
  "leeuwarden": ["Ljouwert"],
  "zaanstad": ["Zaandam"],
  "haarlem": ["Haarlem city"],
  "almere": ["Almere city"],
  "breda": ["Breda city"],
  "enschede": ["Enschede city"],
  "apeldoorn": ["Apeldoorn city"],
  "dordrecht": ["Dordt"],
  "leiden": ["Leyden"],
  "delft": ["Delft city"],
  "gouda": ["Gouda city"],
  "deventer": ["Deventer city"],
  "vlissingen": ["Flushing"],
  "middelburg-z": ["Middelburg"],
  "bergen-op-zoom": ["Bergen op Zoom"],
  "roosendaal": ["Roosendaal city"],
  "veendam": ["Veendam city"],
  "kapelle": ["Kapelle city"],
  "goes": ["Goes city"],
  "noardeast-frysln": ["Noardeast-Fryslân", "Noordoost-Friesland"],
  "tytsjerksteradiel": ["Tietjerksteradeel"],
  "waadhoeke": ["Waadhoeke"],
  "dantumadiel": ["Dantumadeel"],
  "westerkwartier": ["Westerkwartier"],
};

/**
 * Search municipalities with alias support.
 * Matches against official name, slug, AND aliases.
 */
export function searchWithAliases<T extends { name: string; slug: string }>(
  municipalities: T[],
  query: string
): T[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  return municipalities.filter((m) => {
    // Match official name
    if (m.name.toLowerCase().includes(q)) return true;
    // Match slug
    if (m.slug.includes(q)) return true;
    // Match aliases
    const aliases = MUNICIPALITY_ALIASES[m.slug];
    if (aliases) {
      return aliases.some((alias) => alias.toLowerCase().includes(q));
    }
    return false;
  });
}
