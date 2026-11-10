// Mermaid diagrams in the app: each ```mermaid block a reply, a page, a room, or the library shows draws with Pele, in a
// worker of its own, into a shadow root, in the app's own colors and font (docs/_completed/phases/plugin-mermaid.md).
// Built into page.js; see the README.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ui } from "@fxbot/app";

const limit = 3000; // ms a render may take before its worker is stopped
const every = 200; // ms between redraws while a fence is still open
const kept = 50; // drawings kept, by source and width

let version = "";

// The worker, made with the first diagram: Pele from this plugin's route, as a blob, so it needs no request of its own,
// imported by a second blob that answers each job. The app's font goes in first, so labels are measured in the font they
// show in; without it, both use system-ui.
const workerCode = (pele) => `
import { PeleError, render } from ${JSON.stringify(pele)};
let font = "system-ui, sans-serif";
self.onmessage = async ({ data }) => {
  if (data.fonts) {
    try {
      for (const face of data.fonts) self.fonts.add(await new FontFace(data.family, face.bytes, face.descriptors).load());
      if (data.fonts.length) font = JSON.stringify(data.family) + ", system-ui, sans-serif";
    } catch {}
    return self.postMessage({ font });
  }
  try {
    const { svg, type, width, height } = render(data.code, { links: false, images: false, idPrefix: "d-", maxWidth: data.width, fontFamily: font });
    self.postMessage({ id: data.id, svg, type, width, height, font });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof PeleError ? error.message : "Pele failed: " + (error && error.message || error) });
  }
};`;

// The @font-face rules of the app's own font, the first of the body's, with each file's bytes.
async function appFont() {
  const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const rules = [];
  const walk = (list, base) => {
    for (const rule of list) {
      if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim() === family) rules.push([rule, base]);
      else if (rule.cssRules) walk(rule.cssRules, base);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules, sheet.href ?? location.href);
    } catch {}
  }
  const fonts = [];
  for (const [rule, base] of rules) {
    const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src"))?.[1];
    if (!url) continue;
    const bytes = await fetch(new URL(url, base)).then((res) => (res.ok ? res.arrayBuffer() : null), () => null);
    if (!bytes) continue;
    const descriptors = {};
    for (const [css, key] of [["unicode-range", "unicodeRange"], ["font-weight", "weight"], ["font-style", "style"], ["font-stretch", "stretch"]]) {
      const value = rule.style.getPropertyValue(css);
      if (value) descriptors[key] = value;
    }
    fonts.push({ bytes, descriptors });
  }
  return { family, fonts };
}

let started; // the worker, once it's ready, and the font it measures with
let pele; // Pele's blob URL, kept for a new worker after one is stopped
let next = 0;
let queue = Promise.resolve();
const drawings = new Map();

async function start() {
  if (!pele) {
    const res = await api(`pele.js?v=${encodeURIComponent(version)}`);
    if (!res.ok) throw new Error(`Pele didn't load: HTTP ${res.status}`);
    pele = URL.createObjectURL(new Blob([await res.text()], { type: "text/javascript" }));
  }
  const worker = new Worker(URL.createObjectURL(new Blob([workerCode(pele)], { type: "text/javascript" })), { type: "module" });
  const { family, fonts } = await appFont().catch(() => ({ family: "", fonts: [] }));
  const font = await new Promise((done, fail) => {
    worker.onmessage = ({ data }) => done(data.font);
    worker.onerror = (event) => fail(new Error(event.message || "The diagram worker didn't start."));
    worker.postMessage({ family, fonts }, fonts.map((face) => face.bytes));
  });
  return { worker, font };
}

// One render, after the one before it. A render that takes too long stops its worker, and the next starts another.
function render(code, width) {
  const key = `${width}\n${code}`;
  if (drawings.has(key)) {
    const drawing = drawings.get(key);
    drawings.delete(key);
    drawings.set(key, drawing);
    return Promise.resolve(drawing);
  }
  const run = async () => {
    started ??= start();
    const { worker } = await started;
    const id = ++next;
    return new Promise((done) => {
      const timer = setTimeout(() => {
        worker.terminate();
        started = undefined;
        done({ error: `This diagram took longer than ${limit / 1000} seconds to draw.`, slow: true });
      }, limit);
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        clearTimeout(timer);
        done(data);
      };
      worker.postMessage({ id, code, width });
    });
  };
  const result = queue.then(run, run).catch((error) => {
    started = undefined;
    return { error: error.message };
  });
  queue = result;
  return result.then((drawing) => {
    drawings.set(key, drawing);
    if (drawings.size > kept) drawings.delete(drawings.keys().next().value);
    return drawing;
  });
}

// What goes in the shadow root: Pele's SVG, read as SVG, which runs nothing, keeping only drawing elements, with no event
// handlers, links, or outside URLs. A second check on what Pele makes, which has none of them.
const svgNs = "http://www.w3.org/2000/svg";
const drawing = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc", "defs", "marker", "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "style", "symbol", "filter", "fegaussianblur", "feoffset", "feflood", "fecomposite", "femerge", "femergenode", "fedropshadow", "feblend", "fecolormatrix"]);
const outside = /url\(\s*["']?(?!#)|@import|expression\(/i;
function clean(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.localName !== "svg" || root.namespaceURI !== svgNs || doc.getElementsByTagName("parsererror").length) return null;
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (el.namespaceURI !== svgNs || !drawing.has(el.localName.toLowerCase()) || (el.localName === "style" && outside.test(el.textContent))) {
      el.remove();
      continue;
    }
    for (const { name, value } of [...el.attributes]) if (/^on/i.test(name) || /href$/i.test(name) || outside.test(value)) el.removeAttribute(name);
  }
  return document.importNode(root, true);
}

// A color the page computes, such as oklch(…), as hex, for an SVG that leaves the app.
let probe;
function hex(color) {
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color.trim();
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  const rgb = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return a === 255 ? rgb : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}
const colors = ["--pele-bg", "--pele-fg", "--pele-muted", "--pele-line", "--pele-surface", "--pele-surface-alt", "--pele-border", "--pele-accent", ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--pele-series-${n}`)];

// The diagram as a file that looks the same on its own: today's colors and the font written onto its root.
function download(node, host, type) {
  const svg = node.cloneNode(true);
  const style = getComputedStyle(host);
  const values = colors.map((name) => `${name}:${hex(style.getPropertyValue(name))}`);
  svg.setAttribute("style", [svg.getAttribute("style"), ...values, `--pele-radius:${style.getPropertyValue("--pele-radius")}`, `--pele-font:${style.getPropertyValue("--pele-font")}`].join(";"));
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })), download: `${type || "diagram"}.svg` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
// Lucide's code-xml, workflow, copy, check, download, and maximize-2.
const icons = {
  code: <Icon><path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" /></Icon>,
  diagram: <Icon><rect width="8" height="8" x="3" y="3" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /><rect width="8" height="8" x="13" y="13" rx="2" /></Icon>,
  copy: <Icon><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>,
  copied: <Icon><path d="M20 6 9 17l-5-5" /></Icon>,
  download: <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></Icon>,
  expand: <Icon><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" /></Icon>,
};
const names = { flowchart: "Flowchart", sequence: "Sequence diagram", class: "Class diagram", state: "State diagram", er: "ER diagram", gantt: "Gantt chart", pie: "Pie chart", mindmap: "Mind map", timeline: "Timeline" };

function Tool({ label, onClick, pressed, children }) {
  return (
    <ui.Button type="button" variant="ghost" size="icon-sm" className="mermaid-tool" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </ui.Button>
  );
}

// An SVG in a shadow root of its own: its styles stay in it, and the app's colors reach it through the --pele variables.
function Picture({ node, wide }) {
  const host = useRef(null);
  const root = useRef(null);
  useLayoutEffect(() => {
    root.current ??= host.current.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host{display:block}svg{display:block;margin:0 auto;${wide ? "max-width:none!important" : ""}}`;
    root.current.replaceChildren(style, node.cloneNode(true));
  }, [node, wide]);
  return <div ref={host} className="mermaid-picture" />;
}

function Diagram({ code, incomplete }) {
  const card = useRef(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(null); // { node, type, font }
  const [error, setError] = useState("");
  const [view, setView] = useState("diagram");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const last = useRef({ at: 0, seq: 0, accepted: 0 });
  const latest = useRef(code);
  latest.current = code;

  // The width the diagram has, in steps of 16 pixels, so a small change doesn't redraw it.
  useEffect(() => {
    const el = card.current;
    let timer;
    const measure = () => setWidth(Math.max(160, Math.floor((el.clientWidth - 32) / 16) * 16));
    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    observer.observe(el);
    return () => (observer.disconnect(), clearTimeout(timer));
  }, []);

  // Draws the newest text: at most every 200 ms while the fence is open, keeping the last drawing that worked, and at once
  // when it's closed. An error shows only once the fence is closed, and only for the text as it is.
  useEffect(() => {
    if (!width) return;
    const wait = incomplete ? Math.max(0, last.current.at + every - Date.now()) : 0;
    const timer = setTimeout(async () => {
      last.current.at = Date.now();
      const seq = ++last.current.seq;
      const result = await render(code, width);
      if (seq < last.current.accepted) return;
      if (result.svg) {
        const node = clean(result.svg);
        if (node) {
          last.current.accepted = seq;
          setShown({ node, type: result.type, font: result.font });
          setError("");
          return;
        }
        result.error = "Pele's drawing wasn't an SVG.";
      }
      if (!incomplete && code === latest.current) {
        last.current.accepted = seq;
        setError(result.error);
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [code, width, incomplete]);

  const copy = () =>
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const label = names[shown?.type] ?? "Diagram";
  const failed = Boolean(error) && !incomplete;
  const showCode = failed || view === "code";
  const style = shown?.font ? { "--pele-font": shown.font } : undefined;

  return (
    <div ref={card} className="mermaid-card" data-state={failed ? "failed" : shown ? "drawn" : "drawing"} style={style}>
      <div className="mermaid-tools">
        {shown && !failed && (
          <Tool label={view === "code" ? "Show the diagram" : "Show the code"} pressed={view === "code"} onClick={() => setView(view === "code" ? "diagram" : "code")}>
            {view === "code" ? icons.diagram : icons.code}
          </Tool>
        )}
        <Tool label={copied ? "Copied" : "Copy the code"} onClick={copy}>
          {copied ? icons.copied : icons.copy}
        </Tool>
        {shown && !failed && (
          <>
            <Tool label="Download as SVG" onClick={() => download(shown.node, card.current, shown.type)}>
              {icons.download}
            </Tool>
            <Tool label="Expand" onClick={() => setOpen(true)}>
              {icons.expand}
            </Tool>
          </>
        )}
      </div>
      {showCode ? (
        <pre className="mermaid-code">
          <code>{code}</code>
        </pre>
      ) : shown ? (
        <div role="img" aria-label={label}>
          <Picture node={shown.node} />
        </div>
      ) : (
        <p className="mermaid-drawing">Drawing a diagram…</p>
      )}
      {failed && (
        <div className="mermaid-error" role="status">
          <p>This diagram didn't draw.</p>
          <pre>{error}</pre>
        </div>
      )}
      {shown && (
        <ui.Dialog open={open} onOpenChange={setOpen}>
          <ui.DialogContent className="mermaid-dialog">
            <ui.DialogTitle>{label}</ui.DialogTitle>
            <div className="mermaid-dialog-body" style={style}>
              <Picture node={shown.node} wide />
            </div>
          </ui.DialogContent>
        </ui.Dialog>
      )}
    </div>
  );
}

export default function setup(app) {
  version = app.version;
  app.codeBlock("mermaid", Diagram);
}
