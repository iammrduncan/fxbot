// Draws packages/website/public/card.png, the 1200 by 630 image a link to fxbot.sh shows in chats and social posts:
// the home page's crowd, drawn by the site's own blob-draw.ts in Geist, then the headline. Run it after changing the
// headline or the crowd:
//   npm run card
// It needs Playwright's Chromium, as shoot.mjs does.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { drawBlob } from "../../packages/website/src/blob-draw.ts";
import { crowd } from "../../packages/website/src/crowd.ts";

const root = new URL("../../", import.meta.url).pathname;
const out = join(root, "packages/website/public/card.png");
const font = pathToFileURL(join(root, "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2")).href;

// A bot at `size` pixels. The busy one shows its turn's look, since a picture can't hop.
let drawn = 0;
const blob = ({ mood = "bright", size, busy, ...look }) => `<svg class="blob" viewBox="0 0 100 100" width="${size}" height="${size}">${drawBlob(look, busy ? "focus" : mood, size, `b${drawn++}`)}</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${font}") format("woff2"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; background: #fff; }
body { position: relative; padding: 60px 78px 0; font-family: Geist; color: oklch(0.145 0 0); -webkit-font-smoothing: antialiased; }
.blob { --blob-ink-hi: #3d3d3d; --blob-ink: #171717; --blob-ink-lo: #050505; flex: none; overflow: visible; }
.crowd { display: flex; align-items: flex-end; gap: 20px; height: 104px; }
h1 { margin-top: 40px; font-size: 76px; line-height: 1.04; font-weight: 600; letter-spacing: -0.035em; }
h1 span, p, .site { color: oklch(0.556 0 0); }
p { margin-top: 24px; font-size: 30px; letter-spacing: -0.01em; }
footer { position: absolute; left: 78px; right: 78px; bottom: 54px; display: flex; align-items: center; justify-content: space-between; }
.mark { display: flex; align-items: center; gap: 14px; font-size: 38px; font-weight: 600; letter-spacing: -0.03em; }
.site { font-size: 28px; }
</style></head><body>
<div class="crowd">${crowd.map((bot) => blob({ ...bot, size: Math.round(bot.size * 1.32) })).join("")}</div>
<h1>AI assistants that do real work.<br><span>Built your way.</span></h1>
<p>Any model. Any device. Free and open source.</p>
<footer><div class="mark">${blob({ shape: "circle", color: "black", size: 46 })}fxbot</div><div class="site">fxbot.sh</div></footer>
</body></html>`;

// From a file, so the page may load the font from node_modules.
const dir = mkdtempSync(join(tmpdir(), "fxbot-card-"));
try {
  writeFileSync(join(dir, "card.html"), html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(join(dir, "card.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`Wrote ${out}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
