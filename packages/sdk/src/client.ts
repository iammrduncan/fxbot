import type { Fields, Kind, LibraryItem, LibraryPage, LibraryQuery, Message, Model, NewProvider, Profile, ProfileUpdate, Provider, ProviderUpdate, Settings, SignIn, SignInStatus, StreamLine, Team, Upload } from "./types.ts";

export type * from "./types.ts";
export { colors, itemKinds, kinds, maxPinned, shapes } from "./types.ts";

export const unreachable = "Cannot reach the server.";

export type ClientOptions = {
  /** The server's origin. Default: the page's own. */
  baseUrl?: string;
};

export type StreamOptions = {
  /** Where to start: 0 replays the whole chat. */
  cursor?: number;
  /** Stops the stream. */
  signal?: AbortSignal;
  /** Hears the connection drop and come back. */
  onConnection?: (connected: boolean) => void;
};

// A typed client for an fxbot server's /api routes, for a page or a script. It carries no credentials: secrets stay
// with the server, which calls the SDK. Each call throws an Error with the server's message, or `unreachable`.
export function createClient({ baseUrl = "" }: ClientOptions = {}) {
  async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error(unreachable);
    }
    // A body that is not JSON comes from a proxy in front of a stopped server.
    const data = await res.json().catch(() => null);
    if (!res.ok || data === null) throw new Error(data?.error ?? unreachable);
    return data;
  }

  // Every line of a bot's chat from `cursor` on, then each new one, until `signal` aborts. After a dropped
  // connection it asks again from the last cursor it read, every 2 seconds.
  async function* stream(id: string, { cursor = 0, signal, onConnection }: StreamOptions = {}): AsyncGenerator<StreamLine> {
    let epoch = 0;
    while (!signal?.aborted) {
      try {
        const res = await fetch(`${baseUrl}/api/profiles/${id}/stream?cursor=${cursor}`, { signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        onConnection?.(true);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let rest = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const parts = (rest + value).split("\n");
          rest = parts.pop()!;
          for (const part of parts.filter(Boolean)) {
            const line: StreamLine = JSON.parse(part);
            cursor = line.cursor ?? cursor;
            // libfx's rule: hide a line whose epoch is lower than one before it.
            if (line.epoch !== undefined && line.epoch < epoch) continue;
            epoch = line.epoch ?? epoch;
            yield line;
          }
        }
      } catch {}
      if (signal?.aborted) return;
      onConnection?.(false);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return {
    health: () => call<{ ok: true }>("/health"),
    profiles: {
      list: () => call<Profile[]>("/profiles"),
      get: (id: string) => call<Profile>(`/profiles/${id}`),
      create: (fields: Partial<Fields> & { name: string }) => call<Profile>("/profiles", "POST", fields),
      update: (id: string, fields: ProfileUpdate) => call<Profile>(`/profiles/${id}`, "PATCH", fields),
      remove: (id: string) => call<{ ok: true }>(`/profiles/${id}`, "DELETE"),
      // Finished turns from the bot's chats before its current one, oldest first.
      earlier: (id: string) => call<Turn[]>(`/profiles/${id}/earlier`),
    },
    settings: {
      get: () => call<Settings>("/settings"),
      update: (settings: Settings) => call<Settings>("/settings", "PATCH", settings),
    },
    // A key goes to the server once and never comes back: a listed provider says only whether it holds one.
    providers: {
      list: () => call<Provider[]>("/providers"),
      add: (provider: NewProvider) => call<Provider>("/providers", "POST", provider),
      update: (id: string, fields: ProviderUpdate) => call<Provider>(`/providers/${id}`, "PATCH", fields),
      remove: (id: string) => call<{ ok: true }>(`/providers/${id}`, "DELETE"),
      models: (id: string) => call<Model[]>(`/providers/${id}/models`),
      teams: (id: string) => call<Team[]>(`/providers/${id}/teams`),
    },
    // A device code sign-in: show the code and link, then poll until it is done or failed.
    signIns: {
      start: (kind: Kind, provider?: string) => call<SignIn>("/sign-ins", "POST", { kind, provider }),
      get: (id: string) => call<SignInStatus>(`/sign-ins/${id}`),
      cancel: (id: string) => call<{ ok: true }>(`/sign-ins/${id}`, "DELETE"),
    },
    // Every bot's files, newest saved first. A file itself is read through the item's `url`.
    library: {
      list: ({ q, profileId, kind, before, limit }: LibraryQuery = {}) => {
        const params = new URLSearchParams(Object.entries({ q, profile: profileId, kind, before, limit }).flatMap(([key, value]) => (value === undefined || value === "" ? [] : [[key, String(value)]])));
        return call<LibraryPage>(`/library${params.size ? `?${params}` : ""}`);
      },
      get: (id: string) => call<LibraryItem>(`/library/${id}`),
      remove: (id: string) => call<{ ok: true }>(`/library/${id}`, "DELETE"),
    },
    // Resolves once the server has stored the message; the reply arrives on the stream.
    send: (id: string, message: Message) => call<{ messageId: string; sessionId: string }>(`/profiles/${id}/messages`, "POST", message),
    stream,
  };
}

export type Client = ReturnType<typeof createClient>;

// One message and its reply. `unsent` marks a message the server never took, which can be sent again.
export type Turn = { messageId: string; text: string; files?: Upload[]; reply: string; reasoning?: string; done: boolean; note?: string; unsent?: boolean };

// Folds one stream line into a thread. Lines without a messageId, such as `idle`, and tool lines change nothing.
export function applyLine(turns: Turn[], line: StreamLine): Turn[] {
  const { messageId } = line;
  if (!messageId) return turns;
  const i = turns.findLastIndex((turn) => turn.messageId === messageId);
  const turn = turns[i] ?? { messageId, text: "", reply: "", done: false };
  if (line.type === "turn_start" || line.type === "turn_resume") {
    // Turns show in the order they start, so a message sent during the replay lands after it.
    // A turn that runs again after a crash sends its reply again from the start.
    const started = { ...turn, text: line.input ?? turn.text, files: line.files ?? turn.files, reply: "", reasoning: undefined, done: false, note: undefined, unsent: undefined };
    return [...(i < 0 ? turns : turns.toSpliced(i, 1)), started];
  }
  let next: Turn;
  if (line.type === "text_delta") {
    next = { ...turn, reply: turn.reply + line.delta };
  } else if (line.type === "reasoning_delta") {
    next = { ...turn, reasoning: (turn.reasoning ?? "") + line.delta };
  } else if (line.type === "turn_end") {
    const note = line.error ? `Error: ${line.error.message}` : line.stopReason === "end_turn" ? undefined : `Stopped: ${line.stopReason}`;
    next = { ...turn, done: true, note };
  } else return turns;
  return i < 0 ? [...turns, next] : turns.with(i, next);
}
