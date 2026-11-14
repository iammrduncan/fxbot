import { randomUUID } from "node:crypto";

// SignalWire's RELAY, the only file that knows SignalWire (docs/phases/phone-signalwire.md). A JSON-RPC client over one
// WebSocket fxbot opens for a call, as SignalWire's RELAY_IMPLEMENTATION_GUIDE.md specifies it: sign in, ask and answer,
// acknowledge every event, answer pings, and connect again with the protocol it gave. Nothing on the internet connects
// to fxbot. Over it, the line a call runs on: dial, speak, listen, stop, detect voicemail, and hang up.

export type Relay = { url: string; project: string; token: string; from: string; voice: string; language: string; log: (...parts: unknown[]) => void };
export type Outcome = "answered" | "voicemail" | "missed" | "busy" | "declined" | "failed";
/** What the line tells the call. */
export type LineEvents = {
  /** The owner finished something they said. */
  heard: (text: string) => void;
  /** The owner cut in while the bot spoke: what was playing stopped, and what was waiting was dropped. */
  interrupted: () => void;
  /** Those words were played to the end. */
  played: (text: string) => void;
  /** The call is over, and why. */
  ended: (how: string) => void;
};
/** What's needed to end a call from a new connection, after fxbot restarts. */
export type Kept = { id: string; node: string; protocol: string };
export type Place = {
  to: string;
  /** Played the moment the owner answers. */
  greeting: string;
  /** For a call the bot makes: a machine gets this line at the beep instead, and the call ends. */
  voicemail?: string;
  /** The longest the call may last. */
  seconds: number;
  /** Words the recognizer should expect, such as the bot's name. */
  hints?: string[];
  /** A call that only speaks, such as the code that confirms a number: nothing listens, so nothing is billed for it. */
  quiet?: boolean;
  /** Given once SignalWire names the call, so a restart can end it, ringing or on. */
  kept?: (kept: Kept) => void;
};
export type Line = {
  /** Rings the owner. Resolves once they answer, or don't. */
  place(call: Place): Promise<{ outcome: Outcome; error?: string }>;
  /** Speaks this after whatever is playing or waiting. */
  say(text: string): void;
  /** Stops what's playing, and drops what's waiting. */
  stop(): void;
  /** Ends the call once what's waiting has played, or at once with `now`. */
  hangUp(now?: boolean): Promise<void>;
  /** Whether something is playing or waiting to. */
  readonly speaking: boolean;
};

type Pending = { resolve: (result: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

// One RELAY connection. `onEvent` gets each event's type and params; `onLost` runs when it's gone for good.
function connection(relay: Relay, onEvent: (type: string, params: any) => void, onLost: () => void, protocol = "") {
  let socket: WebSocket | null = null;
  let closing = false;
  const pending = new Map<string, Pending>();
  const send = (frame: object) => (socket?.readyState === WebSocket.OPEN ? (socket.send(JSON.stringify(frame)), true) : false);
  const ack = (id: string) => send({ jsonrpc: "2.0", id, result: {} });

  function receive(frame: any) {
    if (frame.method === "signalwire.event") {
      ack(frame.id);
      return onEvent(String(frame.params?.event_type ?? ""), frame.params?.params ?? {});
    }
    if (frame.method === "signalwire.ping") return void ack(frame.id);
    // SignalWire asks the client to go and come back, as on a server's restart. It keeps the calls.
    if (frame.method === "signalwire.disconnect") {
      ack(frame.id);
      return void again();
    }
    const waiting = pending.get(frame.id);
    if (!waiting) return;
    pending.delete(frame.id);
    clearTimeout(waiting.timer);
    if (frame.error) return waiting.reject(new Error(String(frame.error.message ?? "SignalWire refused it.")));
    const code = frame.result?.code;
    if (code !== undefined && !/^2/.test(String(code))) return waiting.reject(new Error(String(frame.result.message ?? `SignalWire answered ${code}.`)));
    waiting.resolve(frame.result ?? {});
  }

  function request(method: string, params: object, ms = 30_000): Promise<any> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => (pending.delete(id), reject(new Error(`SignalWire didn't answer ${method}.`))), ms);
      pending.set(id, { resolve, reject, timer });
      if (!send({ jsonrpc: "2.0", id, method, params }))
        (pending.delete(id), clearTimeout(timer), reject(new Error("The connection to SignalWire is closed.")));
    });
  }

  async function open() {
    const next = new WebSocket(relay.url);
    await new Promise<void>((resolve, reject) => {
      next.onopen = () => resolve();
      next.onerror = () => reject(new Error(`Couldn't reach SignalWire at ${relay.url}.`));
    });
    socket = next;
    next.onmessage = (message) => {
      try {
        receive(JSON.parse(String(message.data)));
      } catch (error) {
        relay.log(`A frame from SignalWire didn't read: ${error instanceof Error ? error.message : error}`);
      }
    };
    next.onclose = () => {
      if (socket !== next) return;
      socket = null;
      for (const [id, waiting] of pending) (pending.delete(id), clearTimeout(waiting.timer), waiting.reject(new Error("The connection to SignalWire closed.")));
      if (!closing) void again();
    };
    const result = await request("signalwire.connect", {
      version: { major: 2, minor: 0, revision: 0 },
      agent: "fxbot phone-signalwire",
      event_acks: true,
      authentication: { project: relay.project, token: relay.token },
      ...(protocol ? { protocol } : {}),
    });
    if (typeof result.protocol === "string") protocol = result.protocol;
  }

  // A connection lost mid-call comes back with its protocol, which SignalWire keeps the call for: up to 3 times in 10
  // seconds, and then the call is lost.
  let returning = false;
  async function again() {
    if (closing || returning) return;
    returning = true;
    const old = socket;
    socket = null;
    old?.close();
    const started = Date.now();
    for (let tries = 0; tries < 3 && Date.now() - started < 10_000 && !closing; tries++) {
      try {
        await open();
        relay.log("The connection to SignalWire dropped, and came back.");
        returning = false;
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    returning = false;
    if (!closing) onLost();
  }

  return {
    open,
    request,
    get protocol() {
      return protocol;
    },
    close() {
      closing = true;
      socket?.close();
      socket = null;
    },
  };
}

// Words, for comparing what the recognizer heard with what's playing.
const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
// What the recognizer heard is the bot's own voice coming back when most of its words are in the line playing.
function echo(heard: string, playing: string) {
  const said = new Set(wordsOf(playing));
  const words = wordsOf(heard);
  return words.length > 0 && words.filter((word) => said.has(word)).length / words.length >= 0.6;
}
const outcomes: Record<string, Outcome> = { busy: "busy", noAnswer: "missed", decline: "declined" };

export function line(relay: Relay, on: LineEvents): Line {
  const tag = randomUUID();
  let call: { id: string; node: string } | null = null;
  let answered = false;
  let over = false;
  // Whether the dial's own result came, and what closes the connection once it does.
  let dialed = false;
  let lastDial: (() => void) | null = null;
  let asked: Place | null = null;
  const queue: string[] = [];
  let playing: { control: string; text: string; cut: boolean; at: number; stopAt?: number } | null = null;
  // What waits for the last line to play, a hang-up or a voicemail's end, and what waits for the call to end.
  const drained = new Set<() => void>();
  const closed = new Set<() => void>();
  // What place waits for: the answer, or why there's none.
  let settle: ((result: { outcome: Outcome; error?: string }) => void) | null = null;
  // On a call the bot makes, what SignalWire's machine detection says goes here.
  let detected: ((found: string) => void) | null = null;
  let detecting = "";
  let collect = "";
  let listens: number[] = [];
  const ids = () => ({ node_id: call!.node, call_id: call!.id });
  const conn = connection(relay, event, () => end("The connection to SignalWire was lost."));

  function end(how: string) {
    if (over) return;
    over = true;
    queue.length = 0;
    playing = null;
    for (const done of [...drained, ...closed]) done();
    drained.clear();
    closed.clear();
    // A call that never connected gets its dial's own result after it ended, as SignalWire's guide says: the
    // connection waits for it, 2 seconds at most, so it's acknowledged.
    if (dialed) conn.close();
    else (lastDial = () => conn.close()), setTimeout(lastDial, 2000);
    settle?.({ outcome: "failed", error: how });
    if (answered) on.ended(how);
  }

  function pump() {
    if (over || !answered || playing) return;
    if (!queue.length) {
      for (const done of drained) done();
      return drained.clear();
    }
    // What waited while the last line played goes as one, so sentences don't each wait on a round trip.
    const text = queue.splice(0).join(" ");
    const control = randomUUID();
    playing = { control, text, cut: false, at: Date.now() };
    conn.request("calling.play", { ...ids(), control_id: control, play: [{ type: "tts", params: { text, voice: relay.voice } }] }).catch((error) => {
      relay.log(`SignalWire didn't play a line: ${error.message}`);
      if (playing?.control === control) ((playing = null), pump());
    });
  }

  // Stops what's playing and drops what waits. Answers whether there was something to stop.
  function cut() {
    queue.length = 0;
    if (!playing || playing.cut) return false;
    playing.cut = true;
    playing.stopAt = Date.now();
    conn.request("calling.play.stop", { ...ids(), control_id: playing.control }).catch(() => {});
    return true;
  }

  function listen(language = `Deepgram:${relay.language}`) {
    // A collect that keeps ending at once would start again forever: 5 in a minute is the most.
    const now = Date.now();
    listens = [...listens.filter((at) => now - at < 60_000), now];
    if (listens.length > 5) return void relay.log("SignalWire kept ending its listening, so the call stopped listening.");
    collect = randomUUID();
    const control = collect;
    conn
      .request("calling.collect", {
        ...ids(),
        control_id: control,
        speech: { end_silence_timeout: 0.8, language, ...(asked?.hints?.length ? { hints: asked.hints } : {}) },
        continuous: true,
        partial_results: true,
        send_start_of_input: true,
      })
      .catch((error) => {
        if (control !== collect || over) return;
        // Deepgram by name is the choice. SignalWire's own pick is the fallback, said in the log.
        if (language !== relay.language) {
          relay.log(`SignalWire didn't take ${language} (${error.message}), so the call listens with ${relay.language}.`);
          return listen(relay.language);
        }
        relay.log(`SignalWire didn't listen: ${error.message}`);
      });
  }

  // SignalWire named the call: what a new connection needs to end it goes to the caller at once.
  function named(found: { id: string; node: string }) {
    call = found;
    if (conn.protocol) asked?.kept?.({ ...found, protocol: conn.protocol });
  }

  function event(type: string, params: any) {
    const ours = params.tag === tag || (call !== null && params.call_id === call.id);
    if (type === "calling.call.state" && ours) {
      if (params.call_id && !call) named({ id: String(params.call_id), node: String(params.node_id ?? "") });
      if (params.call_state === "answered") return void begin();
      if (params.call_state === "ended") {
        const reason = String(params.end_reason ?? "hangup");
        if (!answered) settle?.({ outcome: outcomes[reason] ?? "failed", ...(outcomes[reason] ? {} : { error: `SignalWire ended it: ${reason}.` }) });
        end(reason === "hangup" ? "hung up" : reason);
      }
      return;
    }
    if (type === "calling.call.dial" && params.tag === tag) {
      if (["answered", "failed"].includes(params.dial_state)) (dialed = true), lastDial?.();
      if (params.call?.call_id && !call) named({ id: String(params.call.call_id), node: String(params.call.node_id ?? "") });
      if (params.dial_state === "failed") settle?.({ outcome: "failed", error: "SignalWire couldn't place the call." });
      return;
    }
    if (!call || params.call_id !== call.id) return;
    if (type === "calling.call.play" && playing && params.control_id === playing.control && ["finished", "error"].includes(params.state)) {
      const done = playing;
      playing = null;
      if (done.stopAt) relay.log(`A line stopped ${Date.now() - done.stopAt} ms after it was asked to.`);
      if (params.state === "error") relay.log("SignalWire couldn't play a line.");
      else if (!done.cut) on.played(done.text);
      return pump();
    }
    if (type === "calling.call.collect" && params.control_id === collect) return heard(params);
    if (type === "calling.call.detect" && params.control_id === detecting) {
      const found = params.detect?.params?.event;
      if (typeof found === "string") detected?.(found);
    }
  }

  function heard(params: any) {
    const result = params.result ?? {};
    if (result.type === "start_of_input") {
      // For the first real calls: whether speech is noticed while the bot speaks, and how soon.
      if (playing && !playing.cut) relay.log(`The owner began to speak ${Date.now() - playing.at} ms into a line.`);
      return;
    }
    if (result.type === "speech") {
      const text = String(result.params?.text ?? "").trim();
      const final = params.final === true || (params.final === undefined && params.state !== "collecting");
      if (!text || (playing && !playing.cut && echo(text, playing.text))) return;
      // Two words while the bot speaks cut in. One may be a cough, or the bot's own voice; a final says what it was.
      if (playing && wordsOf(text).length >= 2 && cut()) on.interrupted();
      if (final) on.heard(text);
      return;
    }
    // A collect that ended, on an error or after its longest wait, starts again while the call lasts.
    if (["finished", "error"].includes(result.type) || ["finished", "error"].includes(params.state)) if (!over) listen();
  }

  async function begin() {
    if (answered || !call || !asked) return;
    answered = true;
    if (!asked.quiet) listen();
    const voicemail = asked.voicemail;
    if (!voicemail) {
      settle?.({ outcome: "answered" });
      return pump();
    }
    // A call the bot makes: the greeting plays while SignalWire listens for a machine. No word in 30 seconds is a person.
    detecting = randomUUID();
    const found = await new Promise<string>((resolve) => {
      detected = (event) => ["HUMAN", "UNKNOWN", "MACHINE"].includes(event) && resolve(event);
      conn.request("calling.detect", { ...ids(), control_id: detecting, detect: { type: "machine", params: {} }, timeout: 30 }).catch(() => resolve("UNKNOWN"));
      pump();
      setTimeout(() => resolve("UNKNOWN"), 30_000);
    });
    if (found !== "MACHINE") {
      detected = null;
      return void settle?.({ outcome: "answered" });
    }
    // A machine: the greeting stops, and at the beep the one line plays, then the call ends.
    cut();
    await new Promise<void>((resolve) => {
      detected = (event) => event === "READY" && resolve();
      setTimeout(resolve, 30_000);
    });
    detected = null;
    await new Promise<void>((resolve) => (drained.add(resolve), queue.push(voicemail), pump()));
    settle?.({ outcome: "voicemail" });
    const gone = new Promise<void>((resolve) => (closed.add(resolve), setTimeout(resolve, 5000)));
    await conn.request("calling.end", { ...ids(), reason: "hangup" }).then(
      () => gone,
      () => {},
    );
    end("left a voicemail");
  }

  return {
    async place(call) {
      asked = call;
      const outcome = new Promise<{ outcome: Outcome; error?: string }>((resolve) => (settle = (result) => ((settle = null), resolve(result))));
      try {
        await conn.open();
        // The greeting waits for the answer. max_duration is sent in seconds: SignalWire's own pages disagree on the
        // unit, and minutes would only make it longer, while the call ends itself at its length anyway.
        queue.push(call.greeting);
        await conn.request("calling.dial", {
          tag,
          devices: [[{ type: "phone", params: { from_number: relay.from, to_number: call.to, timeout: 30, max_duration: call.seconds } }]],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        settle?.({ outcome: "failed", error: message });
        end(message);
      }
      return outcome;
    },
    say(text) {
      if (over || !text.trim()) return;
      queue.push(text.trim());
      pump();
    },
    stop() {
      cut();
    },
    async hangUp(now = false) {
      if (over) return;
      if (!now && answered && (playing || queue.length)) await new Promise<void>((resolve) => (drained.add(resolve), setTimeout(resolve, 30_000)));
      if (call && !over) {
        // SignalWire's own "ended" closes the call, so its last events are acknowledged: 5 seconds at most.
        const gone = new Promise<void>((resolve) => (closed.add(resolve), setTimeout(resolve, 5000)));
        await conn.request("calling.end", { ...ids(), reason: "hangup" }, 10_000).then(
          () => gone,
          () => {},
        );
      }
      end("hung up");
    },
    get speaking() {
      return Boolean(playing || queue.length);
    },
  };
}

// Ends a call the last process left, from a new connection with that call's protocol. Answers whether SignalWire took it.
export async function endKept(relay: Relay, kept: Kept): Promise<boolean> {
  const conn = connection(
    relay,
    () => {},
    () => {},
    kept.protocol,
  );
  try {
    await conn.open();
    await conn.request("calling.end", { node_id: kept.node, call_id: kept.id, reason: "hangup" }, 10_000);
    return true;
  } catch (error) {
    relay.log(`Couldn't end call ${kept.id} after the restart: ${error instanceof Error ? error.message : error}`);
    return false;
  } finally {
    conn.close();
  }
}
