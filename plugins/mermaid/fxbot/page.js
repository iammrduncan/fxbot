let react = require("react");
let _fxbot_app = require("@fxbot/app");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/page.jsx
const limit = 3e3;
const every = 200;
const kept = 50;
let version = "";
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
async function appFont() {
	const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
	const rules = [];
	const walk = (list, base) => {
		for (const rule of list) if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim() === family) rules.push([rule, base]);
		else if (rule.cssRules) walk(rule.cssRules, base);
	};
	for (const sheet of document.styleSheets) try {
		walk(sheet.cssRules, sheet.href ?? location.href);
	} catch {}
	const fonts = [];
	for (const [rule, base] of rules) {
		const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src"))?.[1];
		if (!url) continue;
		const bytes = await fetch(new URL(url, base)).then((res) => res.ok ? res.arrayBuffer() : null, () => null);
		if (!bytes) continue;
		const descriptors = {};
		for (const [css, key] of [
			["unicode-range", "unicodeRange"],
			["font-weight", "weight"],
			["font-style", "style"],
			["font-stretch", "stretch"]
		]) {
			const value = rule.style.getPropertyValue(css);
			if (value) descriptors[key] = value;
		}
		fonts.push({
			bytes,
			descriptors
		});
	}
	return {
		family,
		fonts
	};
}
let started;
let pele;
let next = 0;
let queue = Promise.resolve();
const drawings = new Map();
async function start() {
	if (!pele) {
		const res = await (0, _fxbot_app.api)(`pele.js?v=${encodeURIComponent(version)}`);
		if (!res.ok) throw new Error(`Pele didn't load: HTTP ${res.status}`);
		pele = URL.createObjectURL(new Blob([await res.text()], { type: "text/javascript" }));
	}
	const worker = new Worker(URL.createObjectURL(new Blob([workerCode(pele)], { type: "text/javascript" })), { type: "module" });
	const { family, fonts } = await appFont().catch(() => ({
		family: "",
		fonts: []
	}));
	return {
		worker,
		font: await new Promise((done, fail) => {
			worker.onmessage = ({ data }) => done(data.font);
			worker.onerror = (event) => fail(new Error(event.message || "The diagram worker didn't start."));
			worker.postMessage({
				family,
				fonts
			}, fonts.map((face) => face.bytes));
		})
	};
}
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
				started = void 0;
				done({
					error: `This diagram took longer than ${limit / 1e3} seconds to draw.`,
					slow: true
				});
			}, limit);
			worker.onmessage = ({ data }) => {
				if (data.id !== id) return;
				clearTimeout(timer);
				done(data);
			};
			worker.postMessage({
				id,
				code,
				width
			});
		});
	};
	const result = queue.then(run, run).catch((error) => {
		started = void 0;
		return { error: error.message };
	});
	queue = result;
	return result.then((drawing) => {
		drawings.set(key, drawing);
		if (drawings.size > kept) drawings.delete(drawings.keys().next().value);
		return drawing;
	});
}
const svgNs = "http://www.w3.org/2000/svg";
const drawing = new Set([
	"svg",
	"g",
	"path",
	"rect",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"text",
	"tspan",
	"title",
	"desc",
	"defs",
	"marker",
	"lineargradient",
	"radialgradient",
	"stop",
	"clippath",
	"mask",
	"pattern",
	"style",
	"symbol",
	"filter",
	"fegaussianblur",
	"feoffset",
	"feflood",
	"fecomposite",
	"femerge",
	"femergenode",
	"fedropshadow",
	"feblend",
	"fecolormatrix"
]);
const outside = /url\(\s*["']?(?!#)|@import|expression\(/i;
function clean(svg) {
	const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
	const root = doc.documentElement;
	if (root.localName !== "svg" || root.namespaceURI !== svgNs || doc.getElementsByTagName("parsererror").length) return null;
	for (const el of [root, ...root.querySelectorAll("*")]) {
		if (el.namespaceURI !== svgNs || !drawing.has(el.localName.toLowerCase()) || el.localName === "style" && outside.test(el.textContent)) {
			el.remove();
			continue;
		}
		for (const { name, value } of [...el.attributes]) if (/^on/i.test(name) || /href$/i.test(name) || outside.test(value)) el.removeAttribute(name);
	}
	return document.importNode(root, true);
}
let probe;
function hex(color) {
	probe ??= Object.assign(document.createElement("canvas"), {
		width: 1,
		height: 1
	}).getContext("2d", { willReadFrequently: true });
	probe.clearRect(0, 0, 1, 1);
	probe.fillStyle = "#000";
	probe.fillStyle = color.trim();
	probe.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
	const rgb = `#${[
		r,
		g,
		b
	].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
	return a === 255 ? rgb : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}
const colors = [
	"--pele-bg",
	"--pele-fg",
	"--pele-muted",
	"--pele-line",
	"--pele-surface",
	"--pele-surface-alt",
	"--pele-border",
	"--pele-accent",
	...[
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8
	].map((n) => `--pele-series-${n}`)
];
function download(node, host, type) {
	const svg = node.cloneNode(true);
	const style = getComputedStyle(host);
	const values = colors.map((name) => `${name}:${hex(style.getPropertyValue(name))}`);
	svg.setAttribute("style", [
		svg.getAttribute("style"),
		...values,
		`--pele-radius:${style.getPropertyValue("--pele-radius")}`,
		`--pele-font:${style.getPropertyValue("--pele-font")}`
	].join(";"));
	const link = Object.assign(document.createElement("a"), {
		href: URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })),
		download: `${type || "diagram"}.svg`
	});
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
}
const Icon = ({ children }) => (0, react_jsx_runtime.jsx)("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children
});
const icons = {
	code: (0, react_jsx_runtime.jsxs)(Icon, { children: [
		(0, react_jsx_runtime.jsx)("path", { d: "m18 16 4-4-4-4" }),
		(0, react_jsx_runtime.jsx)("path", { d: "m6 8-4 4 4 4" }),
		(0, react_jsx_runtime.jsx)("path", { d: "m14.5 4-5 16" })
	] }),
	diagram: (0, react_jsx_runtime.jsxs)(Icon, { children: [
		(0, react_jsx_runtime.jsx)("rect", {
			width: "8",
			height: "8",
			x: "3",
			y: "3",
			rx: "2"
		}),
		(0, react_jsx_runtime.jsx)("path", { d: "M7 11v4a2 2 0 0 0 2 2h4" }),
		(0, react_jsx_runtime.jsx)("rect", {
			width: "8",
			height: "8",
			x: "13",
			y: "13",
			rx: "2"
		})
	] }),
	copy: (0, react_jsx_runtime.jsxs)(Icon, { children: [(0, react_jsx_runtime.jsx)("rect", {
		width: "14",
		height: "14",
		x: "8",
		y: "8",
		rx: "2",
		ry: "2"
	}), (0, react_jsx_runtime.jsx)("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })] }),
	copied: (0, react_jsx_runtime.jsx)(Icon, { children: (0, react_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" }) }),
	download: (0, react_jsx_runtime.jsxs)(Icon, { children: [
		(0, react_jsx_runtime.jsx)("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
		(0, react_jsx_runtime.jsx)("polyline", { points: "7 10 12 15 17 10" }),
		(0, react_jsx_runtime.jsx)("line", {
			x1: "12",
			x2: "12",
			y1: "15",
			y2: "3"
		})
	] }),
	expand: (0, react_jsx_runtime.jsxs)(Icon, { children: [
		(0, react_jsx_runtime.jsx)("polyline", { points: "15 3 21 3 21 9" }),
		(0, react_jsx_runtime.jsx)("polyline", { points: "9 21 3 21 3 15" }),
		(0, react_jsx_runtime.jsx)("line", {
			x1: "21",
			x2: "14",
			y1: "3",
			y2: "10"
		}),
		(0, react_jsx_runtime.jsx)("line", {
			x1: "3",
			x2: "10",
			y1: "21",
			y2: "14"
		})
	] })
};
const names = {
	flowchart: "Flowchart",
	sequence: "Sequence diagram",
	class: "Class diagram",
	state: "State diagram",
	er: "ER diagram",
	gantt: "Gantt chart",
	pie: "Pie chart",
	mindmap: "Mind map",
	timeline: "Timeline"
};
function Tool({ label, onClick, pressed, children }) {
	return (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
		type: "button",
		variant: "ghost",
		size: "icon-sm",
		className: "mermaid-tool",
		title: label,
		"aria-label": label,
		"aria-pressed": pressed,
		onClick,
		children
	});
}
function Picture({ node, wide }) {
	const host = (0, react.useRef)(null);
	const root = (0, react.useRef)(null);
	(0, react.useLayoutEffect)(() => {
		root.current ??= host.current.attachShadow({ mode: "open" });
		const style = document.createElement("style");
		style.textContent = `:host{display:block}svg{display:block;margin:0 auto;${wide ? "max-width:none!important" : ""}}`;
		root.current.replaceChildren(style, node.cloneNode(true));
	}, [node, wide]);
	return (0, react_jsx_runtime.jsx)("div", {
		ref: host,
		className: "mermaid-picture"
	});
}
function Diagram({ code, incomplete }) {
	const card = (0, react.useRef)(null);
	const [width, setWidth] = (0, react.useState)(0);
	const [shown, setShown] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const [view, setView] = (0, react.useState)("diagram");
	const [copied, setCopied] = (0, react.useState)(false);
	const [open, setOpen] = (0, react.useState)(false);
	const last = (0, react.useRef)({
		at: 0,
		seq: 0,
		accepted: 0
	});
	const latest = (0, react.useRef)(code);
	latest.current = code;
	(0, react.useEffect)(() => {
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
	(0, react.useEffect)(() => {
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
					setShown({
						node,
						type: result.type,
						font: result.font
					});
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
	}, [
		code,
		width,
		incomplete
	]);
	const copy = () => navigator.clipboard?.writeText(code).then(() => {
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	});
	const label = names[shown?.type] ?? "Diagram";
	const failed = Boolean(error) && !incomplete;
	const showCode = failed || view === "code";
	const style = shown?.font ? { "--pele-font": shown.font } : void 0;
	return (0, react_jsx_runtime.jsxs)("div", {
		ref: card,
		className: "mermaid-card",
		"data-state": failed ? "failed" : shown ? "drawn" : "drawing",
		style,
		children: [
			(0, react_jsx_runtime.jsxs)("div", {
				className: "mermaid-tools",
				children: [
					shown && !failed && (0, react_jsx_runtime.jsx)(Tool, {
						label: view === "code" ? "Show the diagram" : "Show the code",
						pressed: view === "code",
						onClick: () => setView(view === "code" ? "diagram" : "code"),
						children: view === "code" ? icons.diagram : icons.code
					}),
					(0, react_jsx_runtime.jsx)(Tool, {
						label: copied ? "Copied" : "Copy the code",
						onClick: copy,
						children: copied ? icons.copied : icons.copy
					}),
					shown && !failed && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Tool, {
						label: "Download as SVG",
						onClick: () => download(shown.node, card.current, shown.type),
						children: icons.download
					}), (0, react_jsx_runtime.jsx)(Tool, {
						label: "Expand",
						onClick: () => setOpen(true),
						children: icons.expand
					})] })
				]
			}),
			showCode ? (0, react_jsx_runtime.jsx)("pre", {
				className: "mermaid-code",
				children: (0, react_jsx_runtime.jsx)("code", { children: code })
			}) : shown ? (0, react_jsx_runtime.jsx)("div", {
				role: "img",
				"aria-label": label,
				children: (0, react_jsx_runtime.jsx)(Picture, { node: shown.node })
			}) : (0, react_jsx_runtime.jsx)("p", {
				className: "mermaid-drawing",
				children: "Drawing a diagram…"
			}),
			failed && (0, react_jsx_runtime.jsxs)("div", {
				className: "mermaid-error",
				role: "status",
				children: [(0, react_jsx_runtime.jsx)("p", { children: "This diagram didn't draw." }), (0, react_jsx_runtime.jsx)("pre", { children: error })]
			}),
			shown && (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Dialog, {
				open,
				onOpenChange: setOpen,
				children: (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogContent, {
					className: "mermaid-dialog",
					children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogTitle, { children: label }), (0, react_jsx_runtime.jsx)("div", {
						className: "mermaid-dialog-body",
						style,
						children: (0, react_jsx_runtime.jsx)(Picture, {
							node: shown.node,
							wide: true
						})
					})]
				})
			})
		]
	});
}
function setup(app) {
	version = app.version;
	app.codeBlock("mermaid", Diagram);
}
module.exports = setup;
