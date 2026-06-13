// Normalisation des noms de pays en français + correspondance ISO 3166-1 alpha-2
// Utilise i18n-iso-countries (qui inclut les noms français officiels) et
// string-similarity pour tolérer les fautes de frappe courantes.

const countries = require("i18n-iso-countries");
const stringSimilarity = require("string-similarity");

countries.registerLocale(require("i18n-iso-countries/langs/fr.json"));
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

// { "FR": "France", "CI": "Côte d'Ivoire", ... }
const NAMES_FR = countries.getNames("fr", { select: "official" });

// Quelques alias / abréviations courantes utilisées en français familier
const ALIASES = {
  "rdc": "CD",
  "congo kinshasa": "CD",
  "congo brazzaville": "CG",
  "cote d ivoire": "CI",
  "côte d ivoire": "CI",
  "ivoire": "CI",
  "etats unis": "US",
  "états unis": "US",
  "usa": "US",
  "u.s.a": "US",
  "uk": "GB",
  "angleterre": "GB",
  "grande bretagne": "GB",
  "emirats arabes unis": "AE",
  "émirats arabes unis": "AE",
  "emirats": "AE",
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Liste pré-calculée { code, name, normalized } pour la recherche
const COUNTRY_LIST = Object.entries(NAMES_FR).map(([code, name]) => ({
  code,
  name,
  normalized: normalize(name),
}));

const NORMALIZED_NAMES = COUNTRY_LIST.map((c) => c.normalized);

/**
 * Trouve le code ISO2 du pays le plus proche du texte saisi par l'utilisateur.
 * Retourne { code, name, score } ou null si aucune correspondance acceptable.
 */
function findCountry(input) {
  const norm = normalize(input);
  if (!norm) return null;

  // 1. Alias direct
  if (ALIASES[norm]) {
    const code = ALIASES[norm];
    return { code, name: NAMES_FR[code], score: 1 };
  }

  // 2. Correspondance exacte
  const exact = COUNTRY_LIST.find((c) => c.normalized === norm);
  if (exact) return { code: exact.code, name: exact.name, score: 1 };

  // 3. Le texte est contenu dans un nom de pays (ex: "congo" -> plusieurs Congo)
  const contains = COUNTRY_LIST.filter(
    (c) => c.normalized.includes(norm) || norm.includes(c.normalized)
  );
  if (contains.length === 1) {
    return { code: contains[0].code, name: contains[0].name, score: 0.95 };
  }

  // 4. Fuzzy matching (tolère les fautes de frappe)
  const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(
    norm,
    NORMALIZED_NAMES
  );
  if (bestMatch.rating >= 0.45) {
    const c = COUNTRY_LIST[bestMatchIndex];
    return { code: c.code, name: c.name, score: bestMatch.rating };
  }

  return null;
}

/**
 * Retourne jusqu'à `limit` suggestions de pays proches du texte saisi,
 * utiles pour proposer des quick replies en cas d'ambiguïté.
 */
function suggestCountries(input, limit = 3) {
  const norm = normalize(input);
  if (!norm) return [];

  const ratings = stringSimilarity.findBestMatch(norm, NORMALIZED_NAMES).ratings;
  return ratings
    .map((r, i) => ({ ...COUNTRY_LIST[i], score: r.rating }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { findCountry, suggestCountries, normalize, COUNTRY_LIST };
