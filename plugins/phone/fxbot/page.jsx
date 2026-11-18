// phone in the app: Call me in the message box, the call's bar above it, a call's card in the chat, the plugin's tab,
// and a section in each bot's settings. Built into page.js; see the README.
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, go, ui } from "@fxbot/app";

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(answer.error ?? `HTTP ${res.status}`), { answer });
  return answer;
}
const settingsTab = "/settings/plugins/phone";

// Each bot's call that's ringing or on, and whether its Call me shows, read every 2 seconds while there's a call, and
// every 15 while a chat is open.
const live = new Map();
const listeners = new Map();
const timers = new Map();
async function read(bot) {
  clearTimeout(timers.get(bot));
  if (document.visibilityState === "visible") {
    const next = await call(`calls/live?bot=${bot}`).then(
      (answer) => ({ call: answer.call, button: answer.button !== false }),
      () => live.get(bot) ?? null,
    );
    live.set(bot, next);
    listeners.get(bot)?.forEach((listen) => listen());
  }
  timers.set(bot, listeners.get(bot)?.size ? setTimeout(() => read(bot), live.get(bot)?.call ? 2000 : 15000) : null);
}
function useLive(bot) {
  return useSyncExternalStore(
    (listen) => {
      if (!listeners.has(bot)) listeners.set(bot, new Set());
      listeners.get(bot).add(listen);
      if (!timers.get(bot)) void read(bot);
      return () => void listeners.get(bot).delete(listen);
    },
    () => live.get(bot) ?? null,
  );
}

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

// Call me, beside the message box, unless it's off for the bot. Until phone and its provider are set up and the number
// confirmed, it opens phone's tab.
function CallButton({ bot }) {
  const state = useLive(bot.id);
  const now = state?.call ?? null;
  const [error, setError] = useState("");
  const ring = () => {
    setError("");
    call("calls", "POST", { bot: bot.id }).then(
      () => void read(bot.id),
      (e) => (e.answer?.missing || /confirm/i.test(e.message) ? go(settingsTab) : setError(e.message)),
    );
  };
  if (state && !state.button) return null;
  return (
    <ui.Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      aria-label={error || `Call me: ${bot.name} rings your phone`}
      title={error || `Call me: ${bot.name} rings your phone`}
      disabled={Boolean(now)}
      onClick={ring}
    >
      <Phone />
    </ui.Button>
  );
}

const clock = (from) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Above the message box, while a call rings or is on: how long it's been, and End call.
function CallBar({ bot }) {
  const now = useLive(bot.id)?.call ?? null;
  const [, tick] = useState(0);
  const [ending, setEnding] = useState(false);
  useEffect(() => {
    if (!now) return setEnding(false);
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [now?.id]);
  if (!now) return null;
  const end = () => (setEnding(true), call(`calls/${now.id}/end`, "POST").finally(() => void read(bot.id)));
  return (
    <section className="flex items-center gap-2 rounded-lg border bg-background p-2 pl-3 text-sm" aria-label={`Your call with ${bot.name}`}>
      <span className="text-muted-foreground">
        <Phone />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {now.status === "on" && now.answeredAt ? `On the phone with ${bot.name} · ${clock(now.answeredAt)}` : `Ringing your phone…`}
      </span>
      <ui.Button type="button" size="sm" variant="destructive" disabled={ending} onClick={end}>
        End call
      </ui.Button>
    </section>
  );
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
  if (!status.providers.length) return <p className="text-muted-foreground">Add a provider plugin from Plugins, such as phone-signalwire: it carries the calls.</p>;
  return (
    <div className="grid gap-1">
      <h3 className="font-medium">Ways to call</h3>
      {status.providers.map((p) => (
        <p key={p.name} className="flex flex-wrap items-center gap-x-2">
          <span>{p.label}</span>
          {!p.running ? (
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
            </p>
          ))}
        </div>
      )}
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
      <Toggle checked={state.button} label="Call me" hint="The button beside the message box rings your phone." onChange={(button) => save({ button })} />
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
            <ui.NativeSelectOption value="">The voice in {state.using.label}'s settings</ui.NativeSelectOption>
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

export default function setup(app) {
  app.composer(CallButton);
  app.chat(CallBar);
  app.toolView("call", CallCard, { open: true });
  app.settings(Tab);
  app.botSettings(BotSection);
}
