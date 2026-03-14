/**
 * Dutch → English translations for the most common themes in the national stats.
 * Used in the Explore page chart to show theme names in the selected language.
 */
export const THEME_TRANSLATIONS: Record<string, string> = {
  "Cameratoezicht": "Camera surveillance",
  "Handhavers": "Enforcement officers",
  "Referendum": "Referendum",
  "Tegenprestatie voor uitkering": "Work requirement for benefits",
  "Zorgkeuze": "Healthcare choice",
  "Armoedebestrijding": "Poverty reduction",
  "Voorrang voor vluchtelingen": "Priority for refugees",
  "Elektrische laadpalen": "Electric charging stations",
  "Snelheid auto's": "Speed limits for cars",
  "Vuurwerk": "Fireworks",
  "Duurzame energie": "Sustainable energy",
  "Belasting op gebouwen": "Building tax",
  "Hondenbelasting": "Dog tax",
  "Evenementen": "Events",
  "Reclame": "Advertising",
  "Bedrijventerreinen": "Business parks",
  "Hoogbouw": "High-rise buildings",
  "Groen in de wijken": "Green spaces in neighborhoods",
  "Duurzaamheid": "Sustainability",
  "Sociale huurwoningen": "Social housing",
  "Jongerenwerk": "Youth services",
  "Zero-emissiezone": "Zero-emission zone",
  "Ouderenombudsman": "Ombudsman for seniors",
  "Kleinschalige asielopvang": "Small-scale asylum reception",
  "OZB": "Property tax (OZB)",
  "Windmolens": "Wind turbines",
  "Zonnepanelen": "Solar panels",
  "Fietsbeleid": "Cycling policy",
  "Parkeren": "Parking",
  "Toeristenbelasting": "Tourist tax",
  "Winkels": "Shops",
  "Straatverlichting": "Street lighting",
  "Afval": "Waste collection",
  "Natuur": "Nature",
  "Verkeersveiligheid": "Traffic safety",
  "Woningbouw": "Housing construction",
  "Centrum": "City center",
  "Sport": "Sports",
  "Cultuur": "Culture",
  "Onderwijs": "Education",
  "Zorg": "Healthcare",
  "Participatie": "Participation",
  "Klimaat": "Climate",
  "Energie": "Energy",
  "Economie": "Economy",
  "Veiligheid": "Safety",
  "Inwoners": "Residents",
  "Voorrang statushouders": "Priority for status holders",
  "Minder geld voor cultuur": "Less funding for culture",
  "Bouwen in buitengebied": "Construction in rural area",
  "Kwetsbare wijken": "Vulnerable neighborhoods",
  "Misbruik armoederegelingen": "Abuse of poverty assistance programs",
  "Zelfbewoningsplicht": "Owner-occupancy requirement",
  "Ondersteuning naar werk": "Support to find employment",
  "Publiekstrekker Citadelpoort": "Attraction: Citadelpoort",
  "Meer handhavers": "More enforcement officers",
  "Aanpak leegstand": "Addressing vacant properties",
  "Dubbelgebruik sportaccommodaties": "Shared use of sports facilities",
  "Treinstation Maaspoort": "Maaspoort train station",
  "Bossche Pas": "Bossche Pas",
  "Verkeersknips": "Traffic closures",
  "Vrije keuze zorgaanbieder": "Free choice of care provider",
  "Dierentehuis": "Animal shelter",
};

/**
 * Translate a theme name based on locale.
 * Returns the original if no translation found.
 */
export function translateTheme(theme: string, locale: string): string {
  if (locale === "en" && THEME_TRANSLATIONS[theme]) {
    return THEME_TRANSLATIONS[theme];
  }
  return theme;
}
