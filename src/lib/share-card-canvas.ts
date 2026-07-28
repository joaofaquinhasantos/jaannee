// Browser-only canvas renderer for share cards. Import lazily from event
// handlers so it never runs during SSR. No credentials are used: photos are
// loaded through the same-origin /photos proxy or as anonymous CORS images.
import {
  SHARE_FORMATS,
  type ComparisonCardModel,
  type RankingCardModel,
  type ShareFormat,
} from "@/lib/share-card";

const PAPER = "#FAF8F4";
const INK = "#1E1917";
const RED = "#D6321F";
const GOLD = "#C79A3E";

const DISPLAY_FONT = '"Instrument Serif", Georgia, serif';
const SANS_FONT = '"Hanken Grotesk", "IBM Plex Sans Thai", system-ui, sans-serif';

async function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("/")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function placeholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#221E1B";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number) {
  let size = startPx;
  while (size > 22) {
    ctx.font = `${size}px ${DISPLAY_FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pad: number,
  tagline: string,
) {
  ctx.fillStyle = INK;
  ctx.font = `44px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("JaanNee", pad, height - pad - 12);
  ctx.fillStyle = "rgba(30,25,23,0.55)";
  ctx.font = `600 22px ${SANS_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(tagline, width - pad, height - pad - 16);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

async function renderComparison(
  ctx: CanvasRenderingContext2D,
  model: ComparisonCardModel,
  width: number,
  height: number,
) {
  const pad = Math.round(width * 0.07);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  const headerY = pad + 40;
  ctx.fillStyle = RED;
  ctx.font = `800 26px ${SANS_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(model.kicker, pad, headerY);
  if (model.pool) {
    ctx.fillStyle = "rgba(30,25,23,0.55)";
    ctx.font = `700 24px ${SANS_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(truncate(ctx, model.pool, width * 0.5), width - pad, headerY);
  }

  const top = headerY + 40;
  const bottomReserved = pad * 2 + 150;
  const stackH = height - top - bottomReserved;
  const gap = 26;
  const cardH = (stackH - gap) / 2;
  const cardW = width - pad * 2;

  const [winnerImg, loserImg] = await Promise.all([
    loadImage(model.winnerPhoto),
    loadImage(model.loserPhoto),
  ]);

  const panels: Array<[HTMLImageElement | null, string, string, boolean]> = [
    [winnerImg, model.winnerName, model.winnerPlace, true],
    [loserImg, model.loserName, model.loserPlace, false],
  ];

  panels.forEach(([img, name, place, isWinner], index) => {
    const y = top + index * (cardH + gap);
    if (img) coverDraw(ctx, img, pad, y, cardW, cardH);
    else placeholder(ctx, pad, y, cardW, cardH);

    const scrim = ctx.createLinearGradient(0, y, 0, y + cardH);
    scrim.addColorStop(0, "rgba(0,0,0,0.05)");
    scrim.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = scrim;
    ctx.fillRect(pad, y, cardW, cardH);

    if (isWinner) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 8;
      ctx.strokeRect(pad + 4, y + 4, cardW - 8, cardH - 8);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    const size = fitText(ctx, name, cardW - 64, Math.round(cardW * 0.11));
    ctx.font = `${size}px ${DISPLAY_FONT}`;
    ctx.fillText(truncate(ctx, name, cardW - 64), pad + 32, y + cardH - 74);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `600 26px ${SANS_FONT}`;
    ctx.fillText(truncate(ctx, place, cardW - 64), pad + 32, y + cardH - 34);
  });

  // Central VS diamond
  const cx = width / 2;
  const cy = top + cardH + gap / 2;
  const r = 52;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = RED;
  ctx.fillRect(-r / 1.4, -r / 1.4, (r / 1.4) * 2, (r / 1.4) * 2);
  ctx.restore();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 30px ${SANS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(model.versus, cx, cy + 1);
  ctx.textBaseline = "alphabetic";

  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `${Math.round(width * 0.075)}px ${DISPLAY_FONT}`;
  ctx.fillText(truncate(ctx, model.question, width - pad * 2), pad, height - pad - 96);
  if (model.diner) {
    ctx.fillStyle = "rgba(30,25,23,0.55)";
    ctx.font = `600 24px ${SANS_FONT}`;
    ctx.fillText(truncate(ctx, model.diner, width - pad * 2), pad, height - pad - 56);
  }
  drawFooter(ctx, width, height, pad, model.tagline);
}

async function renderRanking(
  ctx: CanvasRenderingContext2D,
  model: RankingCardModel,
  width: number,
  height: number,
) {
  const pad = Math.round(width * 0.07);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = RED;
  ctx.font = `800 26px ${SANS_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(model.kicker, pad, pad + 40);

  const top = pad + 80;
  const cardW = width - pad * 2;
  const cardH = Math.round(height * 0.46);
  const img = await loadImage(model.photo);
  if (img) coverDraw(ctx, img, pad, top, cardW, cardH);
  else placeholder(ctx, pad, top, cardW, cardH);
  const scrim = ctx.createLinearGradient(0, top, 0, top + cardH);
  scrim.addColorStop(0, "rgba(0,0,0,0.05)");
  scrim.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = scrim;
  ctx.fillRect(pad, top, cardW, cardH);

  // Outlined gold rank numeral
  ctx.save();
  ctx.font = `${Math.round(cardH * 0.62)}px ${DISPLAY_FONT}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = GOLD;
  ctx.textAlign = "left";
  ctx.strokeText(String(model.rank), pad + 30, top + cardH - 34);
  ctx.restore();

  let y = top + cardH + 62;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(30,25,23,0.55)";
  ctx.font = `800 24px ${SANS_FONT}`;
  ctx.fillText(`${model.rankPrefix} #${model.rank}`, pad, y);
  y += 20;

  ctx.fillStyle = INK;
  const size = fitText(ctx, model.dishName, cardW, Math.round(width * 0.11));
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  y += size;
  ctx.fillText(truncate(ctx, model.dishName, cardW), pad, y);

  ctx.fillStyle = "rgba(30,25,23,0.65)";
  ctx.font = `600 28px ${SANS_FONT}`;
  y += 44;
  ctx.fillText(truncate(ctx, model.placeName, cardW), pad, y);
  if (model.pool) {
    y += 36;
    ctx.fillStyle = "rgba(30,25,23,0.45)";
    ctx.font = `700 24px ${SANS_FONT}`;
    ctx.fillText(truncate(ctx, model.pool, cardW), pad, y);
  }
  y += 40;
  ctx.fillStyle = RED;
  ctx.font = `800 24px ${SANS_FONT}`;
  ctx.fillText(`${model.comparisons} ${model.comparisonsLabel}`, pad, y);

  drawFooter(ctx, width, height, pad, model.tagline);
}

export async function renderShareCard(
  model: ComparisonCardModel | RankingCardModel,
  format: ShareFormat,
): Promise<Blob | null> {
  const { width, height } = SHARE_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      /* fonts are decorative */
    }
  }
  if (model.kind === "comparison") await renderComparison(ctx, model, width, height);
  else await renderRanking(ctx, model, width, height);
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    } catch {
      resolve(null);
    }
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
