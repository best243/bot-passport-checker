// Génère l'icône de l'app (1024x1024) pour la soumission à la revue Meta.
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");

const SIZE = 1024;

const FONT_BOLD = path.join(__dirname, "..", "node_modules", "roboto-fontface", "fonts", "roboto", "Roboto-Bold.woff2");
if (fs.existsSync(FONT_BOLD)) GlobalFonts.registerFromPath(FONT_BOLD, "Roboto");
const FONT = GlobalFonts.has("Roboto") ? "Roboto" : "sans-serif";

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");

// Fond dégradé
const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
gradient.addColorStop(0, "#0d0d0d");
gradient.addColorStop(1, "#1a1a0a");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, SIZE, SIZE);

// Cercle doré
ctx.strokeStyle = "#c8a84b";
ctx.lineWidth = 28;
ctx.beginPath();
ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 60, 0, Math.PI * 2);
ctx.stroke();

// Texte "OT"
ctx.fillStyle = "#c8a84b";
ctx.font = `bold 360px ${FONT}`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("OT", SIZE / 2, SIZE / 2 - 30);

// Sous-titre
ctx.fillStyle = "#ffffff";
ctx.font = `bold 64px ${FONT}`;
ctx.fillText("PASSPORT", SIZE / 2, SIZE / 2 + 220);

(async () => {
  const buffer = await canvas.encode("png");
  const outPath = path.join(__dirname, "..", "public", "app-icon-1024.png");
  fs.writeFileSync(outPath, buffer);
  console.log("Icône générée :", outPath);
})();
