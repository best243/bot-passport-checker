// Service de récupération des données "passport index" (mobilité du passeport).
//
// Mode LIVE : utilise une API "Passport Index" sur RapidAPI (configurée via
// RAPIDAPI_KEY / RAPIDAPI_HOST / RAPIDAPI_PASSPORT_PATH dans .env).
// Mode DEMO : si RAPIDAPI_KEY est absente, ou si l'appel échoue, on retombe
// sur des données de démonstration locales (data/mock-passports.json) afin
// que le bot reste fonctionnel pour les tests.
//
// NOTE IMPORTANTE :
// Les APIs "Passport Index" disponibles sur RapidAPI changent régulièrement
// de nom/format de réponse. Si tu en choisis une, adapte uniquement la
// fonction `mapApiResponse(raw)` ci-dessous pour faire correspondre les
// champs de la réponse à notre format interne. Le reste du code n'a pas
// besoin d'être modifié.

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const CACHE_DIR = path.join(__dirname, "..", "cache");
const MOCK_FILE = path.join(__dirname, "..", "data", "mock-passports.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "";
// Chemin de l'endpoint, ex: "/passport/{code}" — {code} sera remplacé par le code ISO2
const RAPIDAPI_PASSPORT_PATH = process.env.RAPIDAPI_PASSPORT_PATH || "/passport/{code}";

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const mockData = JSON.parse(fs.readFileSync(MOCK_FILE, "utf-8"));

function cachePath(code) {
  return path.join(CACHE_DIR, `${code}.json`);
}

function readCache(code) {
  const file = cachePath(code);
  if (!fs.existsSync(file)) return null;
  try {
    const { timestamp, data } = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(code, data) {
  fs.writeFileSync(
    cachePath(code),
    JSON.stringify({ timestamp: Date.now(), data }),
    "utf-8"
  );
}

/**
 * Adapte la réponse brute de l'API RapidAPI choisie vers notre format interne.
 * ⚠️ À ADAPTER selon l'API "Passport Index" réellement utilisée — voir le
 * README pour la liste de champs attendus en sortie.
 */
function mapApiResponse(raw, code) {
  // Exemple générique : on essaie plusieurs noms de champs courants.
  const visaFree     = raw.visa_free ?? raw.visaFree ?? raw.visa_free_count ?? 0;
  const visaOnArrival = raw.visa_on_arrival ?? raw.visaOnArrival ?? raw.voa_count ?? 0;
  const eVisa        = raw.e_visa ?? raw.eVisa ?? raw.evisa_count ?? 0;
  const visaRequired = raw.visa_required ?? raw.visaRequired ?? raw.visa_required_count ?? 0;
  const rank         = raw.rank ?? raw.global_rank ?? null;
  const total        = visaFree + visaOnArrival + eVisa + visaRequired;
  const topDestinations =
    raw.top_destinations ?? raw.topDestinations ?? raw.visa_free_countries?.slice(0, 5) ?? [];

  return {
    code,
    rank,
    totalDestinations: total || 199,
    visaFree,
    visaOnArrival,
    eVisa,
    visaRequired,
    topDestinations,
    source: "live",
  };
}

function fromMock(code) {
  const m = mockData[code];
  if (!m) return null;
  return {
    code,
    rank: m.rank,
    totalDestinations: m.totalDestinations,
    visaFree: m.visaFree,
    visaOnArrival: m.visaOnArrival,
    eVisa: m.eVisa,
    visaRequired: m.visaRequired,
    topDestinations: m.topDestinations,
    source: "demo",
  };
}

/**
 * Récupère les données de mobilité pour un code pays ISO2.
 * Ordre : cache (24h) -> API live (si configurée) -> données de démo -> null
 */
async function getPassportData(code) {
  const cached = readCache(code);
  if (cached) return cached;

  let data = null;

  if (RAPIDAPI_KEY && RAPIDAPI_HOST) {
    try {
      const url = `https://${RAPIDAPI_HOST}${RAPIDAPI_PASSPORT_PATH.replace("{code}", code)}`;
      const res = await axios.get(url, {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": RAPIDAPI_HOST,
        },
        timeout: 10000,
      });
      data = mapApiResponse(res.data, code);
    } catch (err) {
      console.error(`[passportService] API live échouée pour ${code} :`, err.message);
    }
  }

  if (!data) {
    data = fromMock(code);
  }

  if (data) writeCache(code, data);
  return data;
}

module.exports = { getPassportData };
