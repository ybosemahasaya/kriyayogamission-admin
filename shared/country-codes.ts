/** Search Console's "country" dimension returns lowercase ISO 3166-1
 * alpha-3 codes ("ind", "usa", "gbr"...), not human-readable names. This
 * covers the countries most likely to show up in this site's traffic;
 * anything missing falls back to the raw code, uppercased, rather than
 * crashing or showing nothing -- a small, extensible map beats a
 * 250-entry one nobody will ever fully exercise. */
const COUNTRY_NAMES: Record<string, string> = {
  ind: "India",
  usa: "United States",
  gbr: "United Kingdom",
  can: "Canada",
  aus: "Australia",
  pak: "Pakistan",
  bgd: "Bangladesh",
  npl: "Nepal",
  lka: "Sri Lanka",
  are: "United Arab Emirates",
  sgp: "Singapore",
  deu: "Germany",
  fra: "France",
  esp: "Spain",
  ita: "Italy",
  nld: "Netherlands",
  jpn: "Japan",
  chn: "China",
  rus: "Russia",
  zaf: "South Africa",
  nga: "Nigeria",
  ken: "Kenya",
  idn: "Indonesia",
  mys: "Malaysia",
  phl: "Philippines",
  tha: "Thailand",
  vnm: "Vietnam",
  kor: "South Korea",
  mex: "Mexico",
  bra: "Brazil",
  arg: "Argentina",
  sau: "Saudi Arabia",
  isr: "Israel",
  irl: "Ireland",
  nzl: "New Zealand",
  che: "Switzerland",
  swe: "Sweden",
  nor: "Norway",
  dnk: "Denmark",
  pol: "Poland",
  ukr: "Ukraine",
  tur: "Turkey",
  egy: "Egypt",
  mmr: "Myanmar",
};

export function countryName(isoCode: string): string {
  const key = isoCode.toLowerCase();
  return COUNTRY_NAMES[key] ?? isoCode.toUpperCase();
}
