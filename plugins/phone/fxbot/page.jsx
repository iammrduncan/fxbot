// phone in the app: the phone at the top of a chat, with its calls, the call's bar above the message box, a call's card
// in the chat, the plugin's tab, and a section in each bot's settings. Built into page.js; see the README.
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, applyLine, go, openBeside, ui, useBots } from "@fxbot/app";
import { Bar, Ended, Mic, RoomBar, RoomTalkBar, TalkBar, talk, useTalk } from "./talk.jsx";

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(answer.error ?? `HTTP ${res.status}`), { answer });
  return answer;
}
const settingsTab = "/settings/plugins/phone";

// A bot's call on the owner's phone, or a room's (keyed room-<id>), ringing or on, with what its bar shows; why the last
// one failed; and whether Call me shows. Read every second while there's a call, and every 15 while a chat is open.
const live = new Map();
const listeners = new Map();
const timers = new Map();
async function read(key) {
  if (!key) return;
  clearTimeout(timers.get(key));
  if (document.visibilityState === "visible") {
    const next = await call(`calls/live?${key.startsWith("room-") ? `room=${key.slice(5)}` : `bot=${key}`}`).then(
      (answer) => ({ call: answer.call, failed: answer.failed || "", button: answer.button !== false, lines: answer.lines === true }),
      () => live.get(key) ?? null,
    );
    live.set(key, next);
    listeners.get(key)?.forEach((listen) => listen());
  }
  timers.set(key, listeners.get(key)?.size ? setTimeout(() => read(key), live.get(key)?.call ? 1000 : 15000) : null);
}
function useLive(key) {
  return useSyncExternalStore(
    (listen) => {
      if (!key) return () => {};
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listen);
      if (!timers.get(key)) void read(key);
      return () => void listeners.get(key).delete(listen);
    },
    () => (key && live.get(key)) || null,
  );
}
// Call me: phone rings the owner's phone, for the same call as in the app. Until phone and a carrier are set up and the
// number confirmed, it opens phone's tab.
const ringFor = (key, body, setError, setOpen) => () => {
  setError("");
  call("calls", "POST", body).then(
    () => setTimeout(() => void read(key), 500),
    (e) => (e.answer?.missing ? go(settingsTab) : (setError(e.message), setOpen(true))),
  );
};
// What the call's bar shows for a call on the owner's phone, from phone, with Mute and End.
const onPhone = (c, label, key) => ({
  status: c.status === "on" ? "on" : "ringing",
  at: new Date(c.answeredAt ?? c.at).getTime(),
  speaking: c.speaking,
  muted: c.muted,
  who: c.who,
  open: c.open,
  label,
  mute: (muted) => call(`calls/${c.id}/mute`, "POST", { muted }).finally(() => void read(key)),
  end: () => call(`calls/${c.id}/end`, "POST").finally(() => void read(key)),
});

const Phone = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// The phone at the top of a bot's chat, or a room's: a choice of calls, so a tap never starts one by itself. Both are the
// same call: in the app, or on the owner's phone. Call me shows when a carrier, such as phone-signalwire, is added, and
// Call me is on for the bot.
function CallChoices({ label, busy, choices, error, open, setOpen, size = "icon" }) {
  return (
    <ui.Popover open={open} onOpenChange={setOpen}>
      <ui.PopoverTrigger asChild>
        <ui.Button type="button" variant="ghost" size={size} aria-label={busy ? "A call is on" : label} title={busy ? "A call is on" : label} disabled={busy}>
          <Phone />
        </ui.Button>
      </ui.PopoverTrigger>
      <ui.PopoverContent align="end" className="w-72 gap-1 p-1" aria-label={label}>
        {error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
        {choices.map((choice) => (
          <ui.Button
            key={choice.key}
            type="button"
            variant="ghost"
            className="h-auto w-full items-start justify-start gap-3 px-2 py-1.5 text-left whitespace-normal"
            onClick={() => (setOpen(false), choice.run())}
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">{choice.icon}</span>
            <span className="grid gap-0.5">
              <span className="font-medium">{choice.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{choice.hint}</span>
            </span>
          </ui.Button>
        ))}
      </ui.PopoverContent>
    </ui.Popover>
  );
}

function CallMenu({ bot }) {
  const state = useLive(bot.id);
  const app = useTalk();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const ring = ringFor(bot.id, { bot: bot.id }, setError, setOpen);
  const choices = [
    { key: "app", label: "In-app call", hint: "Talk here, in this browser", icon: <Mic />, run: () => (setError(""), void talk({ bot: bot.id }, bot.name)) },
    ...(state?.lines && state.button ? [{ key: "line", label: "Call me", hint: `${bot.name} rings your phone`, icon: <Phone />, run: ring }] : []),
  ];
  const busy = Boolean(state?.call) || Boolean(app && app.status !== "ended");
  return <CallChoices label={`Call ${bot.name}`} busy={busy} choices={choices} error={error} open={open} setOpen={setOpen} />;
}

// The same in a room's header, for a call with all its bots.
function RoomCall({ room }) {
  const app = useTalk();
  const key = room ? `room-${room.id}` : "";
  const state = useLive(key);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (!room?.members?.length) return null;
  const choices = [
    { key: "app", label: "In-app call", hint: "Talk with all its bots, in this browser", icon: <Mic />, run: () => (setError(""), void talk({ room: room.id }, room.name)) },
    ...(state?.lines ? [{ key: "line", label: "Call me", hint: "Its bots ring your phone", icon: <Phone />, run: ringFor(key, { room: room.id }, setError, setOpen) }] : []),
  ];
  const busy = Boolean(state?.call) || Boolean(app && app.status !== "ended");
  return <CallChoices label={`Call ${room.name}`} busy={busy} choices={choices} error={error} open={open} setOpen={setOpen} size="icon-sm" />;
}

// Above the message box, while a call on the owner's phone rings or is on: the same bar as a call in the app. Or why the
// last one failed, for a minute.
function CallBar({ bot }) {
  const state = useLive(bot.id);
  if (state?.call) return <Bar now={onPhone(state.call, bot.name, bot.id)} title={`Talking with ${bot.name}`} bots={[bot.id]} />;
  return state?.failed ? <Ended error={state.failed} /> : null;
}
// The same above a room's message box.
function RoomCallBar({ room }) {
  const key = room ? `room-${room.id}` : "";
  const state = useLive(key);
  if (!room) return null;
  if (state?.call) return <RoomBar now={onPhone(state.call, room.name, key)} room={room} />;
  return state?.failed ? <Ended error={state.failed} /> : null;
}

// phone_call in a reply: why the bot called, then how it went.
function CallCard({ call: tool }) {
  const reason = typeof tool.input?.reason === "string" ? tool.input.reason : "";
  const later = tool.input?.later === true;
  return (
    <div className="grid gap-1 text-sm">
      <p className="font-medium">{later ? "A call-back for later" : "A call to your phone"}</p>
      {reason && <p className="text-muted-foreground">{reason}</p>}
      <p className={/failed|didn't|isn't|not set up/i.test(tool.output ?? "") ? "text-destructive" : "text-muted-foreground"}>
        {tool.done ? tool.output : later ? "Keeping it…" : "Ringing…"}
      </p>
    </div>
  );
}

const outcome = { ringing: "Ringing", on: "On", ended: "Ended", voicemail: "Voicemail", missed: "Missed", busy: "Busy", failed: "Failed" };
const length = (seconds) => (seconds == null ? "" : seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`);

// Each provider added: ready, what it still needs in its own settings, or off. With two or more running, the default.
function Providers({ status, onPick }) {
  const running = status.providers.filter((p) => p.running);
  if (!status.providers.length)
    return <p className="text-muted-foreground">For calls on your phone, add a provider plugin from Plugins, such as phone-signalwire: it carries their audio over your phone line.</p>;
  return (
    <div className="grid gap-1">
      <h3 className="font-medium">Ways to call</h3>
      {status.providers.map((p) => (
        <p key={p.name} className="flex flex-wrap items-center gap-x-2">
          <span>{p.label}</span>
          {p.old ? (
            <span className="text-muted-foreground">is from before this phone, and needs its update, in Plugins.</span>
          ) : !p.running ? (
            <span className="text-muted-foreground">is off. Plugins says why.</span>
          ) : p.missing.length ? (
            <>
              <span className="text-muted-foreground">needs {p.missing.join(", ")}.</span>
              <ui.Button type="button" size="xs" variant="ghost" onClick={() => go(`/settings/plugins/${p.name}`)}>
                Its settings
              </ui.Button>
            </>
          ) : (
            <span className="text-muted-foreground">is ready{running.length > 1 && status.provider === p.name ? ", and calls go through it unless a bot has its own" : ""}.</span>
          )}
        </p>
      ))}
      {running.length > 1 && (
        <label className="flex flex-wrap items-center gap-2">
          <span>Calls go through</span>
          <ui.NativeSelect aria-label="The default provider" value={status.provider ?? ""} onChange={(e) => onPick(e.target.value)}>
            {running.map((p) => (
              <ui.NativeSelectOption key={p.name} value={p.name}>
                {p.label}
              </ui.NativeSelectOption>
            ))}
          </ui.NativeSelect>
        </label>
      )}
    </div>
  );
}

// The plugin's tab: the ways to call, confirming the owner's number, and the last calls.
function Tab() {
  const [status, setStatus] = useState(null);
  const [calls, setCalls] = useState([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const load = () => {
    call("status").then(setStatus, (e) => setError(e.message));
    call("calls").then(setCalls, () => {});
  };
  useEffect(load, []);
  if (!status) return error ? <p className="text-sm text-destructive">{error}</p> : null;
  const pick = (provider) => (setError(""), call("provider", "PUT", { provider }).then(load, (e) => setError(e.message)));
  const ring = () => (
    setError(""),
    setNote(""),
    call("confirm", "POST").then(
      () => setNote(`Calling ${status.to}. Type the code it reads.`),
      (e) => setError(e.message),
    )
  );
  const check = () => (
    setError(""),
    call("confirm/code", "POST", { code }).then(
      () => (setNote("Your number is confirmed."), setCode(""), load()),
      (e) => setError(e.message),
    )
  );
  const using = status.providers.find((p) => p.name === status.provider);
  const ready = using && using.running && !using.missing.length;
  return (
    <section className="grid gap-3 text-sm" aria-label="Your phone">
      <VoiceSection />
      <h2 className="font-medium">Your phone</h2>
      <Providers status={status} onPick={pick} />
      {status.missing.length ? (
        <p className="text-muted-foreground">Set {status.missing.join(", ")} above, then confirm your number here.</p>
      ) : !ready ? (
        <p className="text-muted-foreground">Once a way to call is ready, confirm your number here.</p>
      ) : status.confirmed ? (
        <p className="text-muted-foreground">Bots call {status.to}, and only it. Change the number above, and it needs confirming again.</p>
      ) : (
        <div className="grid gap-2">
          <p className="text-muted-foreground">
            Confirm {status.to} before a bot calls it: fxbot calls it through {using.label} and reads a code, which you type here.
          </p>
          <div className="flex flex-wrap gap-2">
            <ui.Button type="button" size="sm" variant="outline" onClick={ring}>
              Call me to confirm
            </ui.Button>
            <ui.Input
              aria-label="The code"
              placeholder="The code"
              inputMode="numeric"
              value={code}
              maxLength={8}
              style={{ width: "8rem" }}
              onChange={(e) => setCode(e.target.value)}
            />
            <ui.Button type="button" size="sm" disabled={!code.trim()} onClick={check}>
              Confirm
            </ui.Button>
          </div>
        </div>
      )}
      {note && <p>{note}</p>}
      {error && <p className="text-destructive">{error}</p>}
      {calls.length > 0 && (
        <div className="grid gap-1">
          <h3 className="font-medium">Last calls</h3>
          {calls.map((c) => (
            <p key={c.id} className="flex flex-wrap gap-x-2 text-xs">
              <span>{c.name}</span>
              <span className="text-muted-foreground">{new Date(c.at).toLocaleString()}</span>
              {status.providers.length > 1 && <span className="text-muted-foreground">{c.providerLabel}</span>}
              <span>{outcome[c.status] ?? c.status}</span>
              <span className="text-muted-foreground">{length(c.seconds)}</span>
              {c.error && <span className="text-destructive">{c.error}</span>}
              {(c.chat || c.call_room) && (
                <button type="button" className="text-primary underline" onClick={() => openBeside(`/phone/calls/${c.id}`)}>
                  Open
                </button>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

// How phone hears and speaks on every call, in the app or on the owner's phone: a provider the owner added for each, with
// its model, and a voice, or This device, the browser's own speech, which only a call in the app has.
function VoiceSection() {
  const [voice, setVoice] = useState(null);
  const [voices, setVoices] = useState([]);
  const [error, setError] = useState("");
  // The model boxes open for typing a model the provider doesn't suggest, and whether Hear it is playing.
  const [typing, setTyping] = useState({});
  const [hearing, setHearing] = useState(false);
  const load = () =>
    call("voice").then(
      (v) => (setVoice(v), v.speak.provider !== "device" ? call("voice/voices").then(setVoices, () => setVoices([])) : setVoices([])),
      (e) => setError(e.message),
    );
  useEffect(() => void load(), []);
  if (!voice) return error ? <p className="text-destructive">{error}</p> : null;
  const save = (patch) => {
    const next = {
      listenProvider: voice.listen.provider,
      listenModel: voice.listen.model,
      speakProvider: voice.speak.provider,
      speakModel: voice.speak.model,
      speakVoice: voice.speak.voice,
      ...patch,
    };
    setError("");
    call("voice", "PUT", next).then(load, (e) => setError(e.message));
  };
  const listener = voice.listeners.find((p) => p.id === voice.listen.provider);
  const speaker = voice.speakers.find((p) => p.id === voice.speak.provider);
  // A provider's models, each listed, and Another model to type one it doesn't suggest. A box with suggestions in a
  // datalist showed only the one already in it.
  const models = (p, model, onPick, label) => {
    if (!p) return null;
    const own = typing[label] || (model && !p.models.includes(model)) || !p.models.length;
    const box = <ui.Input aria-label={`${label}, typed`} value={model} placeholder="A model's id" onChange={(e) => onPick(e.target.value)} onBlur={(e) => onPick(e.target.value, true)} />;
    if (!p.models.length)
      return (
        <label className="grid gap-1">
          <span>{label}</span>
          {box}
        </label>
      );
    return (
      <label className="grid gap-1">
        <span>{label}</span>
        <ui.NativeSelect
          aria-label={label}
          className="w-full"
          value={own ? "" : model || p.models[0]}
          onChange={(e) => (e.target.value ? (setTyping({ ...typing, [label]: false }), onPick(e.target.value, true)) : setTyping({ ...typing, [label]: true }))}
        >
          {p.models.map((m) => (
            <ui.NativeSelectOption key={m} value={m}>
              {m}
            </ui.NativeSelectOption>
          ))}
          <ui.NativeSelectOption value="">Another model…</ui.NativeSelectOption>
        </ui.NativeSelect>
        {own && box}
      </label>
    );
  };
  // A line in the voice and model picked, from phone, played here: what a call sounds like, without one.
  const hear = async () => {
    setHearing(true);
    setError("");
    try {
      const res = await api(`voice/sample?${new URLSearchParams({ model: voice.speak.model ?? "", voice: voice.speak.voice ?? "" })}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const context = new AudioContext();
      const source = context.createBufferSource();
      source.buffer = await context.decodeAudioData(await res.arrayBuffer());
      source.connect(context.destination);
      source.onended = () => (setHearing(false), void context.close().catch(() => {}));
      source.start();
    } catch (e) {
      setHearing(false);
      setError(`The sample didn't play: ${e.message}`);
    }
  };
  const [listenModel, setListenModel] = [voice.listen.model, (model, done) => (setVoice({ ...voice, listen: { ...voice.listen, model } }), done && save({ listenModel: model }))];
  const [speakModel, setSpeakModel] = [voice.speak.model, (model, done) => (setVoice({ ...voice, speak: { ...voice.speak, model } }), done && save({ speakModel: model }))];
  const hears = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  return (
    <section className="grid gap-3" aria-label="Voice">
      <h2 className="font-medium">Voice</h2>
      <p className="text-muted-foreground">
        How bots hear you and speak on a call, in the app or on your phone, from the phone at the top of a chat. Add voice providers in Settings › Providers: ElevenLabs and Deepgram,
        under For phone, or a speech server on your machine. A Mistral, Groq, OpenAI, or Cloudflare login listens too. This device works only in the app.
      </p>
      <label className="grid gap-1">
        <span>Listening</span>
        <ui.NativeSelect aria-label="Listening" className="w-full" value={voice.listen.provider} onChange={(e) => save({ listenProvider: e.target.value, listenModel: "" })}>
          {voice.listeners.map((p) => (
            <ui.NativeSelectOption key={p.id} value={p.id}>
              {p.name}
              {p.streams ? "" : ", one stretch at a time"}
            </ui.NativeSelectOption>
          ))}
          {/* Listening on the device needs the browser's speech recognition, which Firefox and an installed iPhone app lack. */}
          {(hears || voice.listen.provider === "device") && (
            <ui.NativeSelectOption value="device">{hears ? "This device: the browser's own" : "This device: not in this browser"}</ui.NativeSelectOption>
          )}
        </ui.NativeSelect>
      </label>
      {models(listener, listenModel, setListenModel, "Listening model")}
      <label className="grid gap-1">
        <span>Speaking</span>
        <ui.NativeSelect aria-label="Speaking" className="w-full" value={voice.speak.provider} onChange={(e) => save({ speakProvider: e.target.value, speakModel: "", speakVoice: "" })}>
          {voice.speakers.map((p) => (
            <ui.NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </ui.NativeSelectOption>
          ))}
          <ui.NativeSelectOption value="device">This device: the browser's own</ui.NativeSelectOption>
        </ui.NativeSelect>
      </label>
      {models(speaker, speakModel, setSpeakModel, "Speaking model")}
      {speaker && voices.length > 0 && (
        <label className="grid gap-1">
          <span>Voice</span>
          <ui.NativeSelect aria-label="Voice" className="w-full" value={voice.speak.voice} onChange={(e) => save({ speakVoice: e.target.value })}>
            <ui.NativeSelectOption value="">{voices[0].label}, the first</ui.NativeSelectOption>
            {grouped(voices).map(([group, list]) =>
              group ? (
                <ui.NativeSelectOptGroup key={group} label={group}>
                  {list.map((v) => (
                    <ui.NativeSelectOption key={v.value} value={v.value}>
                      {v.label}
                    </ui.NativeSelectOption>
                  ))}
                </ui.NativeSelectOptGroup>
              ) : (
                list.map((v) => (
                  <ui.NativeSelectOption key={v.value} value={v.value}>
                    {v.label}
                  </ui.NativeSelectOption>
                ))
              ),
            )}
          </ui.NativeSelect>
          <span className="text-xs text-muted-foreground">Each bot can have its own, in its Phone section. In a room, a bot with none gets one no other bot there has.</span>
        </label>
      )}
      {speaker && (
        <div>
          <ui.Button variant="outline" size="sm" disabled={hearing} onClick={() => void hear()}>
            {hearing ? "Playing…" : "Hear it"}
          </ui.Button>
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}

// A switch with its name beside it and what it does under both. A plugin's page gets only the classes the app uses.
function Toggle({ checked, label, hint, onChange }) {
  return (
    <div className="grid gap-1">
      <label className="flex items-center gap-2">
        <ui.Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
        <span>{label}</span>
      </label>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  );
}

// The voices by their group, in the provider's order.
function grouped(voices) {
  const groups = new Map();
  for (const v of voices) groups.set(v.group ?? "", [...(groups.get(v.group ?? "") ?? []), v]);
  return [...groups];
}

// A bot's section: what it gets, its provider with two or more, its voice, and the call-back it holds.
function BotSection({ bot }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const load = () => call(`bots/${bot.id}`).then(setState, (e) => setError(e.message));
  useEffect(() => void load(), [bot.id]);
  if (!state) return null;
  const save = (patch) => (
    setError(""),
    call(`bots/${bot.id}`, "PUT", patch).then(
      (next) => (setState(next), void read(bot.id)),
      (e) => setError(e.message),
    )
  );
  const chosen = state.voices.find((v) => v.value === state.voice);
  return (
    <section className="grid gap-3 text-sm" aria-label="Phone">
      <h2 className="font-medium">Phone</h2>
      <Toggle checked={state.button} label="Call me" hint="In the phone at the top of the bot's chat: the bot rings your phone." onChange={(button) => save({ button })} />
      <Toggle checked={state.asked} label="Calls when you ask" hint={`${bot.name} calls when you ask it to, now or when something is done.`} onChange={(asked) => save({ asked })} />
      <Toggle
        checked={state.own}
        label="Calls on its own"
        hint={`When ${bot.name} decides to, at most ${state.perDay} ${state.perDay === 1 ? "time" : "times"} a day, and never in your quiet hours, ${state.quiet}.`}
        onChange={(own) => save({ own })}
      />
      {state.providers.length > 1 && (
        <label className="grid gap-1">
          <span>Calls go through</span>
          <ui.NativeSelect aria-label="Its provider" className="w-full" value={state.provider ?? ""} onChange={(e) => save({ provider: e.target.value || null })}>
            <ui.NativeSelectOption value="">The default</ui.NativeSelectOption>
            {state.providers.map((p) => (
              <ui.NativeSelectOption key={p.name} value={p.name}>
                {p.label}
              </ui.NativeSelectOption>
            ))}
          </ui.NativeSelect>
        </label>
      )}
      {state.using && state.voices.length > 0 && (
        <label className="grid gap-1">
          <span>Voice</span>
          <ui.NativeSelect aria-label="Its voice" className="w-full" value={state.voice ?? ""} onChange={(e) => save({ voice: e.target.value || null })}>
            <ui.NativeSelectOption value="">The voice in phone's Voice section</ui.NativeSelectOption>
            {grouped(state.voices).map(([group, voices]) =>
              group ? (
                <ui.NativeSelectOptGroup key={group} label={group}>
                  {voices.map((v) => (
                    <ui.NativeSelectOption key={v.value} value={v.value}>
                      {v.label}
                    </ui.NativeSelectOption>
                  ))}
                </ui.NativeSelectOptGroup>
              ) : (
                voices.map((v) => (
                  <ui.NativeSelectOption key={v.value} value={v.value}>
                    {v.label}
                  </ui.NativeSelectOption>
                ))
              ),
            )}
          </ui.NativeSelect>
          {chosen?.group && <span className="text-xs text-muted-foreground">{chosen.group}</span>}
        </label>
      )}
      {state.callback && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            A call-back until {new Date(state.callback.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: {state.callback.reason}
          </span>
          <ui.Button type="button" size="xs" variant="ghost" onClick={() => call(`bots/${bot.id}/callback`, "DELETE").then(load, (e) => setError(e.message))}>
            Remove
          </ui.Button>
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}

// A call's own chat, live: its session's lines, folded as the chat folds its own, read again after a drop while it's on.
function useCallTurns(id, chat) {
  const [turns, setTurns] = useState([]);
  useEffect(() => {
    if (!chat) return;
    const stop = new AbortController();
    (async () => {
      while (!stop.signal.aborted) {
        try {
          const res = await api(`calls/${id}/stream`, { signal: stop.signal });
          if (!res.ok) return;
          let next = [];
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let rest = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
            rest = parts.pop();
            for (const part of parts.filter(Boolean)) next = applyLine(next, JSON.parse(part));
            setTurns(next);
          }
        } catch {
          if (stop.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => stop.abort();
  }, [id, chat]);
  return turns;
}

// A room's call: its call room's messages, live, from chat rooms' stream, as the room's page reads them.
function useCallRoom(id) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (!id) return;
    const stop = new AbortController();
    (async () => {
      while (!stop.signal.aborted) {
        try {
          const res = await fetch(`/api/plugins/chat-rooms/rooms/${id}/stream`, { signal: stop.signal });
          if (!res.ok) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let rest = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
            rest = parts.pop();
            for (const part of parts.filter(Boolean)) {
              const event = JSON.parse(part);
              if (event.type === "room") setMessages(event.messages);
              else if (event.type === "message") setMessages((all) => (all.some((m) => m.id === event.message.id) ? all : [...all, event.message]));
            }
          }
        } catch {
          if (stop.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => stop.abort();
  }, [id]);
  return messages;
}

// A call's chat, read only, beside the main chat from its pill or Last calls (docs/phases/phone-v3.md): when, how long,
// and who, the summary the bot wrote for its main chat, and the call as it went. The turn that asked for the summary
// isn't shown: its answer is the summary.
function CallChat({ params }) {
  const { Header, Message, MessageContent, Bubble, BubbleContent, Reply, MessageScroller, MessageScrollerProvider, MessageScrollerViewport, MessageScrollerContent, MessageScrollerButton } = ui;
  const [found, setFound] = useState(undefined);
  useEffect(() => {
    setFound(undefined);
    call(`calls/${params.id}`).then(setFound, () => setFound(null));
  }, [params.id]);
  const turns = useCallTurns(params.id, Boolean(found?.chat));
  const roomMessages = useCallRoom(found?.call_room);
  const bots = useBots() ?? [];
  if (found === null) return <Header title="Phone call" />;
  if (!found) return <Header title="Phone call" />;
  const minutes = Math.max(1, Math.round((found.seconds ?? 0) / 60));
  const shown = turns.filter((turn) => !/-summary(-2)?$/.test(turn.messageId));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header title={`Phone call · ${minutes} min`} />
      <p className="px-4 text-xs text-muted-foreground">
        {found.name} · {new Date(found.at).toLocaleString()} · {length(found.seconds)}
      </p>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-4">
              {found.summary && (
                <section aria-label="Summary" className="grid gap-1 rounded-lg border bg-muted p-3 text-sm">
                  <h3 className="font-medium">Summary</h3>
                  <p className="whitespace-pre-wrap">{found.summary}</p>
                </section>
              )}
              {!found.chat && !found.call_room && <p className="text-sm text-muted-foreground">This call was before calls had chats of their own: it's in the bot's main chat.</p>}
              {/* A room's call: its call room, as said, but the ask for the summary and its answer, shown above. */}
              {roomMessages
                .filter((m) => m.author !== "note" && !/\[The call has ended/.test(m.text) && m.text !== found.summary)
                .map((m) =>
                  m.author === "owner" ? (
                    <Message key={m.id} align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">{m.text.replace(/<@bot:([0-9a-f]{12})>/g, (_, id) => `@${bots.find((b) => b.id === id)?.name ?? "a bot"}`).replace(/<@all>/g, "@all")}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message key={m.id}>
                      <MessageContent>
                        <p className="text-sm font-medium">{m.author === "plugin" ? (m.label ?? "A plugin") : (bots.find((b) => b.id === m.author)?.name ?? "A bot that's gone")}</p>
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                      </MessageContent>
                    </Message>
                  ),
                )}
              {shown.map((turn) => (
                <div key={turn.messageId} className="grid gap-6">
                  {turn.text && (
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end" variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">{turn.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                  <Message>
                    <MessageContent>
                      <Reply turn={turn} />
                    </MessageContent>
                  </Message>
                </div>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}

export default function setup(app) {
  // The phone at the top of a chat, on fxbot 0.12.0 or newer.
  app.header?.(CallMenu);
  app.chat(TalkBar);
  app.chat(CallBar);
  app.slot?.("chat-rooms.room-header", RoomCall);
  app.slot?.("chat-rooms.room-box", RoomTalkBar);
  app.slot?.("chat-rooms.room-box", RoomCallBar);
  app.toolView("call", CallCard, { open: true });
  app.route("/calls/:id", CallChat);
  app.settings(Tab);
  app.botSettings(BotSection);
}
