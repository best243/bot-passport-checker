// Wrapper minimal autour de la Messenger Platform Send API (Meta).

const axios = require("axios");

const GRAPH_VERSION = "v19.0";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";

const SEND_API_URL = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages`;

async function callSendAPI(payload) {
  try {
    await axios.post(SEND_API_URL, payload, {
      params: { access_token: PAGE_ACCESS_TOKEN },
      timeout: 15000,
    });
  } catch (err) {
    console.error(
      "[messenger] Erreur Send API :",
      err.response?.data || err.message
    );
  }
}

function sendText(recipientId, text, quickReplies = null) {
  const message = { text };
  if (quickReplies) message.quick_replies = quickReplies;
  return callSendAPI({ recipient: { id: recipientId }, message });
}

/**
 * Envoie un template "button" générique avec un titre, un sous-titre et
 * jusqu'à 3 boutons (postback ou web_url).
 */
function sendButtons(recipientId, text, buttons) {
  return callSendAPI({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "button", text, buttons },
      },
    },
  });
}

/**
 * Envoie une image à partir d'une URL publique accessible (le serveur doit
 * être joignable depuis Internet — voir README pour le déploiement Render).
 */
function sendImage(recipientId, imageUrl) {
  return callSendAPI({
    recipient: { id: recipientId },
    message: {
      attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } },
    },
  });
}

function quickReply(title, payload) {
  return { content_type: "text", title, payload };
}

function webUrlButton(title, url) {
  return { type: "web_url", title, url, webview_height_ratio: "full" };
}

function postbackButton(title, payload) {
  return { type: "postback", title, payload };
}

module.exports = {
  sendText,
  sendButtons,
  sendImage,
  quickReply,
  webUrlButton,
  postbackButton,
};
