// The page's first screen, before the app's code arrives (index.html): a bot bouncing and looking around. It's one of
// the owner's own, kept here each time the app has the list, or before then, one of a few random looks the build drew
// (vite.config.ts). Only drawBlob's markup is kept: numbers and names from its lists, never anything typed.
import { drawBlob, type Look } from "./blob-draw.ts";

const size = 72;
export const splashSvg = (look: Look, id: string) =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" class="blob" style="overflow:visible">${drawBlob(look, "bright", size, id)}</svg>`;

// Up to 8 of the owner's bots, for the next launch's first screen.
export function keepForSplash(bots: Look[]) {
  try {
    localStorage.setItem("fxbot-splash", JSON.stringify(bots.slice(0, 8).map((bot, i) => splashSvg(bot, `fxsplash${i}`))));
  } catch {}
}
