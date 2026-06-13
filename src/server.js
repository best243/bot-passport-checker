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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
