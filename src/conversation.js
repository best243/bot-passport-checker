// Logique conversationnelle du bot "Passport Power Checker".

const fs = require("fs");
const path = require("path");

const { findCountry, suggestCountries } = require("./countries");
const { getPassportData } = require("./passportService");
const { generatePassportImage } = require("./imageGenerator");
const { logRequest } = require("./analytics");
const {
  sendText,
  sendButtons,
  sendImage,
  quickReply,
  webUrlButton,
  postbackButton,
} = require("./messenger");

const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");
const GENERATED_DIR = path.join(__dirname, "..", "public", "generated");
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

// État de conversation par utilisateur (en mémoire — suffisant pour un bot
// mono-instance ; pour plusieurs instances, externaliser dans Redis par ex.)
const sessions = new Map();

const STATE = {
  AWAITING_COUNTRY: "AWAITING_COUNTRY",
};

function flagUrl(iso2) {
  return `https://flagcdn.com/w320/${iso2.toLowerCase()}.png`;
}

async function handleMessage(senderId, text) {
  const session = sessions.get(senderId) || {};

  if (session.state === STATE.AWAITING_COUNTRY || !session.state) {
    return handleCountryInput(senderId, text);
  }

  // Par défaut, on retente une recherche de pays
  return handleCountryInput(senderId, text);
}

async function handlePostback(senderId, payload) {
  switch (payload) {
    case "GET_STARTED":
      return sendWelcome(senderId);
    case "CHECK_PASSPORT":
    case "CHECK_ANOTHER":
      sessions.set(senderId, { state: STATE.AWAITING_COUNTRY });
      return sendText(
        senderId,
        "De quelle nationalité êtes-vous ? Tapez le nom du pays (ex : Côte d'Ivoire, Sénégal, Cameroun...)."
      );
    default:
      return sendWelcome(senderId);
  }
}

async function sendWelcome(senderId) {
  sessions.delete(senderId);
  return sendButtons(
    senderId,
    "Bienvenue sur OpenTravel ! Découvrez où votre passeport peut vous emmener dans le monde, et partagez le résultat avec vos amis.",
    [postbackButton("Vérifier mon passeport", "CHECK_PASSPORT")]
  );
}

async function handleCountryInput(senderId, text) {
  const match = findCountry(text);

  if (!match || match.score < 0.6) {
    const suggestions = suggestCountries(text, 3).filter((s) => s.score >= 0.3);
    if (suggestions.length) {
      return sendText(
        senderId,
        "Je n'ai pas trouvé ce pays. Vouliez-vous dire :",
        suggestions.map((s) => quickReply(s.name, `COUNTRY:${s.code}`))
      );
    }
    return sendText(
      senderId,
      "Je n'ai pas reconnu ce pays. Pouvez-vous réessayer en tapant le nom complet (ex : Côte d'Ivoire, Burkina Faso, Maroc...) ?"
    );
  }

  sessions.set(senderId, { state: STATE.AWAITING_COUNTRY });
  return sendResult(senderId, match.code, match.name);
}

async function handleQuickReplyPayload(senderId, payload) {
  if (payload.startsWith("COUNTRY:")) {
    const code = payload.replace("COUNTRY:", "");
    const { COUNTRY_LIST } = require("./countries");
    const c = COUNTRY_LIST.find((x) => x.code === code);
    if (c) return sendResult(senderId, c.code, c.name);
  }
  return handlePostback(senderId, payload);
}

async function sendResult(senderId, code, name) {
  await sendText(senderId, `Recherche des données pour ${name}...`);

  const data = await getPassportData(code);
  if (!data) {
    return sendText(
      senderId,
      "Désolé, je n'ai pas pu récupérer les données pour ce pays pour le moment. Réessayez plus tard."
    );
  }

  logRequest(senderId, code, name);

  const imageData = {
    countryName: name,
    flagUrl: flagUrl(code),
    rank: data.rank,
    visaFree: data.visaFree,
    visaOnArrival: data.visaOnArrival,
    eVisa: data.eVisa,
    visaRequired: data.visaRequired,
    totalDestinations: data.totalDestinations,
    topDestinations: data.topDestinations,
  };

  const filename = `${code}-${Date.now()}.png`;
  const filepath = path.join(GENERATED_DIR, filename);

  try {
    const png = await generatePassportImage(imageData);
    fs.writeFileSync(filepath, png);
  } catch (err) {
    console.error("[conversation] Erreur génération image :", err.message);
    return sendSummaryTextOnly(senderId, name, data);
  }

  const mobilityScore = data.visaFree + data.visaOnArrival + data.eVisa;
  const summary =
    `Passeport ${name}${data.rank ? ` — Classement mondial #${data.rank}` : ""}\n` +
    `${mobilityScore} pays accessibles sans visa, eVisa ou visa à l'arrivée :\n` +
    `  • Sans visa : ${data.visaFree}\n` +
    `  • Visa à l'arrivée : ${data.visaOnArrival}\n` +
    `  • eVisa : ${data.eVisa}\n` +
    `  • Visa requis : ${data.visaRequired}` +
    (data.source === "demo" ? "\n(Données de démonstration)" : "");

  await sendText(senderId, summary);

  if (BASE_URL) {
    const imageUrl = `${BASE_URL}/generated/${filename}`;
    const shareUrl = `${BASE_URL}/share/${code}/${filename}`;
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;

    await sendImage(senderId, imageUrl);

    return sendButtons(
      senderId,
      "Découvrez où VOTRE passeport peut vous emmener et partagez avec vos amis !",
      [
        webUrlButton("Partager sur Facebook", fbShareUrl),
        postbackButton("Vérifier un autre passeport", "CHECK_ANOTHER"),
      ]
    );
  }

  return sendButtons(senderId, "Que souhaitez-vous faire ?", [
    postbackButton("Vérifier un autre passeport", "CHECK_ANOTHER"),
  ]);
}

async function sendSummaryTextOnly(senderId, name, data) {
  const mobilityScore = data.visaFree + data.visaOnArrival + data.eVisa;
  await sendText(
    senderId,
    `Passeport ${name} : ${mobilityScore} pays accessibles sans visa, eVisa ou visa à l'arrivée.`
  );
  return sendButtons(senderId, "Que souhaitez-vous faire ?", [
    postbackButton("Vérifier un autre passeport", "CHECK_ANOTHER"),
  ]);
}

module.exports = { handleMessage, handlePostback, handleQuickReplyPayload, sendWelcome };
