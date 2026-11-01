import { createFxAgent, type FxSessionPromptInput, type FxTurn } from "libfx";
import { local } from "libfx/durable-local";
import { join } from "node:path";
import { createStore, isId } from "./store.ts";
import type { Fields, Message, Profile, Settings, StreamLine, Upload } from "./types.ts";

export type * from "./types.ts";

export type FxbotOptions = {
  /** An OpenAI-compatible API, including its `/v1` prefix: HTTPS, or HTTP on localhost. */
  baseUrl: string;
  /** Sent as the provider's key. Leave it out for a server that needs none. */
  apiKey?: string;
  /** Profiles, settings, uploads, and libfx's sessions. Default `data`. */
  dataDir?: string;
};

// Bad input fails with `status` 400 and a missing bot with 404, so a server can answer with the same status.
const fail = (status: 400 | 404, message: string): never => {
  throw Object.assign(new Error(message), { status });
};

// The image types libfx takes, by the extension each is saved under.
const imageTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const extension = (type: string) => Object.keys(imageTypes).find((ext) => imageTypes[ext] === type);

const utf8 = (bytes: Buffer) => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
};

// Create needs only a name; the rest start empty. An empty model follows the default in settings.
// Update takes any of the three. Other keys are ignored.
function fields(input: Partial<Fields>, create: boolean): Partial<Fields> {
  const out: Partial<Fields> = create ? { instructions: "", model: "" } : {};
  for (const key of ["name", "instructions", "model"] as const) {
    const value: unknown = input[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return fail(400, `${key} must be a string`);
    out[key] = key === "instructions" ? value : value.trim();
    if (key !== "instructions" && out[key]!.length > 200) fail(400, `${key} is over 200 characters`);
  }
  if ((create || out.name !== undefined) && !out.name) fail(400, "name is required");
  if (Buffer.byteLength(out.instructions ?? "") > 64 * 1024) fail(400, "instructions are over 64 KiB");
  return out;
}

// One libfx agent over a data directory: bots, their settings, and a durable chat with each. Turns a stopped
// process left open run again at once.
export function createFxbot({ baseUrl, apiKey, dataDir = "data" }: FxbotOptions) {
  const store = createStore(dataDir);
  // libfx refuses images for a model its provider does not list as taking them, and the models are the bots' own.
  // libfx 0.0.16 reads this list when a turn opens its engine (checked by hand; the docs do not say so), so `open`
  // lists each model first. A model that cannot see images then fails at the provider instead.
  const provider = { name: "openai", baseUrl, models: {} as Record<string, { supportsVision: boolean }> };
  const options = {
    // Sessions run only on an agent with the name that created them. Never rename it.
    name: "fxbot",
    provider,
    durability: local({ dir: join(dataDir, "sessions") }),
  };
  const agent = createFxAgent(apiKey ? { ...options, credentials: async () => ({ apiKey }) } : options);

  // The bot's own model, or the default from settings; empty when neither is set.
  const modelFor = (profile: Profile) => profile.model || store.getSettings().defaultModel;

  // libfx keeps no model or instructions for a session, so every open passes them.
  function open(profile: Profile, sessionId: string) {
    const model = modelFor(profile) || undefined;
    if (model) provider.models[model] ??= { supportsVision: true };
    return agent.session(sessionId, { model, instructions: profile.instructions });
  }

  function get(id: string) {
    if (!isId(id)) fail(400, "profile id must be 12 hex characters");
    return store.get(id) ?? fail(404, "profile not found");
  }

  // A message's files as libfx prompt blocks: images as images, and each text file as text under its name, the way
  // libfx hands the model a resource. libfx counts a prompt of resources alone as empty. Anything else is refused.
  // The record is saved first, so the stream finds it when the turn starts.
  function attach(id: string, text: string, messageId: string, files: Upload[]): FxSessionPromptInput {
    const blocks: Exclude<FxSessionPromptInput, string>[number][] = text.trim() ? [{ type: "text", text }] : [];
    const sent: Upload[] = [];
    for (const { name, type, data } of files) {
      if (typeof name !== "string" || typeof type !== "string" || typeof data !== "string" || name.length > 255)
        return fail(400, "each file needs a name of at most 255 characters, a type, and base64 data");
      const ext = extension(type);
      if (ext) {
        blocks.push({ type: "image", mimeType: type, data });
        sent.push({ name, type, url: `/api/profiles/${id}/uploads/${store.saveImage(id, Buffer.from(data, "base64"), ext)}` });
      } else {
        const content = utf8(Buffer.from(data, "base64")) ?? fail(400, `${name} is not an image or a text file`);
        blocks.push({ type: "text", text: `File: ${name}\n${content}` });
        sent.push({ name, type });
      }
    }
    store.saveSent(id, messageId, { input: text, files: sent });
    return blocks;
  }

  // Reading a turn's events waits for its end; a repeated messageId yields no text and saves nothing.
  async function keepPreview(id: string, turn: FxTurn) {
    let reply = "";
    try {
      for await (const event of turn) if (event.type === "text_delta") reply += event.delta;
    } catch {
      return;
    }
    const current = store.get(id);
    if (current && reply.trim()) store.save({ ...current, preview: reply.trim().replace(/\s+/g, " ").slice(0, 160) });
  }

  // libfx's turn_start carries a prompt only when it was plain text, so the saved one goes back in.
  function withSent(id: string) {
    let rest = "";
    return new TransformStream<string, string>({
      transform(chunk, out) {
        const parts = (rest + chunk).split("\n");
        rest = parts.pop()!;
        for (const part of parts) {
          const line: StreamLine | null = part.includes('"turn_start"') ? JSON.parse(part) : null;
          const sent = line?.type === "turn_start" && line.input === undefined && store.getSent(id, line.messageId!);
          out.enqueue((sent ? JSON.stringify({ ...line, ...sent }) : part) + "\n");
        }
      },
      flush: (out) => (rest ? out.enqueue(rest) : undefined),
    });
  }

  // A turn left open by a process that died waits for the session's next prompt unless resumed.
  for (const profile of store.list()) if (profile.sessionId) open(profile, profile.sessionId).resume();

  return {
    profiles: {
      list: store.list,
      get,
      create: (input: Partial<Fields>) => store.create(fields(input, true) as Fields),
      update: (id: string, input: Partial<Fields>) => store.save({ ...get(id), ...fields(input, false) }),
      remove(id: string) {
        get(id);
        store.remove(id);
      },
    },

    settings: {
      get: store.getSettings,
      update({ defaultModel }: Settings) {
        if (typeof defaultModel !== "string" || defaultModel.trim().length > 200)
          fail(400, "defaultModel must be a string of at most 200 characters");
        return store.saveSettings({ defaultModel: defaultModel.trim() });
      },
    },

    // Resolves once libfx has stored the prompt; the reply arrives on the stream. libfx takes at most 8 images,
    // 3.75 MiB each and 6 MiB together.
    async send(id: string, { text, messageId, files = [] }: Message) {
      let profile = get(id);
      if (!Array.isArray(files) || files.length > 8) fail(400, "files must be a list of at most 8");
      if (typeof text !== "string" || (!text.trim() && !files.length)) fail(400, "text is required");
      if (typeof messageId !== "string" || !/^[\w.-]{1,128}$/.test(messageId))
        fail(400, "messageId must be 1 to 128 letters, digits, '.', '_', or '-'");
      if (!modelFor(profile)) fail(400, "No model. Set a default model in Settings, or give this bot one.");
      const input = files.length ? attach(id, text, messageId, files) : text;
      if (!profile.sessionId) {
        const fresh = await agent.newSessionId();
        // Saved before the prompt, so a restart still finds the session. A concurrent first send keeps the id already saved.
        profile = store.get(id) ?? fail(404, "profile not found");
        if (!profile.sessionId) profile = store.save({ ...profile, sessionId: fresh });
      }
      try {
        // A messageId the session already accepted runs nothing new and resolves to the same ids.
        const turn = open(profile, profile.sessionId!).prompt(input, { messageId });
        const accepted = await turn.accepted;
        void keepPreview(id, turn);
        return accepted;
      } catch (error) {
        // libfx throws a TypeError or RangeError for a prompt it refuses, such as an image whose bytes are not its type.
        throw error instanceof TypeError || error instanceof RangeError ? Object.assign(error, { status: 400 }) : error;
      }
    },

    // Every line of the bot's chat from `cursor` on as NDJSON, staying open for new ones. Cancel it to stop.
    // A bot with no session yet has nothing to replay, so its stream ends at once.
    stream(id: string, cursor = 0): ReadableStream<Uint8Array> {
      const profile = get(id);
      if (!Number.isInteger(cursor) || cursor < 0) fail(400, "cursor must be a whole number");
      if (!profile.sessionId) return new ReadableStream({ start: (controller) => controller.close() });
      return open(profile, profile.sessionId)
        .stream(cursor)
        .pipeThrough(new TextDecoderStream() as TransformStream<Uint8Array, string>)
        .pipeThrough(withSent(id))
        .pipeThrough(new TextEncoderStream());
    },

    // An image a message sent, by the name in its URL.
    image(id: string, name: string) {
      const ext = /^[0-9a-f]{64}\.(png|jpg|gif|webp)$/.exec(name)?.[1];
      const data = (isId(id) && ext && store.readImage(id, name)) || fail(404, "not found");
      return { data, type: imageTypes[ext!] };
    },

    // Waits for the turns this process started.
    close: () => agent.close(),
  };
}

export type Fxbot = ReturnType<typeof createFxbot>;
