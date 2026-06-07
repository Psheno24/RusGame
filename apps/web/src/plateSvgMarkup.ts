import type { VehiclePlateParts } from "./vehiclePlate";
import { displayPlateParts } from "./vehiclePlate";

/** SVG разметка ГОСТ-номера 520×112 — единый источник для UI и 3D-текстуры. */
export function buildPlateSvgMarkup(parts: VehiclePlateParts): string {
  const show = displayPlateParts(parts);
  const mainText = `${show.l1}${show.digits}${show.l2}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 112" width="520" height="112" class="gost-plate__svg" aria-hidden="true">
  <rect class="gost-plate__rim" x="0" y="0" width="520" height="112" rx="8" />
  <rect class="gost-plate__surface" x="4" y="4" width="512" height="104" rx="4" />
  <line class="gost-plate__divider" x1="407" y1="4" x2="407" y2="108" />
  <text class="gost-plate__main-text" x="22" y="86" textLength="360" lengthAdjust="spacingAndGlyphs">${mainText}</text>
  <text class="gost-plate__region" x="462" y="61" text-anchor="middle">${show.region}</text>
  <text class="gost-plate__rus" x="423" y="96">RUS</text>
  <g class="gost-plate__flag" transform="translate(473 77)">
    <rect class="gost-plate__flag-border" x="0" y="0" width="34" height="20" rx="1" />
    <rect class="gost-plate__flag-white" x="1" y="1" width="32" height="6" />
    <rect class="gost-plate__flag-blue" x="1" y="7" width="32" height="6" />
    <rect class="gost-plate__flag-red" x="1" y="13" width="32" height="6" />
  </g>
</svg>`;
}

export const PLATE_SVG_WIDTH = 520;
export const PLATE_SVG_HEIGHT = 112;

const PLATE_FONT = '"GostPlate", "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif';

/** Canvas-отрисовка с теми же координатами, что и SVG (для 3D-текстуры с GostPlate). */
export function drawPlateToCanvas(
  ctx: CanvasRenderingContext2D,
  parts: VehiclePlateParts,
  scale = 1,
): void {
  const w = PLATE_SVG_WIDTH * scale;
  const h = PLATE_SVG_HEIGHT * scale;
  const show = displayPlateParts(parts);
  const mainText = `${show.l1}${show.digits}${show.l2}`;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#000";
  ctx.beginPath();
  roundRect(ctx, 0, 0, w, h, 8 * scale);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  roundRect(ctx, 4 * scale, 4 * scale, 512 * scale, 104 * scale, 4 * scale);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(407 * scale, 4 * scale);
  ctx.lineTo(407 * scale, 108 * scale);
  ctx.stroke();

  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  ctx.font = `700 ${72 * scale}px ${PLATE_FONT}`;
  drawStretchedText(ctx, mainText, 22 * scale, 86 * scale, 360 * scale);

  ctx.font = `700 ${48 * scale}px ${PLATE_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(show.region, 462 * scale, 61 * scale);

  ctx.font = `700 ${22 * scale}px ${PLATE_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("RUS", 423 * scale, 96 * scale);

  const fx = 473 * scale;
  const fy = 77 * scale;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1 * scale;
  roundRect(ctx, fx, fy, 34 * scale, 20 * scale, 1 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(fx + scale, fy + scale, 32 * scale, 6 * scale);
  ctx.fillStyle = "#0039a6";
  ctx.fillRect(fx + scale, fy + 7 * scale, 32 * scale, 6 * scale);
  ctx.fillStyle = "#d52b1e";
  ctx.fillRect(fx + scale, fy + 13 * scale, 32 * scale, 6 * scale);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStretchedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  targetWidth: number,
): void {
  const natural = ctx.measureText(text).width;
  if (natural <= 0) {
    ctx.fillText(text, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(targetWidth / natural, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
