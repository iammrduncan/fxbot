// How herdr's tools show in a reply, the plugin's tab in Settings, and herdr's own screen in a terminal: the whole of
// it, or one agent attached, where herdr draws everything and takes every key (docs/phases/herdr-screen.md). An agent
// on another machine, which herdr can't attach to from here, has a screen read from herdr, with keys. A chat's stream carries only the start of a tool's result, so the
// agents card shows the list's summary and loads the agents themselves on Show, and a prompt's card follows its watch
// by the id its result starts with. Built into page.js; see the README.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, go, ui } from "@fxbot/app";

// xterm.js, loaded once a terminal opens, since most pages never show one: it's most of the plugin's page code. The
// server keeps it, fxbot/xterm.js, gzipped, at an address with the plugin's version, which a browser keeps.
let version = "";
let xterm;
const loadXterm = () =>
  (xterm ??= api(`xterm.js?v=${encodeURIComponent(version)}`)
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`xterm.js didn't load: HTTP ${res.status}`))))
    .then((code) => {
      const module = { exports: {} };
      new Function("module", "exports", code)(module, module.exports);
      return module.exports;
    })
    .catch((error) => ((xterm = undefined), Promise.reject(error))));

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
  return answer;
}

const statusText = { working: "Working", blocked: "Waiting for you", done: "Done", idle: "Ready", unknown: "Unknown" };
const dot = { working: "bg-primary", blocked: "bg-destructive", done: "bg-muted-foreground", idle: "bg-muted-foreground", unknown: "bg-border" };
const firstLine = (text) => (text ?? "").split("\n")[0];

// An agent's terminal, in the page: /herdr/agents/<machine>/<pane>.
const terminalOf = (machine, pane) => `/herdr/agents/${encodeURIComponent(machine || "local")}/${encodeURIComponent(pane)}`;
const open = (href) => (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  go(href);
};

// Each machine's agents, and with `big`, roomier rows for the agents screen. Each row opens the agent's terminal.
function Table({ rows, big = false }) {
  const machines = [...new Set(rows.map((r) => r.machine))];
  return (
    <div className="grid gap-3">
      {machines.map((machine) => (
        <div key={machine} className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{machine === "local" ? "Local" : machine}</p>
          {rows
            .filter((r) => r.machine === machine)
            .map((r, i) =>
              r.unreachable ? (
                <p key={i} className="text-xs text-destructive">
                  Didn't answer: {r.unreachable}
                </p>
              ) : (
                <a
                  key={r.pane || r.target}
                  href={terminalOf(r.machine, r.pane || r.target)}
                  onClick={open(terminalOf(r.machine, r.pane || r.target))}
                  className={`flex min-w-0 items-center gap-2 rounded-md hover:bg-muted ${big ? "px-2 py-2 text-sm" : "text-xs"}`}
                  title="Open its terminal"
                >
                  <span className={`size-2 shrink-0 rounded-full ${dot[r.status] ?? dot.unknown}`} />
                  <span className="shrink-0">
                    {[r.workspace, r.tab].filter(Boolean).join(" · ") || r.target}
                    {r.label ? ` "${r.label}"` : ""}
                    {r.session ? ` (${r.session})` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{r.kind}</span>
                  <span className={`shrink-0 ${r.status === "blocked" ? "font-medium text-destructive" : ""}`}>{statusText[r.status] ?? r.status}</span>
                  <span className="min-w-0 truncate text-muted-foreground" title={r.folder}>
                    {r.title || r.folder}
                  </span>
                </a>
              ),
            )}
        </div>
      ))}
    </div>
  );
}

// --- The owner's terminals.
// herdr's screen is text with colors (SGR) only: no cursor moves. Each run of text keeps its style; any other escape
// a terminal could send is dropped.
const palette = ["#1e1e1e", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#d4d4d4", "#7f848e", "#f47c86", "#a8d68a", "#f0cf8a", "#7cc0f5", "#d79ce8", "#6fd0dc", "#ffffff"];
const screenColors = { background: "#0f1115", color: "#d4d4d4" };
function color256(n) {
  if (n < 16) return palette[n];
  if (n >= 232) return `rgb(${8 + (n - 232) * 10},${8 + (n - 232) * 10},${8 + (n - 232) * 10})`;
  const c = (x) => (x ? 55 + x * 40 : 0);
  const m = n - 16;
  return `rgb(${c(Math.floor(m / 36))},${c(Math.floor(m / 6) % 6)},${c(m % 6)})`;
}
function sgr(style, codes) {
  let next = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const n = codes[i];
    if (n === 0) next = {};
    else if (n === 1) next.bold = true;
    else if (n === 2) next.dim = true;
    else if (n === 3) next.italic = true;
    else if (n === 4) next.underline = true;
    else if (n === 7) next.inverse = true;
    else if (n === 22) next.bold = next.dim = false;
    else if (n === 23) next.italic = false;
    else if (n === 24) next.underline = false;
    else if (n === 27) next.inverse = false;
    else if (n >= 30 && n <= 37) next.fg = palette[n - 30];
    else if (n >= 90 && n <= 97) next.fg = palette[n - 82];
    else if (n >= 40 && n <= 47) next.bg = palette[n - 40];
    else if (n >= 100 && n <= 107) next.bg = palette[n - 92];
    else if (n === 39) next.fg = undefined;
    else if (n === 49) next.bg = undefined;
    else if ((n === 38 || n === 48) && codes[i + 1] === 5) (next[n === 38 ? "fg" : "bg"] = color256(codes[i + 2] ?? 0)), (i += 2);
    else if ((n === 38 || n === 48) && codes[i + 1] === 2) (next[n === 38 ? "fg" : "bg"] = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`), (i += 4);
  }
  return next;
}
function runs(text) {
  const out = [];
  const escape = /\x1b\[([0-9;:]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[@-_]?|[\r\x00-\x08\x0b-\x1f\x7f]/g;
  let style = {};
  let at = 0;
  for (let m; (m = escape.exec(text)); ) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), style });
    at = escape.lastIndex;
    if (m[2] === "m") style = sgr(style, (m[1] || "0").split(/[;:]/).map((n) => Number(n) || 0));
  }
  if (at < text.length) out.push({ text: text.slice(at), style });
  return out;
}
function Screen({ text }) {
  return runs(text).map((run, i) => {
    const s = run.style;
    const fg = s.inverse ? (s.bg ?? screenColors.background) : s.fg;
    const bg = s.inverse ? (s.fg ?? screenColors.color) : s.bg;
    const css = { color: fg, background: bg, fontWeight: s.bold ? 700 : undefined, opacity: s.dim ? 0.6 : undefined, fontStyle: s.italic ? "italic" : undefined, textDecoration: s.underline ? "underline" : undefined };
    return Object.values(css).some((v) => v !== undefined) ? <span key={i} style={css}>{run.text}</span> : run.text;
  });
}

// A key from the keyboard, as herdr names it, or text to type. Null for what herdr has no name for.
function keyOf(event) {
  if (event.metaKey || event.isComposing) return null;
  const shift = event.shiftKey ? "shift+" : "";
  const named = { Enter: "enter", Escape: "esc", Backspace: "backspace", Tab: event.shiftKey ? "shift+tab" : "tab", ArrowUp: `${shift}up`, ArrowDown: `${shift}down`, ArrowLeft: `${shift}left`, ArrowRight: `${shift}right` }[event.key];
  if (named && !event.ctrlKey && !event.altKey) return { key: named };
  if (/^F([1-9]|1[0-2])$/.test(event.key)) return { key: event.key.toLowerCase() };
  if (event.key.length !== 1) return null;
  if (event.ctrlKey || event.altKey) return /^[!-~]$/.test(event.key) ? { key: `${event.ctrlKey ? "ctrl" : "alt"}+${event.key.toLowerCase()}` } : null;
  return { text: event.key };
}
const keyRow = [
  ["Esc", "esc"],
  ["Tab", "tab"],
  ["↑", "up"],
  ["↓", "down"],
  ["←", "left"],
  ["→", "right"],
  ["Enter", "enter"],
  ["Ctrl+C", "ctrl+c"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
];

// --- herdr's own client in a terminal: what it draws comes over the plugin's socket, and every key goes back.
const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const terminalSocket = (query) => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/plugins/herdr/terminal?${query}`;
// Mobile, for a phone: keys its keyboard lacks, quick answers, and a line to send text with the phone's own keyboard,
// its corrections and dictation. On by default where the screen is touched, and kept for this device.
const extras = [
  ["Esc", "\x1b"],
  ["Tab", "\t"],
  ["↑", "A"],
  ["↓", "B"],
  ["←", "D"],
  ["→", "C"],
  ["Enter", "\r"],
  ["^C", "\x03"],
];
const answers = ["1", "2", "3", "y", "n"];
function useMobile() {
  const [on, setOn] = useState(() => {
    try {
      const kept = localStorage.getItem("herdr-mobile");
      return kept === null ? touch : kept === "1";
    } catch {
      return touch;
    }
  });
  const set = (next) => {
    try {
      localStorage.setItem("herdr-mobile", next ? "1" : "0");
    } catch {}
    setOn(next);
  };
  return [on, set];
}
function MobileSwitch({ on, set }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <ui.Switch checked={on} onCheckedChange={set} aria-label="Mobile" />
      Mobile
    </label>
  );
}
// Whether the page is on screen: not a background tab, a minimized window, or a phone's locked screen or other app.
function useShown() {
  const [shown, setShown] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const changed = () => setShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  return shown;
}
const reconnecting = "Connecting again…";
// The terminal is open while the page is on screen. Hidden, it closes, so a phone in a pocket holds no herdr client,
// and shown again it opens a new one, which draws herdr as it is now: a connection left open while the app slept could
// look open and carry nothing, as web pairing's could after it connected again. One that drops, or fxbot reloading the
// plugin, connects again by itself, up to five times, a little later each time. herdr's client ending, or a refusal,
// says why, with Connect again.
function Live({ pane, mobile }) {
  const { Button } = ui;
  const box = useRef(null);
  const line = useRef(null);
  const [problem, setProblem] = useState("");
  const [round, setRound] = useState(0);
  const [ctrl, setCtrl] = useState(false);
  const [text, setText] = useState("");
  const held = useRef(false);
  held.current = ctrl;
  const shown = useShown();
  const tries = useRef(0);
  useEffect(() => {
    tries.current = 0;
    setProblem("");
  }, [shown]);
  useEffect(() => {
    if (!shown) return;
    let gone = false;
    let stop = () => {};
    loadXterm().then(
      ({ Terminal, FitAddon }) => void (gone || (stop = start(Terminal, FitAddon))),
      (error) => setProblem(error.message),
    );
    return () => ((gone = true), stop());
  }, [pane, round, shown]);
  // The terminal and its socket, once xterm.js is here. It answers its own cleanup.
  function start(XTerm, FitAddon) {
    const term = new XTerm({ fontSize: touch ? 12 : 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", cursorBlink: true, theme: { background: "#0f1115" } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(box.current);
    fit.fit();
    const socket = new WebSocket(terminalSocket(new URLSearchParams({ rows: String(term.rows), cols: String(term.cols), ...(pane ? { pane } : {}) })));
    socket.binaryType = "arraybuffer";
    const send = (data) => socket.readyState === WebSocket.OPEN && socket.send(typeof data === "string" ? new TextEncoder().encode(data) : data);
    const resize = () => {
      if (!box.current?.offsetWidth) return;
      fit.fit();
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ rows: term.rows, cols: term.cols }));
    };
    let mine = true;
    let again;
    socket.onopen = () => ((tries.current = 0), setProblem(""), resize(), touch || term.focus());
    socket.onmessage = (event) => term.write(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
    socket.onclose = (event) => {
      if (!mine) return;
      if ((event.code === 1006 || event.code === 1001) && tries.current < 5) {
        setProblem(reconnecting);
        again = setTimeout(() => setRound((n) => n + 1), 1000 * 2 ** tries.current++);
      } else setProblem(event.reason || "herdr's screen closed.");
    };
    const typed = term.onData((data) => {
      if (held.current && data.length === 1) (setCtrl(false), (data = String.fromCharCode(data.toUpperCase().charCodeAt(0) & 0x1f)));
      send(data);
    });
    const raw = term.onBinary((data) => send(Uint8Array.from(data, (c) => c.charCodeAt(0))));
    const watch = new ResizeObserver(resize);
    watch.observe(box.current);
    // A drag on a touch screen scrolls as the wheel does: herdr's client asks for the mouse, and a wheel's report goes.
    const el = box.current;
    let y = null;
    let moved = 0;
    const begin = (event) => ((y = event.touches[0].clientY), (moved = 0));
    const move = (event) => {
      if (y === null) return;
      const at = event.touches[0];
      moved += at.clientY - y;
      y = at.clientY;
      const cell = el.clientHeight / term.rows;
      while (Math.abs(moved) >= cell) {
        const back = moved > 0;
        moved += back ? -cell : cell;
        if (term.modes.mouseTrackingMode === "none") term.scrollLines(back ? -1 : 1);
        else {
          const rect = el.getBoundingClientRect();
          const col = Math.min(term.cols, Math.max(1, Math.floor(((at.clientX - rect.left) / el.clientWidth) * term.cols) + 1));
          const row = Math.min(term.rows, Math.max(1, Math.floor((at.clientY - rect.top) / cell) + 1));
          send(`\x1b[<${back ? 64 : 65};${col};${row}M`);
        }
      }
      event.preventDefault();
    };
    const end = () => void (y = null);
    el.addEventListener("touchstart", begin, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    line.current = { send, term };
    return () => {
      el.removeEventListener("touchstart", begin);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      mine = false;
      clearTimeout(again);
      watch.disconnect();
      typed.dispose();
      raw.dispose();
      socket.close();
      term.dispose();
      line.current = null;
    };
  }
  // A key from the row. On a phone, focusing the terminal would bring up the keyboard, so it doesn't.
  const press = (key) => {
    const live = line.current;
    if (!live) return;
    const arrow = /^[ABCD]$/.test(key);
    live.send(arrow ? `\x1b${live.term.modes.applicationCursorKeysMode ? "O" : "["}${key}` : key);
    if (!touch) live.term.focus();
  };
  const sendText = (event) => {
    event.preventDefault();
    const words = text.replace(/[\x00-\x1f\x7f]/g, " ");
    if (!words.trim() || !line.current) return;
    line.current.send(`${words}\r`);
    setText("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 6 }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0, background: "#0f1115", borderRadius: 8, overflow: "hidden" }}>
        <div ref={box} style={{ position: "absolute", inset: 6 }} aria-label={pane ? "The agent's terminal, in herdr" : "herdr"} />
        {problem && (
          <div style={{ position: "absolute", inset: "auto 0 12px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }} className="text-sm">
            <span style={{ color: "#d4d4d4" }} role="status">
              {problem}
            </span>
            {problem !== reconnecting && (
              <Button size="sm" variant="secondary" onClick={() => ((tries.current = 0), setRound((n) => n + 1))}>
                Connect again
              </Button>
            )}
          </div>
        )}
      </div>
      {mobile && (
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Keys">
            {extras.map(([label, key]) => (
              <Button key={label} type="button" size="sm" variant="outline" className="font-mono" onMouseDown={(e) => e.preventDefault()} onClick={() => press(key)}>
                {label}
              </Button>
            ))}
            <Button type="button" size="sm" variant={ctrl ? "default" : "outline"} className="font-mono" aria-pressed={ctrl} onMouseDown={(e) => e.preventDefault()} onClick={() => setCtrl(!ctrl)}>
              Ctrl
            </Button>
            {answers.map((key) => (
              <Button key={key} type="button" size="sm" variant="secondary" className="font-mono" aria-label={`Answer ${key}`} onMouseDown={(e) => e.preventDefault()} onClick={() => press(key)}>
                {key}
              </Button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={sendText}>
            <ui.Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to send, then Enter" aria-label="Text to send" autoComplete="off" enterKeyHint="send" />
            <Button type="submit" size="sm">
              Send
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

// The whole herdr screen, as in a terminal on the machine.
function HerdrScreen() {
  const { Button, Header } = ui;
  const [mobile, setMobile] = useMobile();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Header title="herdr">
        <MobileSwitch on={mobile} set={setMobile} />
        <Button size="sm" variant="ghost" onClick={() => go("/herdr/agents")}>
          Agents
        </Button>
      </Header>
      <div style={{ display: "flex", flex: 1, minHeight: 0, padding: "0 12px 12px" }}>
        <Live mobile={mobile} />
      </div>
    </div>
  );
}

// One agent: attached, with herdr's own client, on the machine fxbot runs on; read from herdr, with keys, on another.
function AgentScreen({ params }) {
  const { Button, Header } = ui;
  const machine = params.machine || "local";
  const [who, setWho] = useState(null);
  const [mobile, setMobile] = useMobile();
  useEffect(() => {
    call(`agents?machine=${encodeURIComponent(machine)}`).then(
      (list) => {
        const named = params.pane.toLowerCase();
        const rows = list.rows.filter((r) => r.pane);
        setWho(rows.find((r) => r.pane === params.pane || r.target === params.pane) ?? rows.find((r) => r.session === params.pane || r.label.toLowerCase() === named) ?? { missing: true });
      },
      () => setWho({ missing: true }),
    );
  }, [machine, params.pane]);
  if (machine !== "local") return <Snapshot params={params} />;
  const pane = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/.test(params.pane) ? params.pane : who?.pane;
  const title = who && !who.missing ? `${who.kind ? who.kind[0].toUpperCase() + who.kind.slice(1) : "An agent"}${who.label ? ` "${who.label}"` : ""}${who.session ? ` (${who.session})` : ""}` : params.pane;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Header title={title}>
        <MobileSwitch on={mobile} set={setMobile} />
        <Button size="sm" variant="ghost" onClick={() => go("/herdr")}>
          herdr
        </Button>
      </Header>
      <div style={{ display: "flex", flex: 1, minHeight: 0, padding: "0 12px 12px" }}>
        {pane ? <Live pane={pane} mobile={mobile} /> : <p className="text-sm text-muted-foreground">{who?.missing ? `herdr doesn't list ${params.pane} on Local.` : "Asking herdr…"}</p>}
      </div>
    </div>
  );
}

// An agent on another machine: its screen, asked every second while it's in view, and what the owner types, in order.
function Snapshot({ params }) {
  const { Button, Header, Input } = ui;
  const machine = params.machine || "local";
  const [screen, setScreen] = useState(null);
  const [who, setWho] = useState(null);
  const [error, setError] = useState("");
  const [earlier, setEarlier] = useState(false);
  const [line, setLine] = useState("");
  const [focused, setFocused] = useState(false);
  const queue = useRef([]);
  const sending = useRef(false);
  const poke = useRef(() => {});
  const box = useRef(null);
  const stick = useRef(true);
  // A link may name the agent by its name: its pane comes from its machine's list.
  const pane = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/.test(params.pane) ? params.pane : who?.pane;
  const query = `machine=${encodeURIComponent(machine)}&pane=${encodeURIComponent(pane ?? "")}`;

  useEffect(() => {
    if (!pane) return;
    let stopped = false;
    let timer;
    const look = async () => {
      clearTimeout(timer);
      if (stopped) return;
      if (document.visibilityState === "visible")
        await call(`screen?${query}${earlier ? "&earlier=1" : ""}`).then(
          (s) => !stopped && (setScreen(s), setError("")),
          (e) => !stopped && setError(e.message),
        );
      if (!stopped) timer = setTimeout(look, 1000);
    };
    poke.current = () => (clearTimeout(timer), (timer = setTimeout(look, 150)));
    look();
    const shown = () => document.visibilityState === "visible" && poke.current();
    document.addEventListener("visibilitychange", shown);
    return () => ((stopped = true), clearTimeout(timer), document.removeEventListener("visibilitychange", shown));
  }, [query, earlier, pane]);
  // Who it is, in herdr's words, from its machine's list.
  useEffect(() => {
    call(`agents?machine=${encodeURIComponent(machine)}`).then(
      (list) => {
        const named = params.pane.toLowerCase();
        const rows = list.rows.filter((r) => r.pane);
        setWho(rows.find((r) => r.pane === params.pane || r.target === params.pane) ?? rows.find((r) => r.session === params.pane || r.label.toLowerCase() === named) ?? { missing: true });
      },
      (e) => setError(e.message),
    );
  }, [machine, params.pane]);
  // A screen stays at its bottom, as a terminal does, unless the owner scrolled up.
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [screen?.text]);

  // What the owner types goes out in order: runs of text together, then runs of keys together.
  async function flush() {
    if (sending.current) return;
    sending.current = true;
    try {
      while (queue.current.length) {
        const first = queue.current[0];
        const run = [];
        while (queue.current.length && ("text" in queue.current[0]) === ("text" in first) && run.length < 32) run.push(queue.current.shift());
        const body = "text" in first ? { text: run.map((r) => r.text).join("") } : { keys: run.map((r) => r.key) };
        await call("keys", "POST", { machine, pane, ...body }).then(() => setError(""), (e) => setError(e.message));
      }
    } finally {
      sending.current = false;
      poke.current();
    }
  }
  const send = (...items) => pane && (queue.current.push(...items), void flush());
  const onKeyDown = (event) => {
    const item = keyOf(event);
    if (!item) return;
    event.preventDefault();
    send(item);
  };
  const onPaste = (event) => {
    const text = event.clipboardData.getData("text").replace(/\r?\n/g, " ").replace(/[\x00-\x1f\x7f]/g, "");
    event.preventDefault();
    if (text) send(...(text.match(/[\s\S]{1,4000}/g) ?? []).map((t) => ({ text: t })));
  };
  const submit = (event) => {
    event.preventDefault();
    const text = line.replace(/[\x00-\x1f\x7f]/g, "");
    setLine("");
    send(...(text ? [{ text }] : []), { key: "enter" });
  };

  const status = screen?.status ?? who?.status;
  const title = who && !who.missing ? `${who.kind ? who.kind[0].toUpperCase() + who.kind.slice(1) : "An agent"}${who.label ? ` "${who.label}"` : ""}${who.session ? ` (${who.session})` : ""}` : params.pane;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Header title={title}>
        <Button size="sm" variant="ghost" onClick={() => go("/herdr/agents")}>
          All agents
        </Button>
      </Header>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, padding: "0 12px 12px" }}>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className={`size-2 shrink-0 rounded-full ${dot[status] ?? dot.unknown}`} />
          <span className={status === "blocked" ? "font-medium text-destructive" : "text-foreground"}>{statusText[status] ?? "…"}</span>
          <span>
            {[who?.tab && (/^\d+$/.test(who.tab) ? `tab ${who.tab}` : who.tab), who?.workspace, machine === "local" ? "Local" : machine].filter(Boolean).join(" · ")}
          </span>
          <label className="ml-auto flex items-center gap-2">
            <ui.Switch checked={earlier} onCheckedChange={setEarlier} aria-label="Earlier lines" />
            Earlier lines
          </label>
        </p>
        <pre
          ref={box}
          tabIndex={0}
          role="textbox"
          aria-label="The agent's terminal: click, then type"
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onScroll={(e) => (stick.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 24)}
          className={`min-h-0 flex-1 overflow-auto rounded-md p-3 font-mono text-xs leading-snug outline-none ${focused ? "ring-2 ring-primary" : ""}`}
          style={{ ...screenColors, whiteSpace: "pre", margin: 0 }}
        >
          {screen ? <Screen text={screen.text} /> : who?.missing && !pane ? `herdr doesn't list ${params.pane} on ${machine === "local" ? "Local" : machine}.` : error ? "" : "Asking herdr…"}
        </pre>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-1" role="group" aria-label="Keys">
          {keyRow.map(([label, key]) => (
            <Button key={key} type="button" size="xs" variant="outline" className="font-mono" onClick={() => send({ key })}>
              {label}
            </Button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={submit}>
          <Input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Type to it, then Send presses Enter" aria-label="Type to the agent" autoComplete="off" autoCapitalize="off" />
          <Button type="submit" size="sm">
            Send
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{focused ? "Your keys go to the agent. Click outside the screen to stop." : "Click the screen to type into it, or use the keys and the line below."}</p>
      </div>
    </div>
  );
}

// Every machine's agents, asked again every 5 seconds while the screen is in view.
function AgentsScreen() {
  const { Header } = ui;
  const [now, setNow] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    let timer;
    const look = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await call("agents").then((list) => !stopped && (setNow(list), setError("")), (e) => !stopped && setError(e.message));
      if (!stopped) timer = setTimeout(look, 5000);
    };
    look();
    return () => ((stopped = true), clearTimeout(timer));
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Header title="herdr" />
      <div className="grid content-start gap-3 overflow-auto px-3 pb-3 text-sm" style={{ flex: 1, minHeight: 0 }}>
        {now ? (
          <>
            <p className="text-muted-foreground">{now.summary} Pick one to see its terminal and type into it.</p>
            <Table rows={now.rows} big />
          </>
        ) : (
          !error && <p className="text-muted-foreground">Asking herdr…</p>
        )}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// --- Tags: @herdr:<name> in the message box, from the agents the plugin keeps, and a sent tag as a chip.
const herdrTag = /\[@herdr:([^\]\n]*)\]\(\/herdr\/agents\/([^/\s)"]+)\/([^/\s)"]+)(?: "([^"\n]*)")?\)/g;
const search = (query) => call(`mentions?q=${encodeURIComponent(query)}`).catch(() => []);
// The agents kept, read at most every 30 seconds while a chip shows, for each chip's status now.
let kept = [];
let keptAt = 0;
const watchers = new Set();
function keep(listen) {
  watchers.add(listen);
  if (Date.now() - keptAt > 30_000) {
    keptAt = Date.now();
    void call("panes").then((list) => ((kept = list), watchers.forEach((w) => w())), () => {});
  }
  return () => void watchers.delete(listen);
}
function Tag({ match }) {
  const [, name, machine, pane, title] = match;
  const where = decodeURIComponent(machine);
  const id = decodeURIComponent(pane);
  const now = useSyncExternalStore(keep, () => kept).find((p) => p.machine === where && p.pane === id);
  const href = terminalOf(where, id);
  return (
    <a
      href={href}
      onClick={open(href)}
      title={title || `${id} on ${where}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0 6px 0 4px", borderRadius: 9999, background: "rgb(255 255 255 / 0.2)", fontWeight: 500, verticalAlign: "bottom", color: "inherit", textDecoration: "none" }}
    >
      <TerminalIcon style={{ width: 14, height: 14 }} />
      {now && <span className={`shrink-0 rounded-full ${dot[now.status] ?? dot.unknown}`} style={{ width: 6, height: 6 }} aria-label={statusText[now.status] ?? now.status} />}
      @herdr:{name}
    </a>
  );
}

function TerminalIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
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
  blocked: "Waiting for you: answer it in its terminal",
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
  const who = watch?.shown ?? `${input.agent ?? input.name ?? "An agent"}${input.machine ? ` on ${input.machine}` : ""}`;
  // The agent as the call named it, which its terminal finds on that machine.
  const agent = typeof (input.agent ?? input.name) === "string" ? (input.agent ?? input.name).trim() : "";
  const machine = watch?.machine ?? (typeof input.machine === "string" && input.machine.trim() ? input.machine.trim() : "local");
  const text = input.text ?? input.prompt;
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="font-medium">{who}</p>
      {text && <p className="line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground">{text}</p>}
      <p className={tool.error ? "text-destructive" : "text-muted-foreground"}>
        {!tool.done ? "Sending…" : watch ? (watchText[watch.state] ?? watch.state) : firstLine(tool.output)}
      </p>
      {tool.done && agent && (
        <a href={terminalOf(machine, agent)} onClick={open(terminalOf(machine, agent))} className="justify-self-start text-xs underline underline-offset-2">
          Open its terminal
        </a>
      )}
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
      {(how || state.machines.length > 0) && (
        <div className="grid gap-1">
          <p className="font-medium">Machines</p>
          {how && (
            <p className="text-muted-foreground">
              <span className="text-foreground">Local</span>: answers
            </p>
          )}
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
            <label key={machine || "local"} className="flex items-center gap-2">
              <ui.Checkbox checked={data.machines.includes(machine)} onCheckedChange={(on) => toggle(machine, on === true)} />
              {machine || "Local"}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}

export default function setup(app) {
  version = app.version;
  // A watched agent's news folds into a pill in the middle of the chat, "1 received · herdr", so it doesn't read like the
  // owner's own message. What the bot says about it is for the owner, so it stays in view.
  app.fold({ message: (id) => (/^herdr-watch-\d+(-\d+)?$/.test(id) ? { fold: "message" } : undefined) });
  app.botSettings(BotMachines);
  app.toolView("agents", Agents, { open: true });
  app.toolView("prompt", Sent, { open: true });
  app.toolView("start", Sent, { open: true });
  app.settings(Tab);
  // The owner's terminals: a button in the sidebar, the agents, and each one's terminal.
  app.nav({ label: "herdr", path: "/", icon: TerminalIcon });
  app.route("/", HerdrScreen);
  app.route("/agents", AgentsScreen);
  app.route("/agents/:machine/:pane", AgentScreen);
  // @herdr:<name> in the message box, and in a sent message. A box with an @ list, Messages', reads app.mention.
  app.mention?.({ search });
  app.said(herdrTag, Tag);
}
