// Screenshots of fxbot for the site, the docs, and the README, from a clean room: a throwaway database, a fresh fxbot
// from this checkout, a scripted model, and the made-up bots in world.mjs. Nothing comes from anyone's install.
//
//   npm ci --prefix scripts/screenshots
//   npx --prefix scripts/screenshots playwright-core install --with-deps chromium   # once per machine
//   npm run build && npm run shots                                                    # or: npm run shots -- hero page
//
// It needs podman or docker for the database. Each shot is written to packages/website/public/shots/ as
// <name>-<desktop|phone>-<light|dark>.png, unless it looks the same as the file already there, so a release that
// changes nothing on screen changes no image. Run it before a release (the prep-release skill does), look at each
// changed image, and commit them.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, openSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { bots, script } from "./world.mjs";

const root = new URL("../../", import.meta.url).pathname;
const out = join(root, "packages/website/public/shots");
const only = process.argv.slice(2);
const temp = mkdtempSync(join(tmpdir(), "fxbot-shots-"));
const cleanups = [];
const log = (...words) => console.log(...words);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((done) => { const s = createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => done(port)); }); });

async function main() {
  if (!existsSync(join(root, "packages/ui/dist/index.html"))) throw new Error("Build the page first: npm run build");
  mkdirSync(out, { recursive: true });
  const db = await database();
  const model = await scriptedModel();
  const key = join(temp, "secret.key");
  writeFileSync(key, randomBytes(32).toString("base64"), { mode: 0o400 });
  const browser = await chromium.launch();
  cleanups.push(() => browser.close());
  const shoot = shooter(browser);

  // First run, on an install with nothing in it.
  {
    const fx = await fxbot(db, "first", key, [], model.embed);
    await shoot("setup-choose", fx, "/", { devices: ["desktop", "phone"], height: 1000 });
    await fx.api("/api/settings", "PATCH", { onboardingStep: "provider" });
    await shoot("setup-provider", fx, "/");
    await fx.api("/api/providers", "POST", { kind: "ollama", name: "Ollama on this machine", baseUrl: model.url, model: "llama3.2" });
    await fx.api("/api/settings", "PATCH", { onboardingStep: "bot" });
    await shoot("setup-bot", fx, "/", { devices: ["desktop", "phone"] });
    await fx.stop();
  }

  // Everything else, on an install with fxbot's plugins and the demo bots. The computer needs a container engine set
  // up for it, so it isn't here.
  const plugins = ["pages", "chat-rooms", "messages", "permissions", "routines", "dreams", "subagents", "mermaid"].map((name) => join(root, "plugins", name));
  const fx = await fxbot(db, "world", key, plugins, model.embed);
  const w = await world(fx, model);
  // A page shows when it was saved: one fixed time, so a shot looks the same on every run.
  db.sql("shots_world", "update plugin_pages.versions set at = '2026-11-08 19:45:00 America/New_York'");
  const at = (bot) => `/profiles/${w[bot].id}`;
  await shoot("hero", fx, at("Juniper"), { devices: ["desktop", "phone"], scale: 2 });
  await shoot("look", fx, at("Juniper"), { devices: ["desktop", "phone"], scale: 2, async then(pg) {
    // On a phone, New bot is in the sidebar.
    if (!(await pg.getByRole("button", { name: "New bot" }).isVisible())) await pg.locator('[data-sidebar="trigger"]').first().click();
    await pg.getByRole("button", { name: "New bot" }).click();
    const dialog = pg.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill("Maple");
    await dialog.getByRole("button", { name: "Bunny" }).click();
    await dialog.getByRole("tab", { name: "Color" }).click();
    await dialog.getByRole("button", { name: "Green" }).click();
    await dialog.getByRole("tab", { name: "Head" }).click();
    await dialog.getByRole("button", { name: "Beanie" }).click();
    await dialog.getByRole("tab", { name: "Shape" }).click();
  } });
  await shoot("page", fx, `/pages/${w.lisbon}`, { devices: ["desktop", "phone"], scale: 2 });
  await shoot("room", fx, `/chat-rooms/rooms/${w.room}`, { devices: ["desktop", "phone"], scale: 2 });
  await shoot("plugins", fx, "/plugins", { devices: ["desktop", "phone"], scale: 2, async then(pg) {
    await pg.getByRole("tab", { name: "Browse" }).click();
    await pg.evaluate(() => document.activeElement?.blur());
  } });
  await shoot("chart", fx, `/pages/${w.chart}`, { main: true });
  await shoot("together", fx, at("Sprout"), { scale: 2 });
  await shoot("approval", fx, at("Rook"), { scale: 2 });
  await shoot("routine", fx, at("Pixel"), { main: true });
  await shoot("menu", fx, at("Juniper"), { async then(pg) {
    await pg.locator(`[data-reorder="${w.Ledger.id}"] a`).first().click({ button: "right" });
  } });
  await shoot("fresh", fx, at("Atlas"), { main: true, async then(pg) {
    // With the messages plugin, the message box is its own editor rather than a textarea.
    const box = pg.locator('[contenteditable="true"], textarea').last();
    await box.click();
    await pg.keyboard.type("/fre");
  } });
  await shoot("providers", fx, "/settings/providers", { async then(pg) {
    await pg.getByRole("button", { name: "Add provider" }).click();
    await pg.getByRole("dialog").getByRole("region", { name: "Sign in" }).waitFor();
  } });
  await shoot("memory", fx, "/settings/memory", { main: true, height: 440 });
  // Atlas's subagents at work, and a diagram from Pixel. Shot last, so the scenes above stay as they were. Subagents
  // get scientists' names at random, so theirs are set here, for a shot that's the same on every run.
  await w.say("Atlas", "Compare the three hosting offers for our little database, and what each says about backups.");
  db.sql("shots_world", "update plugin_subagents.subagents set name = (array['Curie', 'Hopper', 'Turing'])[id] where id <= 3");
  await shoot("subagents", fx, at("Atlas"), { scale: 2, async then(pg) {
    // The panel, which lists them.
    const panel = pg.getByRole("button", { name: "Bot panel" });
    if ((await panel.getAttribute("aria-expanded")) !== "true") await panel.click();
  } });
  await w.say("Pixel", "Draw how an order gets from our shop to the customer.");
  await shoot("diagram", fx, at("Pixel"), { scale: 2 });
  await fx.stop();
}

// A disposable Postgres with pgvector, the image the release's compose file names, on a tmpfs.
async function database() {
  const engine = ["podman", "docker"].find((name) => spawnSync(name, ["--version"]).status === 0);
  if (!engine) throw new Error("It needs podman or docker for its database.");
  const image = /image: (docker\.io\/pgvector\/pgvector:\S+)/.exec(readFileSync(join(root, "deploy/compose.yaml"), "utf8"))[1];
  const port = await freePort();
  const name = `fxbot-shots-${process.pid}`;
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(engine, ["run", "-d", "--rm", "--name", name, "-p", `127.0.0.1:${port}:5432`, "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_USER=fxbot", "-e", `POSTGRES_PASSWORD=${password}`, "-e", "POSTGRES_DB=fxbot", image], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`The database didn't start: ${run.stderr}`);
  cleanups.push(() => spawnSync(engine, ["rm", "-f", name]));
  for (let i = 0; i < 120; i++) {
    if (spawnSync(engine, ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "fxbot", "-d", "fxbot"]).status === 0) break;
    await sleep(500);
  }
  await sleep(1500);
  const psql = (db, query) => spawnSync(engine, ["exec", name, "psql", "-U", "fxbot", "-d", db, "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" });
  return {
    url: (db) => (psql("fxbot", `create database ${db}`), `postgres://fxbot:${password}@127.0.0.1:${port}/${db}`),
    sql(db, query) {
      const run = psql(db, query);
      if (run.status !== 0) throw new Error(`The database refused: ${run.stderr}`);
    },
  };
}

// fxbot from this checkout, with nothing from the environment but what's set here: no .env, no update check, and
// fxbot's own lists as they shipped, so every run shows the same thing.
async function fxbot(db, name, key, plugins, embed) {
  const port = await freePort();
  const data = join(temp, name);
  mkdirSync(join(data, "backups"), { recursive: true });
  const nowhere = "http://127.0.0.1:9";
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    FXBOT_DATABASE_URL: db.url(`shots_${name}`), FXBOT_SECRET_KEY_FILE: key, FXBOT_DATA: data, FXBOT_BACKUPS: join(data, "backups"),
    FXBOT_PORT: String(port), FXBOT_HOST: "127.0.0.1", FXBOT_UPDATE_CHECK: "off", FXBOT_PLUGIN_DIRS: plugins.join(":"),
    FXBOT_EMBED_URL: embed, FXBOT_LISTS_URL: nowhere, FXBOT_MCP_REGISTRY: nowhere, FXBOT_MCP_EVERYTHING: nowhere,
  };
  const output = openSync(join(temp, `${name}.log`), "w");
  const child = spawn(process.execPath, ["packages/server/src/index.ts"], { cwd: root, env, stdio: ["ignore", output, output] });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill();
    for (let i = 0; i < 40 && child.exitCode === null; i++) await sleep(250);
    if (child.exitCode === null) child.kill("SIGKILL");
  };
  cleanups.push(stop);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    if (await fetch(base + "/api/health").then((r) => r.ok, () => false)) break;
    if (i > 120 || child.exitCode !== null) throw new Error(`fxbot didn't start. Its log: ${join(temp, `${name}.log`)}`);
    await sleep(500);
  }
  async function api(path, method = "GET", body) {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const answer = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(answer)}`);
    return answer;
  }
  return { base, api, stop };
}

// An OpenAI-style model that answers from world.mjs's script: the newest message to a bot that holds one of its
// entries' words picks the entry, and the tool calls made since pick its step.
async function scriptedModel() {
  const names = bots.map((b) => b.name);
  const text = (m) => (typeof m.content === "string" ? m.content : (m.content ?? []).map((p) => p.text ?? "").join(""));
  const held = [];
  cleanups.push(() => held.forEach((res) => res.destroy()));
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (status, json) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(json));
    const path = req.url.split("?")[0];
    if (path === "/api/show") return send(200, { capabilities: ["completion", "tools", "vision"], model_info: {} });
    if (path === "/api/tags") return send(200, { models: [{ name: "llama3.2", model: "llama3.2" }] });
    if (path === "/v1/models") return send(200, { object: "list", data: [{ id: "llama3.2", object: "model" }] });
    // It's the machine's local embedder too, with made-up vectors, so memory search looks as it does on an install.
    if (path === "/embed/v1/models") return send(200, { object: "list", data: [{ id: "embeddinggemma", object: "model" }] });
    if (path === "/embed/v1/embeddings") {
      const input = [JSON.parse(body).input].flat();
      return send(200, { object: "list", model: "embeddinggemma", data: input.map((words, index) => ({ object: "embedding", index, embedding: vector(String(words)) })) });
    }
    if (!path.endsWith("/chat/completions")) return send(404, { error: { message: "not found" } });
    const json = JSON.parse(body);
    const system = json.messages.filter((m) => m.role === "system").map(text).join("\n");
    let reply = "Okay.", call = null;
    if (system.includes("You check one action")) reply = '{"decision":"allow","reason":"The owner asked for this."}';
    else {
      const me = names.find((n) => new RegExp(`You are ${n}\\b`).test(system));
      const mine = script.filter((s) => s.bot === me);
      let at = -1, entry = null;
      json.messages.forEach((m, i) => {
        if (m.role !== "user") return;
        const found = mine.find((s) => text(m).includes(s.when));
        if (found) (at = i), (entry = found);
      });
      if (entry) {
        const made = json.messages.slice(at + 1).filter((m) => m.role === "assistant" && m.tool_calls?.length).length;
        const step = entry.steps[made];
        if (step?.tool) call = { id: "call_" + randomBytes(4).toString("hex"), type: "function", function: { name: step.tool, arguments: JSON.stringify(step.input) } };
        // A step that holds never answers, so its turn stays at work, as a subagent's does in its shot.
        else if (step?.hold) return void held.push(res);
        else reply = step?.say ?? "Done.";
      }
    }
    const id = "chatcmpl-" + randomBytes(4).toString("hex");
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: json.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    if (!json.stream) return send(200, { id, object: "chat.completion", model: json.model, choices: [{ index: 0, message: call ? { role: "assistant", content: null, tool_calls: [call] } : { role: "assistant", content: reply }, finish_reason: call ? "tool_calls" : "stop" }] });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(chunk({ role: "assistant", content: "" }));
    if (call) res.write(chunk({ tool_calls: [{ index: 0, ...call }] }) + chunk({}, "tool_calls"));
    else res.write(chunk({ content: reply }) + chunk({}, "stop"));
    res.end("data: [DONE]\n\n");
  });
  const port = await new Promise((done) => server.listen(0, "127.0.0.1", () => done(server.address().port)));
  cleanups.push(() => server.close());
  return { url: `http://127.0.0.1:${port}/v1`, embed: `http://127.0.0.1:${port}/embed/v1` };
}

// 768 numbers that stay the same for the same words.
function vector(words) {
  let seed = [...words].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const next = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0), seed / 4294967296 - 0.5);
  const v = Array.from({ length: 768 }, next);
  const length = Math.hypot(...v);
  return v.map((x) => x / length);
}

// The demo bots, their chats, a room, and the pages they write, through fxbot's own API, the way the app would.
async function world(fx, model) {
  await fx.api("/api/settings", "PATCH", { onboarded: true, timeZone: "America/New_York" });
  const provider = await fx.api("/api/providers", "POST", { kind: "ollama", name: "Ollama on this machine", baseUrl: model.url, model: "llama3.2" });
  const w = {};
  for (const { name, about, pinned, ...look } of bots) {
    w[name] = await fx.api("/api/profiles", "POST", { name, provider: provider.id, model: "llama3.2", instructions: `You are ${name}. You help with ${about}.`, ...look });
  }
  for (const { name, pinned } of bots) if (pinned) await fx.api(`/api/profiles/${w[name].id}`, "PATCH", { pinned: true });
  await fx.api("/api/profiles/order", "PUT", { ids: bots.filter((b) => b.pinned).map((b) => w[b.name].id) });
  await fx.api("/api/profiles/order", "PUT", { ids: bots.filter((b) => !b.pinned).map((b) => w[b.name].id) });
  await fx.api("/api/settings", "PATCH", { defaultProfile: w.Juniper.id });
  const plugin = async (name) => (await fx.api("/api/plugins")).find((p) => p.name === name);
  await fx.api(`/api/plugins/${(await plugin("permissions")).id}/settings`, "PUT", { mode: "yolo" });
  await fx.api(`/api/plugins/permissions/bots/${w.Rook.id}`, "PUT", { mode: "ask" });

  // Says something to a bot, and waits until every bot is still: one message can wake several.
  const idle = async () => {
    for (let quiet = 0, i = 0; quiet < 6 && i < 300; i++) {
      const busy = (await fx.api("/api/profiles")).some((b) => b.busy && !b.waiting);
      quiet = busy ? 0 : quiet + 1;
      await sleep(250);
    }
  };
  const say = async (bot, text) => {
    await fx.api(`/api/profiles/${w[bot].id}/messages`, "POST", { text, messageId: "m" + randomBytes(6).toString("hex") });
    await sleep(600);
    await idle();
  };
  await say("Atlas", "What's a good book on the history of maps?");
  await say("Ledger", "Make me a chart of this month's spending, by category.");
  await say("Pixel", "Every Monday at 9, send me three design articles worth reading.");
  await say("Sprout", "When is it safe to plant the tomatoes outside? Ask Atlas about our frost dates.");
  await say("Juniper", "What's on this week?");
  await say("Juniper", "Can you plan a slow weekend in Lisbon for two? We love food and walking.");
  await say("Rook", "Remind me to water the plants every morning at 8.");
  const room = await fx.api("/api/plugins/chat-rooms/rooms", "POST", { name: "Garden party", bots: [w.Pixel.id, w.Sprout.id, w.Juniper.id] });
  await fx.api(`/api/plugins/chat-rooms/rooms/${room.id}/messages`, "POST", { text: `<@bot:${w.Pixel.id}> <@bot:${w.Sprout.id}> We're having a garden party on Saturday. Any ideas for the table and the plants?` });
  await sleep(600);
  await idle();
  const items = (await fx.api("/api/library")).items;
  w.lisbon = items.find((i) => i.name.startsWith("A slow weekend"))?.id;
  w.chart = items.find((i) => i.name.startsWith("Spending this month"))?.id;
  w.room = room.id;
  w.say = say;
  if (!w.lisbon || !w.chart) throw new Error(`The pages weren't written: ${items.map((i) => i.name).join(", ")}`);
  return w;
}

// Takes one shot on each device and theme it asks for, and writes each that changed.
function shooter(browser) {
  const devices = {
    desktop: { viewport: { width: 1280, height: 800 } },
    phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  };
  const counts = { written: 0, same: 0 };
  cleanups.push(() => log(`${counts.written} written, ${counts.same} unchanged, in ${out}`));
  return async function shoot(name, fx, path, { devices: which = ["desktop"], themes = ["light", "dark"], height, scale, main, then } = {}) {
    if (only.length && !only.includes(name)) return;
    for (const device of which) {
      for (const theme of themes) {
        const size = devices[device].viewport;
        const context = await browser.newContext({ ...devices[device], viewport: { ...size, height: device === "desktop" && height ? height : size.height }, deviceScaleFactor: device === "phone" ? 2 : (scale ?? 1), colorScheme: theme, reducedMotion: "reduce", locale: "en-US", timezoneId: "America/New_York", serviceWorkers: "block" });
        const pg = await context.newPage();
        const errors = [];
        pg.on("pageerror", (e) => errors.push(e.message));
        await pg.goto(fx.base + path);
        await pg.evaluate(() => document.fonts.ready);
        await pg.waitForTimeout(1500);
        if (then) (await then(pg), await pg.waitForTimeout(800));
        // No caret, no scrollbar, and no hover left by a click.
        await pg.addStyleTag({ content: "*{caret-color:transparent!important}::-webkit-scrollbar{display:none}" });
        await pg.mouse.move(0, 0);
        await pg.waitForTimeout(300);
        // `main` leaves out the app's sidebar, so a guide's column shows the part it's about larger.
        const shot = await pg.screenshot(main ? { clip: await pg.locator("main").last().boundingBox() } : {});
        if (errors.length) log(`  ${name}: page errors: ${errors.join(" | ")}`);
        const file = join(out, `${name}-${device}-${theme}.png`);
        const diff = existsSync(file) ? await differs(pg, readFileSync(file), shot) : null;
        const changed = !diff || diff.share > 0.002 || diff.strong > 100;
        if (changed) writeFileSync(file, shot);
        counts[changed ? "written" : "same"]++;
        log(`${changed ? "wrote" : "same "} ${name}-${device}-${theme}`);
        await context.close();
      }
    }
  };
}

// The share of pixels that differ between two PNGs, compared in the page, so the tool needs nothing to read a PNG.
async function differs(pg, before, after) {
  return pg.evaluate(async ([a, b]) => {
    const load = (data) => new Promise((done, fail) => { const img = new Image(); img.onload = () => done(img); img.onerror = fail; img.src = "data:image/png;base64," + data; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { share: 1, strong: Infinity };
    const pixels = (img) => { const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const p = pixels(x), q = pixels(y);
    // A share of pixels a little changed, or a few changed a lot, such as one small icon in another color.
    let different = 0, strong = 0;
    for (let i = 0; i < p.length; i += 4) {
      const delta = Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
      if (delta > 24) different++;
      if (delta > 150) strong++;
    }
    return { share: different / (p.length / 4), strong };
  }, [before.toString("base64"), Buffer.from(after).toString("base64")]);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const clean of cleanups.reverse()) await Promise.resolve(clean()).catch(() => {});
  // A failed run keeps fxbot's logs to read.
  if (process.exitCode) console.error(`fxbot's logs are in ${temp}`);
  else rmSync(temp, { recursive: true, force: true });
}
