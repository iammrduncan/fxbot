// The subagents' parts of the app: the list in a bot's panel, a subagent's thread on a screen of its own, and how
// subagents_start shows in a reply. Built into page.js; see the README.
import { useEffect, useState } from "react";
import { api, applyLine, go, ui, useBots } from "@fxbot/app";

async function call(path, method = "GET") {
  const res = await api(path, { method });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(answer.error ?? `HTTP ${res.status}`), { status: res.status });
  return answer;
}

// A start in the chat, or a stop, reads the list again at once.
const changed = () => window.dispatchEvent(new Event("subagents-changed"));
const screenOf = (s) => `/subagents/${s.bot}/${s.id}`;
const minutes = (from, to = Date.now()) => {
  const m = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  return m < 1 ? "<1 min" : `${m} min`;
};
const word = { working: "Working", done: "Done", failed: "Failed", stopped: "Stopped" };
const stop = (s) => call(`runs/${s.id}/stop`, "POST").then(changed, (e) => alert(e.message));

// Reads a path now, and again every `busy` ms while it says one works, or every `idle` ms otherwise.
function usePoll(path, working, { busy = 5000, idle = 30000 } = {}) {
  const [value, setValue] = useState(undefined);
  useEffect(() => {
    if (!path) return;
    let gone = false;
    let timer;
    const read = () => {
      clearTimeout(timer);
      call(path).then(
        (answer) => !gone && (setValue(answer), (timer = setTimeout(read, working(answer) ? busy : idle))),
        (error) => !gone && (setValue(error.status === 404 ? null : (value) => value), (timer = setTimeout(read, idle))),
      );
    };
    read();
    addEventListener("subagents-changed", read);
    return () => ((gone = true), clearTimeout(timer), removeEventListener("subagents-changed", read));
  }, [path]);
  return value;
}

function Row({ s }) {
  const { Button } = ui;
  const calls = s.calls ? `${s.calls} ${s.calls === 1 ? "call" : "calls"}` : "";
  const detail = s.state === "working" ? [s.tool, calls].filter(Boolean).join(" · ") : s.state === "done" ? "" : s.ended;
  return (
    <li className="subagents-row" data-state={s.state}>
      <button type="button" className="subagents-open" onClick={() => go(screenOf(s))} title={`Open ${s.title}`}>
        <span className="subagents-dot" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{s.title}</span>
          {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        <span className="subagents-state text-xs">
          {s.state === "working" ? "" : `${word[s.state]} · `}
          {minutes(s.startedAt, s.endedAt ?? Date.now())}
        </span>
      </button>
      {s.state === "working" && (
        <Button type="button" size="xs" variant="ghost" onClick={() => stop(s)} aria-label={`Stop ${s.title}`}>
          Stop
        </Button>
      )}
    </li>
  );
}

// The panel's list: the working ones and the three newest that ended, with the rest folded. Nothing when there's none.
function Panel({ bot }) {
  const answer = usePoll(`bots/${bot.id}`, (a) => a.subagents.some((s) => s.state === "working"));
  const [unfolded, setUnfolded] = useState(false);
  const list = answer?.subagents ?? [];
  if (!list.length) return null;
  const working = list.filter((s) => s.state === "working");
  const ended = list.filter((s) => s.state !== "working");
  const shown = [...working, ...(unfolded ? ended : ended.slice(0, 3))];
  const folded = unfolded ? 0 : ended.length - 3;
  return (
    <section aria-label={`${bot.name}'s subagents`} className="subagents-panel">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Subagents</span>
        <span>{working.length ? `${working.length} working` : ""}</span>
      </div>
      <ul className="subagents-list">
        {shown.map((s) => (
          <Row key={s.id} s={s} />
        ))}
      </ul>
      {folded > 0 && (
        <button type="button" className="subagents-more text-xs text-muted-foreground" onClick={() => setUnfolded(true)}>
          {folded} earlier
        </button>
      )}
    </section>
  );
}

// A subagent's turn, live: its session's stream, folded as the chat folds its own, and the tokens it used.
function useThread(id, started) {
  const [turns, setTurns] = useState([]);
  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    if (!started) return;
    const stop = new AbortController();
    (async () => {
      while (!stop.signal.aborted) {
        try {
          const res = await api(`runs/${id}/stream`, { signal: stop.signal });
          // Not started yet, or gone: look again shortly.
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          let next = [];
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let rest = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
            rest = parts.pop();
            for (const part of parts.filter(Boolean)) {
              const line = JSON.parse(part);
              next = applyLine(next, line);
              if (line.type === "turn_end" && line.usage) setTokens((line.usage.inputTokens ?? 0) + (line.usage.outputTokens ?? 0));
            }
            setTurns(next);
          }
        } catch {
          if (stop.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => stop.abort();
  }, [id, started]);
  return { turns, tokens };
}

const back = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

// A subagent's thread, read only: its task, then its turn as it streams, then how it ended.
function Thread({ params }) {
  const { Header, Blob, Button, Message, MessageContent, Bubble, BubbleContent, Reply, MessageScroller, MessageScrollerProvider, MessageScrollerViewport, MessageScrollerContent, MessageScrollerButton } = ui;
  const bots = useBots();
  const bot = bots?.find((b) => b.id === params.bot);
  const found = usePoll(`runs/${params.id}`, (r) => r.state === "working", { busy: 3000, idle: 30000 });
  // A link to another bot's subagent is as good as gone.
  const run = found && found.bot !== params.bot ? null : found;
  const { turns, tokens } = useThread(params.id, Boolean(run));
  const chat = () => go(`/profiles/${params.bot}`);
  const lead = (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={bot ? `Back to ${bot.name}'s chat` : "Back"} onClick={chat}>
      {back}
    </Button>
  );
  if (run === null)
    return (
      <>
        <Header title="Subagent" lead={lead} />
        <div className="subagents-gone grid gap-3 text-sm">
          <p>This subagent is gone{bot ? `, or isn't ${bot.name}'s` : ""}.</p>
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={chat}>
            {bot ? `Back to ${bot.name}'s chat` : "Back"}
          </Button>
        </div>
      </>
    );
  if (!run) return <Header title="Subagent" lead={lead} />;
  const took = minutes(run.startedAt, run.endedAt ?? Date.now()).replace("min", "minutes").replace("<1 minutes", "under a minute");
  const used = [...(run.calls ? [`${run.calls} ${run.calls === 1 ? "call" : "calls"}`] : []), ...(tokens ? [`${tokens.toLocaleString()} tokens`] : [])].join(" and ");
  const end = {
    done: `Done in ${took}${used ? `, with ${used},` : ""} and reported to ${bot?.name ?? "its bot"}.`,
    failed: `Failed after ${took}: ${run.ended}`,
    stopped: `Stopped after ${took}: ${run.ended}`,
  }[run.state];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header title={run.title} lead={lead}>
        {run.state === "working" && (
          <Button type="button" size="sm" variant="outline" onClick={() => stop(run)}>
            Stop
          </Button>
        )}
      </Header>
      <div className="subagents-status text-xs text-muted-foreground" data-state={run.state}>
        {bot && <Blob {...bot} size={18} />}
        <span className="subagents-dot" aria-hidden="true" />
        <span>
          {bot ? `${bot.name}'s subagent · ` : ""}
          {word[run.state]} · {took}
          {run.state === "working" && run.tool ? ` · ${run.tool}` : ""}
        </span>
      </div>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-4">
              <Message align="end">
                <MessageContent>
                  <p className="text-right text-xs text-muted-foreground">{bot ? `${bot.name}'s task` : "Its task"}</p>
                  <Bubble align="end" variant="muted">
                    <BubbleContent className="whitespace-pre-wrap">{run.task}</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
              {turns.map((turn) => (
                <Message key={turn.messageId}>
                  <MessageContent>
                    <Reply turn={turn} />
                  </MessageContent>
                </Message>
              ))}
              {end && <p className={`text-sm ${run.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{end}</p>}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}

// subagents_start in a reply: what it started, how it's going, and Open.
function Started({ call: started }) {
  const { Button } = ui;
  const id = /\bs:(\d+)\b/.exec(typeof started.output === "string" ? started.output : "")?.[1];
  const run = usePoll(id ? `runs/${id}` : null, (r) => r.state === "working");
  useEffect(() => void (id && changed()), [id]);
  if (!started.done) return <p className="text-sm text-muted-foreground">Starting a subagent…</p>;
  if (!id) return <p className="text-sm text-muted-foreground">{started.error ?? started.output}</p>;
  const title = run?.title ?? started.input?.title ?? "A subagent";
  return (
    <div className="subagents-card" data-state={run?.state ?? "working"}>
      <span className="subagents-dot" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm">Started subagent: {title}</span>
      <span className="text-xs text-muted-foreground">{run === null ? "Gone" : word[run?.state ?? "working"]}</span>
      {run && (
        <Button type="button" size="xs" variant="outline" onClick={() => go(screenOf(run))}>
          Open
        </Button>
      )}
    </div>
  );
}

export default function setup(app) {
  app.botPanel(Panel);
  app.route("/:bot/:id", Thread);
  app.toolView("start", Started, { open: true });
}
