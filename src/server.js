// Serveur Express : webhook Messenger + page de partage Open Graph + fichiers générés.

require("dotenv").config();

const express = require("express");
const path = require("path");

const { handleMessage, handlePostback, handleQuickReplyPayload, sendWelcome } = require("./conversation");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

// Sert les images générées (infographies de résultat)
app.use("/generated", express.static(path.join(__dirname, "..", "public", "generated")));

// Sert l'icône de l'app (revue Meta)
app.get("/app-icon-1024.png", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "app-icon-1024.png"));
});

// ── Vérification du webhook (Meta) ────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ── Réception des événements Messenger ────────────────────────
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") return res.sendStatus(404);

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      if (!senderId) continue;

      try {
        if (event.message?.quick_reply?.payload) {
          await handleQuickReplyPayload(senderId, event.message.quick_reply.payload);
        } else if (event.message?.text) {
          await handleMessage(senderId, event.message.text);
        } else if (event.postback?.payload) {
          await handlePostback(senderId, event.postback.payload);
        }
      } catch (err) {
        console.error("[server] Erreur traitement event :", err);
      }
    }
  }

  res.status(200).send("EVENT_RECEIVED");
});

// ── Page de partage avec balises Open Graph ───────────────────
// Permet au dialogue de partage Facebook d'afficher l'infographie générée
// comme aperçu (image + titre) lorsqu'on partage le lien.
app.get("/share/:code/:filename", (req, res) => {
  const { code, filename } = req.params;
  const imageUrl = `${BASE_URL}/generated/${filename}`;
  const pageUrl = `${BASE_URL}/share/${code}/${filename}`;

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Mon passeport - OpenTravel</title>
  <meta property="og:title" content="Découvrez où mon passeport peut m'emmener !" />
  <meta property="og:description" content="Vérifiez la puissance de votre passeport avec le bot OpenTravel sur Messenger." />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body style="font-family:sans-serif;text-align:center;background:#0d0d0d;color:#fff;padding:40px">
  <img src="${imageUrl}" alt="Résultat passeport" style="max-width:100%;border-radius:12px"/>
  <p style="margin-top:20px">
    <a href="https://www.facebook.com/profile.php?id=100063685734695" style="color:#c8a84b">
      Vérifiez votre propre passeport sur OpenTravel
    </a>
  </p>
</body>
</html>`);
});

app.get("/", (req, res) => {
  res.send("OpenTravel Passport Power Checker — OK");
});

// ── Politique de confidentialité (requise pour la revue Meta) ─
app.get("/privacy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Politique de confidentialité - OpenTravel Passport Power Checker</title>
  <style>
    body { font-family: -apple-system, Arial, sans-serif; background:#0d0d0d; color:#eee; max-width:720px; margin:0 auto; padding:40px 20px; line-height:1.6; }
    h1, h2 { color:#c8a84b; }
    a { color:#c8a84b; }
  </style>
</head>
<body>
  <h1>Politique de confidentialité</h1>
  <p>Dernière mise à jour : 2026.</p>

  <p>
    Le bot Messenger <strong>"Passport Power Checker"</strong> de la page Facebook
    <strong>OpenTravel</strong> permet à un utilisateur d'indiquer une nationalité
    et de recevoir en retour une infographie indiquant le nombre de pays
    accessibles avec ce passeport (sans visa, eVisa, visa à l'arrivée, visa requis).
  </p>

  <h2>1. Données collectées</h2>
  <p>
    Lorsque vous utilisez ce bot via Messenger, nous recevons :
  </p>
  <ul>
    <li>Votre identifiant Messenger (PSID), fourni automatiquement par la plateforme Messenger pour permettre la conversation.</li>
    <li>Le texte des messages que vous envoyez au bot (ex : le nom d'un pays).</li>
  </ul>
  <p>
    Nous ne demandons et ne collectons aucune autre information personnelle
    (pas de nom, email, numéro de téléphone, localisation précise, etc.).
  </p>

  <h2>2. Utilisation des données</h2>
  <p>
    Ces données sont utilisées uniquement pour :
  </p>
  <ul>
    <li>Répondre à votre demande (générer l'infographie correspondant au pays indiqué).</li>
    <li>Tenir un journal statistique anonyme et agrégé des pays les plus demandés, afin d'améliorer le service.</li>
  </ul>
  <p>
    Aucune donnée n'est vendue, partagée avec des tiers à des fins publicitaires,
    ou utilisée pour vous profiler.
  </p>

  <h2>3. Conservation des données</h2>
  <p>
    Les journaux de requêtes sont conservés de façon limitée (les entrées les
    plus anciennes sont automatiquement supprimées) et ne contiennent pas
    d'information permettant de vous identifier personnellement au-delà de
    votre identifiant Messenger.
  </p>

  <h2>4. Vos droits</h2>
  <p>
    Vous pouvez à tout moment arrêter d'utiliser le bot en ne lui envoyant
    plus de messages. Pour toute question concernant vos données ou pour
    demander leur suppression, contactez-nous via la messagerie de la page
    Facebook <a href="https://www.facebook.com/profile.php?id=100063685734695">OpenTravel</a>.
  </p>

  <h2>5. Contact</h2>
  <p>
    Pour toute question relative à cette politique de confidentialité,
    contactez-nous via la page Facebook OpenTravel.
  </p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
