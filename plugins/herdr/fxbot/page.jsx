// How herdr's tools show in a reply, and the plugin's tab in Settings. A chat's stream carries only the start of a tool's
// result, so the agents card shows the list's summary and loads the agents themselves on Show, and a prompt's card
// follows its watch by the id its result starts with. Built into page.js; see the README.
import { useEffect, useState } from "react";
import { api, ui } from "@fxbot/app";

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
  return answer;
}

const statusText = { working: "Working", blocked: "Waiting for you", done: "Done", idle: "Ready", unknown: "Unknown" };
const dot = { working: "bg-primary", blocked: "bg-destructive", done: "bg-muted-foreground", idle: "bg-muted-foreground", unknown: "bg-border" };
const firstLine = (text) => (text ?? "").split("\n")[0];

function Table({ rows }) {
  const machines = [...new Set(rows.map((r) => r.machine))];
  return (
    <div className="grid gap-3">
      {machines.map((machine) => (
        <div key={machine} className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{machine}</p>
          {rows
            .filter((r) => r.machine === machine)
            .map((r, i) =>
              r.unreachable ? (
                <p key={i} className="text-xs text-destructive">
                  Didn't answer: {r.unreachable}
                </p>
              ) : (
                <div key={r.target} className="flex min-w-0 items-center gap-2 text-xs">
                  <span className={`size-2 shrink-0 rounded-full ${dot[r.status] ?? dot.unknown}`} />
                  <span className="shrink-0 font-mono">{r.target}</span>
                  <span className="shrink-0 text-muted-foreground">{r.kind}</span>
                  <span className={`shrink-0 ${r.status === "blocked" ? "font-medium text-destructive" : ""}`}>{statusText[r.status] ?? r.status}</span>
                  <span className="min-w-0 truncate text-muted-foreground" title={r.folder}>
                    {r.title || r.folder}
                  </span>
                </div>
              ),
            )}
        </div>
      ))}
    </div>
  );
}

// herdr_agents: the summary, and the agents as they are now on Show.
function Agents({ call: tool }) {
  const { Button } = ui;
  const [now, setNow] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!tool.done) return <p className="text-sm text-muted-foreground">Asking herdr…</p>;
  const show = () => (setBusy(true), setError(""), call("agents").then(setNow, (e) => setError(e.message)).finally(() => setBusy(false)));
  return (
    <div className="grid gap-2 text-sm">
      <p className={tool.error ? "text-destructive" : ""}>{firstLine(tool.output)}</p>
      {now ? (
        <>
          <p className="text-xs text-muted-foreground">Now: {now.summary}</p>
          <Table rows={now.rows} />
        </>
      ) : (
        !tool.error && (
          <Button type="button" size="xs" variant="outline" className="justify-self-start" disabled={busy} onClick={show}>
            {busy ? "Asking herdr…" : "Show agents now"}
          </Button>
        )
      )}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

const watchText = {
  working: "Working on it",
  done: "Answered: its last lines went to the chat",
  blocked: "Waiting for you, in herdr",
  timeout: "Still working when fxbot stopped waiting",
  gone: "Gone before it answered",
  failed: "Couldn't be followed",
};

// herdr_prompt and herdr_start: who, what, and the watch's state, followed every 5 seconds while it works.
function Sent({ call: tool }) {
  const input = tool.input ?? {};
  const id = /\(w:(\d+)\)/.exec(tool.output ?? "")?.[1];
  const [watch, setWatch] = useState(null);
  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer;
    const look = () =>
      call(`watches/${id}`)
        .then((w) => {
          if (stopped) return;
          setWatch(w);
          if (w.state === "working") timer = setTimeout(look, 5000);
        })
        .catch(() => {});
    look();
    return () => ((stopped = true), clearTimeout(timer));
  }, [id]);
  const who = `${input.agent ?? input.name ?? "An agent"}${input.machine ? ` on ${input.machine}` : ""}`;
  const text = input.text ?? input.prompt;
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="font-medium">{who}</p>
      {text && <p className="line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground">{text}</p>}
      <p className={tool.error ? "text-destructive" : "text-muted-foreground"}>
        {!tool.done ? "Sending…" : watch ? (watchText[watch.state] ?? watch.state) : firstLine(tool.output)}
      </p>
    </div>
  );
}

// The plugin's tab: how fxbot reaches herdr, its machines, and the prompts waiting for an answer.
function Tab() {
  const { Button } = ui;
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const load = () => (setError(""), call("status").then(setState, (e) => setError(e.message)));
  useEffect(() => void load(), []);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!state) return <p className="text-sm text-muted-foreground">Asking herdr…</p>;
  const how =
    state.how === "door"
      ? `Through the door on this machine${state.user ? `, as ${state.user}` : ""}${state.readOnly ? ". It's read-only: bots can look, but not send work or start agents" : ""}.`
      : state.how === "cli"
        ? "Directly, with herdr's own command: fxbot runs as herdr's user."
        : null;
  return (
    <div className="grid gap-4 text-sm">
      <div className="grid gap-1">
        <p className="font-medium">herdr {state.version ?? ""}</p>
        {how ? (
          <p className="text-muted-foreground">{how}</p>
        ) : (
          <p className="text-destructive">
            fxbot can't reach herdr{state.error ? `: ${state.error}` : "."} On the machine, run <code className="font-mono">sudo fxbot herdr on</code>.
          </p>
        )}
      </div>
      {state.machines.length > 0 && (
        <div className="grid gap-1">
          <p className="font-medium">Saved machines</p>
          {state.machines.map((m) => (
            <p key={m.label} className="text-muted-foreground">
              <span className="text-foreground">{m.label}</span>: {m.status === "reachable" ? "answers" : (m.error ?? m.status)}
            </p>
          ))}
        </div>
      )}
      <p className="text-muted-foreground">Each bot reaches every machine unless you pick its machines, under herdr in its settings.</p>
      <div className="grid gap-1">
        <p className="font-medium">Waiting for an answer</p>
        {state.watches.length ? (
          state.watches.map((w) => (
            <p key={w.id} className="text-muted-foreground">
              {w.agent} on {w.machine}, since {new Date(w.started_at).toLocaleTimeString()}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground">Nothing.</p>
        )}
      </div>
      <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={load}>
        Check again
      </Button>
    </div>
  );
}

// The machines one bot may reach, in its settings: all of them, with any herdr adds later, or the ones picked.
function BotMachines({ bot }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () => call(`bots/${bot.id}`).then(setData, (e) => setError(e.message));
  useEffect(() => void load(), [bot.id]);
  if (!data) return error ? <p className="text-sm text-destructive">{error}</p> : null;
  const save = (body) => (setError(""), call(`bots/${bot.id}`, "PUT", body).then(load, (e) => setError(e.message)));
  const toggle = (machine, on) => save({ machines: on ? [...data.machines, machine] : data.machines.filter((m) => m !== machine) });
  return (
    <section className="grid gap-3 text-sm" aria-label="herdr">
      <h2 className="font-medium">herdr</h2>
      <p className="text-muted-foreground">The machines {bot.name} reaches through herdr. On the others, it can't see agents, send them work, or start them.</p>
      <label className="flex items-center gap-2">
        <ui.Checkbox checked={data.all} onCheckedChange={(on) => save(on === true ? { all: true } : { machines: data.available })} />
        Every machine, and any herdr adds later
      </label>
      {!data.all && (
        <div className="grid gap-2 pl-6">
          {data.available.map((machine) => (
            <label key={machine || "here"} className="flex items-center gap-2">
              <ui.Checkbox checked={data.machines.includes(machine)} onCheckedChange={(on) => toggle(machine, on === true)} />
              {machine || "This machine, where fxbot runs"}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}

export default function setup(app) {
  app.botSettings(BotMachines);
  app.toolView("agents", Agents, { open: true });
  app.toolView("prompt", Sent, { open: true });
  app.toolView("start", Sent, { open: true });
  app.settings(Tab);
}
