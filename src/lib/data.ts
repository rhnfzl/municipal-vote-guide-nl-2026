import type { Municipality, MunicipalityData } from "./types";

let municipalityIndex: Municipality[] | null = null;

export async function getMunicipalityIndex(): Promise<Municipality[]> {
  if (municipalityIndex) return municipalityIndex;
  const res = await fetch("/data/index.json");
  municipalityIndex = await res.json();
  return municipalityIndex!;
}

export async function getMunicipalityData(
  slug: string,
  locale: string = "nl"
): Promise<MunicipalityData> {
  // Try requested locale first, fall back to nl
  const localeToTry = locale === "en" ? "en" : "nl";
  let res = await fetch(`/data/municipalities/${slug}/${localeToTry}.json`);
  if (!res.ok && localeToTry === "en") {
    res = await fetch(`/data/municipalities/${slug}/nl.json`);
  }
  if (!res.ok) throw new Error(`Municipality not found: ${slug}`);
  return res.json();
}

export function searchMunicipalities(
  municipalities: Municipality[],
  query: string
): Municipality[] {
  if (!query.trim()) return municipalities;
  const q = query.toLowerCase().trim();
  return municipalities.filter(
    (m) =>
      m.name.toLowerCase().includes(q) || m.slug.includes(q)
  );
}
