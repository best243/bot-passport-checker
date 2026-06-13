// Génère l'infographie de partage (1200x630px) pour un résultat de passeport.
// Utilise @napi-rs/canvas (binaires précompilés, pas de build natif requis —
// fonctionne tel quel sur Render).

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");

const WIDTH = 1200;
const HEIGHT = 630;

// Couleurs de la charte OpenTravel (cohérentes avec les dashboards bourses/voyages)
const COLORS = {
  bg: "#0d0d0d",
  bgGradientTo: "#1a1a0a",
  gold: "#c8a84b",
  white: "#ffffff",
  grey: "#aaaaaa",
};

// Police "Roboto" (Apache 2.0, fournie par le package roboto-fontface) —
// nécessaire pour un rendu correct des accents français (é, è, à, ô...).
const FONT_BOLD = path.join(__dirname, "..", "node_modules", "roboto-fontface", "fonts", "roboto", "Roboto-Bold.woff2");
const FONT_REGULAR = path.join(__dirname, "..", "node_modules", "roboto-fontface", "fonts", "roboto", "Roboto-Regular.woff2");
if (fs.existsSync(FONT_BOLD)) GlobalFonts.registerFromPath(FONT_BOLD, "Roboto");
if (fs.existsSync(FONT_REGULAR)) GlobalFonts.registerFromPath(FONT_REGULAR, "Roboto");
const FONT = GlobalFonts.has("Roboto") ? "Roboto" : "sans-serif";

/**
 * @param {object} data
 * @param {string} data.countryName  Nom du pays en français
 * @param {string} data.flagUrl      URL du drapeau (PNG)
 * @param {number|null} data.rank    Classement mondial (ou null)
 * @param {number} data.visaFree
 * @param {number} data.visaOnArrival
 * @param {number} data.eVisa
 * @param {number} data.visaRequired
 * @param {number} data.totalDestinations
 * @param {string[]} data.topDestinations
 * @returns {Promise<Buffer>} image PNG
 */
async function generatePassportImage(data) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Fond dégradé
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.bg);
  gradient.addColorStop(1, COLORS.bgGradientTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Bandeau doré en haut
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, 0, WIDTH, 8);

  // Logo / nom de la page
  ctx.fillStyle = COLORS.gold;
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText("opentravel", 50, 60);

  // Drapeau du pays
  try {
    const flag = await loadImage(data.flagUrl);
    const flagW = 180;
    const flagH = (flag.height / flag.width) * flagW;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.drawImage(flag, 50, 110, flagW, flagH);
    ctx.restore();
  } catch (err) {
    console.error("[imageGenerator] drapeau indisponible :", err.message);
  }

  // Nom du pays
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText(data.countryName, 270, 165);

  // Score / classement
  ctx.fillStyle = COLORS.gold;
  ctx.font = `bold 32px ${FONT}`;
  const rankText = data.rank ? `Classement mondial : #${data.rank}` : "Score de mobilité";
  ctx.fillText(rankText, 270, 215);

  const mobilityScore = data.visaFree + data.visaOnArrival + data.eVisa;
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold 80px ${FONT}`;
  ctx.fillText(`${mobilityScore} pays`, 50, 350);
  ctx.fillStyle = COLORS.grey;
  ctx.font = `28px ${FONT}`;
  ctx.fillText("accessibles sans visa, eVisa ou visa à l'arrivée", 50, 390);

  // Répartition
  const stats = [
    { label: "Sans visa", value: data.visaFree, color: "#2ecc71" },
    { label: "Visa à l'arrivée", value: data.visaOnArrival, color: "#3498db" },
    { label: "eVisa", value: data.eVisa, color: "#9b59b6" },
    { label: "Visa requis", value: data.visaRequired, color: "#e74c3c" },
  ];

  let x = 50;
  const boxY = 440;
  const boxW = 260;
  stats.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(x, boxY, 10, 60);
    ctx.fillStyle = COLORS.white;
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillText(String(s.value), x + 25, boxY + 30);
    ctx.fillStyle = COLORS.grey;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(s.label, x + 25, boxY + 55);
    x += boxW;
  });

  // Top destinations sans visa
  if (data.topDestinations?.length) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText("Top destinations sans visa :", 50, 555);
    ctx.fillStyle = COLORS.white;
    ctx.font = `22px ${FONT}`;
    ctx.fillText(data.topDestinations.slice(0, 5).join("  ·  "), 50, 590);
  }

  // Pied de page
  ctx.fillStyle = COLORS.grey;
  ctx.font = `18px ${FONT}`;
  ctx.fillText("Découvrez votre passeport sur la page Facebook OpenTravel", 50, HEIGHT - 20);

  return canvas.encode("png");
}

module.exports = { generatePassportImage };
