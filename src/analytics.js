// Journal minimal des requêtes (pays demandés, fréquence) — stockage JSON simple.
// ⚠️ Sur Render (plan gratuit), le système de fichiers est éphémère : ce fichier
// est réinitialisé à chaque redéploiement/redémarrage. Pour des statistiques
// durables, brancher une base externe (ex: SQLite sur disque persistant, ou
// un service comme Supabase/PlanetScale).

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "data", "requests.json");

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function logRequest(senderId, countryCode, countryName) {
  const entries = loadLog();
  entries.push({
    timestamp: new Date().toISOString(),
    senderId,
    countryCode,
    countryName,
  });
  // Garde au maximum les 5000 dernières entrées
  const trimmed = entries.slice(-5000);
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
}

module.exports = { logRequest };
