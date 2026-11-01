import { createFxbot } from "@fxbot/sdk";
import { readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

// Loopback only. Other devices reach it through `tailscale serve`; the page never holds a secret.
// FXBOT_PORT lets a check run beside a running server.
const port = Number(process.env.FXBOT_PORT ?? 8787);
const host = "127.0.0.1";
const { FXBOT_DATABASE_URL: databaseUrl, FXBOT_SECRET_KEY_FILE: keyFile } = process.env;
if (!databaseUrl) throw new Error("FXBOT_DATABASE_URL is required: fxbot keeps its records in Postgres (see the README)");
if (!keyFile) throw new Error("FXBOT_SECRET_KEY_FILE is required: a file outside the repo with 32 random bytes in base64 (see the README)");

const fxbot = await createFxbot({
  databaseUrl,
  secretKey: readFileSync(keyFile, "utf8"),
  baseUrl: process.env.FXBOT_BASE_URL || undefined,
  apiKey: process.env.FXBOT_API_KEY || undefined,
  vercelClientId: process.env.FXBOT_VERCEL_CLIENT_ID || undefined,
  dataDir: process.env.FXBOT_DATA,
});

// The ui package's build, served beside the API.
const dist = join(import.meta.dirname, "..", "..", "ui", "dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const fail = (status: number, message: string): never => {
  throw Object.assign(new Error(message), { status });
};
const json = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

// A JSON object, unchecked past that: the SDK checks each field it reads.
async function body<T>(req: IncomingMessage, limit = 1 << 20): Promise<T> {
  const over = `body is over ${limit >> 20} MiB`;
  if (Number(req.headers["content-length"]) > limit) fail(413, over);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413, over);
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {}
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  return fail(400, "body must be a JSON object");
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  const [, , resource, id, action, extra] = url.pathname.split("/");
  const method = req.method;
  const ok = { ok: true };
  if (resource === "health" && !id && method === "GET") return json(res, 200, ok);
  if (resource === "settings" && !id) {
    if (method === "GET") return json(res, 200, await fxbot.settings.get());
    if (method === "PATCH") return json(res, 200, await fxbot.settings.update(await body(req)));
    return fail(405, "method not allowed");
  }
  if (resource === "providers" && extra === undefined) {
    if (!id && method === "GET") return json(res, 200, await fxbot.providers.list());
    if (!id && method === "POST") return json(res, 201, await fxbot.providers.add(await body(req)));
    if (id && !action && method === "PATCH") return json(res, 200, await fxbot.providers.update(id, await body(req)));
    if (id && !action && method === "DELETE") return json(res, 200, (await fxbot.providers.remove(id), ok));
    if (id && action === "models" && method === "GET") return json(res, 200, await fxbot.providers.models(id));
    if (id && action === "teams" && method === "GET") return json(res, 200, await fxbot.providers.teams(id));
    return fail(404, "not found");
  }
  if (resource === "sign-ins" && !action) {
    if (!id && method === "POST") return json(res, 201, await fxbot.signIns.start(await body(req)));
    if (id && method === "GET") return json(res, 200, fxbot.signIns.get(id));
    if (id && method === "DELETE") return json(res, 200, (fxbot.signIns.cancel(id), ok));
    return fail(404, "not found");
  }
  if (resource === "profiles" && action === "uploads" && method === "GET") {
    const { data, type } = await fxbot.image(id, extra ?? "");
    return res.writeHead(200, { "content-type": type, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" }).end(data);
  }
  if (resource !== "profiles" || extra !== undefined) return fail(404, "not found");

  if (!id) {
    if (method === "GET") return json(res, 200, await fxbot.profiles.list());
    if (method === "POST") return json(res, 201, await fxbot.profiles.create(await body(req)));
    return fail(405, "method not allowed");
  }
  const profile = await fxbot.profiles.get(id);

  if (!action) {
    if (method === "GET") return json(res, 200, profile);
    if (method === "PATCH") return json(res, 200, await fxbot.profiles.update(id, await body(req)));
    if (method === "DELETE") return json(res, 200, (await fxbot.profiles.remove(id), ok));
  } else if (action === "messages" && method === "POST") {
    // libfx takes at most 6 MiB of images in a message, so with base64 a message stays under 12 MiB.
    return json(res, 200, await fxbot.send(id, await body(req, 12 << 20)));
  } else if (action === "stream" && method === "GET") {
    const lines = await fxbot.stream(id, Number(url.searchParams.get("cursor") ?? 0));
    res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" }).flushHeaders();
    // Replays from the cursor, then stays open. A closed response cancels the stream.
    return pipeline(Readable.fromWeb(lines as ReadableStream<Uint8Array>), res).catch(() => {});
  }
  return fail(action ? 404 : 405, action ? "not found" : "method not allowed");
}

// The built page. Paths that are not files get index.html, so the app's routes load.
function page(res: ServerResponse, pathname: string) {
  let file = normalize(join(dist, pathname));
  if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile()) file = join(dist, "index.html");
  try {
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(data);
  } catch {
    json(res, 404, { error: "no build in packages/ui/dist/; run npm run build" });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) await api(req, res, url);
    else page(res, url.pathname);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error(error);
    if (!res.headersSent) json(res, status, { error: error instanceof Error ? error.message : String(error) });
    else res.destroy();
  }
});

server.listen(port, host, () => console.log(`fxbot server on http://${host}:${port}`));

// Stop taking requests, then let libfx finish the turns this process started.
async function shutdown() {
  server.close();
  server.closeAllConnections();
  await fxbot.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
