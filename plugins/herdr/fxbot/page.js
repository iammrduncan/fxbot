let react = require("react");
let _fxbot_app = require("@fxbot/app");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/page.jsx
async function call(path, method = "GET", body) {
	const res = await (0, _fxbot_app.api)(path, {
		method,
		...body ? {
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		} : {}
	});
	const answer = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
	return answer;
}
const statusText = {
	working: "Working",
	blocked: "Waiting for you",
	done: "Done",
	idle: "Ready",
	unknown: "Unknown"
};
const dot = {
	working: "bg-primary",
	blocked: "bg-destructive",
	done: "bg-muted-foreground",
	idle: "bg-muted-foreground",
	unknown: "bg-border"
};
const firstLine = (text) => (text ?? "").split("\n")[0];
const terminalOf = (machine, pane) => `/herdr/agents/${encodeURIComponent(machine || "local")}/${encodeURIComponent(pane)}`;
const open = (href) => (event) => {
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
	event.preventDefault();
	(0, _fxbot_app.go)(href);
};
function Table({ rows, big = false }) {
	const machines = [...new Set(rows.map((r) => r.machine))];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "grid gap-3",
		children: machines.map((machine) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid gap-1",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium text-muted-foreground",
				children: machine === "local" ? "Local" : machine
			}), rows.filter((r) => r.machine === machine).map((r, i) => r.unreachable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-xs text-destructive",
				children: ["Didn't answer: ", r.unreachable]
			}, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
				href: terminalOf(r.machine, r.pane || r.target),
				onClick: open(terminalOf(r.machine, r.pane || r.target)),
				className: `flex min-w-0 items-center gap-2 rounded-md hover:bg-muted ${big ? "px-2 py-2 text-sm" : "text-xs"}`,
				title: "Open its terminal",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `size-2 shrink-0 rounded-full ${dot[r.status] ?? dot.unknown}` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "shrink-0",
						children: [
							[r.workspace, r.tab].filter(Boolean).join(" · ") || r.target,
							r.label ? ` "${r.label}"` : "",
							r.session ? ` (${r.session})` : ""
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "shrink-0 text-muted-foreground",
						children: r.kind
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `shrink-0 ${r.status === "blocked" ? "font-medium text-destructive" : ""}`,
						children: statusText[r.status] ?? r.status
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "min-w-0 truncate text-muted-foreground",
						title: r.folder,
						children: r.title || r.folder
					})
				]
			}, r.pane || r.target))]
		}, machine))
	});
}
const palette = [
	"#1e1e1e",
	"#e06c75",
	"#98c379",
	"#e5c07b",
	"#61afef",
	"#c678dd",
	"#56b6c2",
	"#d4d4d4",
	"#7f848e",
	"#f47c86",
	"#a8d68a",
	"#f0cf8a",
	"#7cc0f5",
	"#d79ce8",
	"#6fd0dc",
	"#ffffff"
];
const screenColors = {
	background: "#0f1115",
	color: "#d4d4d4"
};
function color256(n) {
	if (n < 16) return palette[n];
	if (n >= 232) return `rgb(${8 + (n - 232) * 10},${8 + (n - 232) * 10},${8 + (n - 232) * 10})`;
	const c = (x) => x ? 55 + x * 40 : 0;
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
		else if (n === 39) next.fg = void 0;
		else if (n === 49) next.bg = void 0;
		else if ((n === 38 || n === 48) && codes[i + 1] === 5) next[n === 38 ? "fg" : "bg"] = color256(codes[i + 2] ?? 0), i += 2;
		else if ((n === 38 || n === 48) && codes[i + 1] === 2) next[n === 38 ? "fg" : "bg"] = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`, i += 4;
	}
	return next;
}
function runs(text) {
	const out = [];
	const escape = /\x1b\[([0-9;:]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[@-_]?|[\r\x00-\x08\x0b-\x1f\x7f]/g;
	let style = {};
	let at = 0;
	for (let m; m = escape.exec(text);) {
		if (m.index > at) out.push({
			text: text.slice(at, m.index),
			style
		});
		at = escape.lastIndex;
		if (m[2] === "m") style = sgr(style, (m[1] || "0").split(/[;:]/).map((n) => Number(n) || 0));
	}
	if (at < text.length) out.push({
		text: text.slice(at),
		style
	});
	return out;
}
function Screen({ text }) {
	return runs(text).map((run, i) => {
		const s = run.style;
		const css = {
			color: s.inverse ? s.bg ?? screenColors.background : s.fg,
			background: s.inverse ? s.fg ?? screenColors.color : s.bg,
			fontWeight: s.bold ? 700 : void 0,
			opacity: s.dim ? .6 : void 0,
			fontStyle: s.italic ? "italic" : void 0,
			textDecoration: s.underline ? "underline" : void 0
		};
		return Object.values(css).some((v) => v !== void 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: css,
			children: run.text
		}, i) : run.text;
	});
}
function keyOf(event) {
	if (event.metaKey || event.isComposing) return null;
	const shift = event.shiftKey ? "shift+" : "";
	const named = {
		Enter: "enter",
		Escape: "esc",
		Backspace: "backspace",
		Tab: event.shiftKey ? "shift+tab" : "tab",
		ArrowUp: `${shift}up`,
		ArrowDown: `${shift}down`,
		ArrowLeft: `${shift}left`,
		ArrowRight: `${shift}right`
	}[event.key];
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
	["3", "3"]
];
function Terminal({ params }) {
	const { Button, Header, Input } = _fxbot_app.ui;
	const machine = params.machine || "local";
	const [screen, setScreen] = (0, react.useState)(null);
	const [who, setWho] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const [earlier, setEarlier] = (0, react.useState)(false);
	const [line, setLine] = (0, react.useState)("");
	const [focused, setFocused] = (0, react.useState)(false);
	const queue = (0, react.useRef)([]);
	const sending = (0, react.useRef)(false);
	const poke = (0, react.useRef)(() => {});
	const box = (0, react.useRef)(null);
	const stick = (0, react.useRef)(true);
	const pane = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/.test(params.pane) ? params.pane : who?.pane;
	const query = `machine=${encodeURIComponent(machine)}&pane=${encodeURIComponent(pane ?? "")}`;
	(0, react.useEffect)(() => {
		if (!pane) return;
		let stopped = false;
		let timer;
		const look = async () => {
			clearTimeout(timer);
			if (stopped) return;
			if (document.visibilityState === "visible") await call(`screen?${query}${earlier ? "&earlier=1" : ""}`).then((s) => !stopped && (setScreen(s), setError("")), (e) => !stopped && setError(e.message));
			if (!stopped) timer = setTimeout(look, 1e3);
		};
		poke.current = () => (clearTimeout(timer), timer = setTimeout(look, 150));
		look();
		const shown = () => document.visibilityState === "visible" && poke.current();
		document.addEventListener("visibilitychange", shown);
		return () => (stopped = true, clearTimeout(timer), document.removeEventListener("visibilitychange", shown));
	}, [
		query,
		earlier,
		pane
	]);
	(0, react.useEffect)(() => {
		call(`agents?machine=${encodeURIComponent(machine)}`).then((list) => {
			const named = params.pane.toLowerCase();
			const rows = list.rows.filter((r) => r.pane);
			setWho(rows.find((r) => r.pane === params.pane || r.target === params.pane) ?? rows.find((r) => r.session === params.pane || r.label.toLowerCase() === named) ?? { missing: true });
		}, (e) => setError(e.message));
	}, [machine, params.pane]);
	(0, react.useEffect)(() => {
		const el = box.current;
		if (el && stick.current) el.scrollTop = el.scrollHeight;
	}, [screen?.text]);
	async function flush() {
		if (sending.current) return;
		sending.current = true;
		try {
			while (queue.current.length) {
				const first = queue.current[0];
				const run = [];
				while (queue.current.length && "text" in queue.current[0] === "text" in first && run.length < 32) run.push(queue.current.shift());
				const body = "text" in first ? { text: run.map((r) => r.text).join("") } : { keys: run.map((r) => r.key) };
				await call("keys", "POST", {
					machine,
					pane,
					...body
				}).then(() => setError(""), (e) => setError(e.message));
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
		send(...text ? [{ text }] : [], { key: "enter" });
	};
	const status = screen?.status ?? who?.status;
	const title = who && !who.missing ? `${who.kind ? who.kind[0].toUpperCase() + who.kind.slice(1) : "An agent"}${who.label ? ` "${who.label}"` : ""}${who.session ? ` (${who.session})` : ""}` : params.pane;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			minHeight: 0
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
			title,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => (0, _fxbot_app.go)("/herdr/agents"),
				children: "All agents"
			})
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				gap: 8,
				flex: 1,
				minHeight: 0,
				padding: "0 12px 12px"
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "flex flex-wrap items-center gap-2 text-sm text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `size-2 shrink-0 rounded-full ${dot[status] ?? dot.unknown}` }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: status === "blocked" ? "font-medium text-destructive" : "text-foreground",
							children: statusText[status] ?? "…"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: [
							who?.tab && (/^\d+$/.test(who.tab) ? `tab ${who.tab}` : who.tab),
							who?.workspace,
							machine === "local" ? "Local" : machine
						].filter(Boolean).join(" · ") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "ml-auto flex items-center gap-2",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Switch, {
								checked: earlier,
								onCheckedChange: setEarlier,
								"aria-label": "Earlier lines"
							}), "Earlier lines"]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					ref: box,
					tabIndex: 0,
					role: "textbox",
					"aria-label": "The agent's terminal: click, then type",
					onKeyDown,
					onPaste,
					onFocus: () => setFocused(true),
					onBlur: () => setFocused(false),
					onScroll: (e) => stick.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 24,
					className: `min-h-0 flex-1 overflow-auto rounded-md p-3 font-mono text-xs leading-snug outline-none ${focused ? "ring-2 ring-primary" : ""}`,
					style: {
						...screenColors,
						whiteSpace: "pre",
						margin: 0
					},
					children: screen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Screen, { text: screen.text }) : who?.missing && !pane ? `herdr doesn't list ${params.pane} on ${machine === "local" ? "Local" : machine}.` : error ? "" : "Asking herdr…"
				}),
				error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-1",
					role: "group",
					"aria-label": "Keys",
					children: keyRow.map(([label, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "xs",
						variant: "outline",
						className: "font-mono",
						onClick: () => send({ key }),
						children: label
					}, key))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: "flex gap-2",
					onSubmit: submit,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
						value: line,
						onChange: (e) => setLine(e.target.value),
						placeholder: "Type to it, then Send presses Enter",
						"aria-label": "Type to the agent",
						autoComplete: "off",
						autoCapitalize: "off"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						children: "Send"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: focused ? "Your keys go to the agent. Click outside the screen to stop." : "Click the screen to type into it, or use the keys and the line below."
				})
			]
		})]
	});
}
function AgentsScreen() {
	const { Header } = _fxbot_app.ui;
	const [now, setNow] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		let stopped = false;
		let timer;
		const look = async () => {
			if (stopped) return;
			if (document.visibilityState === "visible") await call("agents").then((list) => !stopped && (setNow(list), setError("")), (e) => !stopped && setError(e.message));
			if (!stopped) timer = setTimeout(look, 5e3);
		};
		look();
		return () => (stopped = true, clearTimeout(timer));
	}, []);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			minHeight: 0
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, { title: "herdr" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid content-start gap-3 overflow-auto px-3 pb-3 text-sm",
			style: {
				flex: 1,
				minHeight: 0
			},
			children: [now ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [now.summary, " Pick one to see its terminal and type into it."]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Table, {
				rows: now.rows,
				big: true
			})] }) : !error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "Asking herdr…"
			}), error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})]
		})]
	});
}
const herdrTag = /\[@herdr:([^\]\n]*)\]\(\/herdr\/agents\/([^/\s)"]+)\/([^/\s)"]+)(?: "([^"\n]*)")?\)/g;
const search = (query) => call(`mentions?q=${encodeURIComponent(query)}`).catch(() => []);
let kept = [];
let keptAt = 0;
const watchers = /* @__PURE__ */ new Set();
function keep(listen) {
	watchers.add(listen);
	if (Date.now() - keptAt > 3e4) {
		keptAt = Date.now();
		call("panes").then((list) => (kept = list, watchers.forEach((w) => w())), () => {});
	}
	return () => void watchers.delete(listen);
}
function Tag({ match }) {
	const [, name, machine, pane, title] = match;
	const where = decodeURIComponent(machine);
	const id = decodeURIComponent(pane);
	const now = (0, react.useSyncExternalStore)(keep, () => kept).find((p) => p.machine === where && p.pane === id);
	const href = terminalOf(where, id);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
		href,
		onClick: open(href),
		title: title || `${id} on ${where}`,
		style: {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			padding: "0 6px 0 4px",
			borderRadius: 9999,
			background: "rgb(255 255 255 / 0.2)",
			fontWeight: 500,
			verticalAlign: "bottom",
			color: "inherit",
			textDecoration: "none"
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TerminalIcon, { style: {
				width: 14,
				height: 14
			} }),
			now && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `shrink-0 rounded-full ${dot[now.status] ?? dot.unknown}`,
				style: {
					width: 6,
					height: 6
				},
				"aria-label": statusText[now.status] ?? now.status
			}),
			"@herdr:",
			name
		]
	});
}
function TerminalIcon({ className, style }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
		className,
		style,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4 17 6-6-6-6" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 19h8" })]
	});
}
function Agents({ call: tool }) {
	const { Button } = _fxbot_app.ui;
	const [now, setNow] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const [busy, setBusy] = (0, react.useState)(false);
	if (!tool.done) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Asking herdr…"
	});
	const show = () => (setBusy(true), setError(""), call("agents").then(setNow, (e) => setError(e.message)).finally(() => setBusy(false)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: tool.error ? "text-destructive" : "",
				children: firstLine(tool.output)
			}),
			now ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: ["Now: ", now.summary]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Table, { rows: now.rows })] }) : !tool.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "xs",
				variant: "outline",
				className: "justify-self-start",
				disabled: busy,
				onClick: show,
				children: busy ? "Asking herdr…" : "Show agents now"
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
const watchText = {
	working: "Working on it",
	done: "Answered: its last lines went to the chat",
	blocked: "Waiting for you: answer it in its terminal",
	timeout: "Still working when fxbot stopped waiting",
	gone: "Gone before it answered",
	failed: "Couldn't be followed"
};
function Sent({ call: tool }) {
	const input = tool.input ?? {};
	const id = /\(w:(\d+)\)/.exec(tool.output ?? "")?.[1];
	const [watch, setWatch] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		if (!id) return;
		let stopped = false;
		let timer;
		const look = () => call(`watches/${id}`).then((w) => {
			if (stopped) return;
			setWatch(w);
			if (w.state === "working") timer = setTimeout(look, 5e3);
		}).catch(() => {});
		look();
		return () => (stopped = true, clearTimeout(timer));
	}, [id]);
	const who = watch?.shown ?? `${input.agent ?? input.name ?? "An agent"}${input.machine ? ` on ${input.machine}` : ""}`;
	const agent = typeof (input.agent ?? input.name) === "string" ? (input.agent ?? input.name).trim() : "";
	const machine = watch?.machine ?? (typeof input.machine === "string" && input.machine.trim() ? input.machine.trim() : "local");
	const text = input.text ?? input.prompt;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1.5 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: who
			}),
			text && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground",
				children: text
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: tool.error ? "text-destructive" : "text-muted-foreground",
				children: !tool.done ? "Sending…" : watch ? watchText[watch.state] ?? watch.state : firstLine(tool.output)
			}),
			tool.done && agent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				href: terminalOf(machine, agent),
				onClick: open(terminalOf(machine, agent)),
				className: "justify-self-start text-xs underline underline-offset-2",
				children: "Open its terminal"
			})
		]
	});
}
function Tab() {
	const { Button } = _fxbot_app.ui;
	const [state, setState] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => (setError(""), call("status").then(setState, (e) => setError(e.message)));
	(0, react.useEffect)(() => void load(), []);
	if (error) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-destructive",
		children: error
	});
	if (!state) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Asking herdr…"
	});
	const how = state.how === "door" ? `Through the door on this machine${state.user ? `, as ${state.user}` : ""}${state.readOnly ? ". It's read-only: bots can look, but not send work or start agents" : ""}.` : state.how === "cli" ? "Directly, with herdr's own command: fxbot runs as herdr's user." : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "font-medium",
					children: ["herdr ", state.version ?? ""]
				}), how ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: how
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "text-destructive",
					children: [
						"fxbot can't reach herdr",
						state.error ? `: ${state.error}` : ".",
						" On the machine, run ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: "font-mono",
							children: "sudo fxbot herdr on"
						}),
						"."
					]
				})]
			}),
			(how || state.machines.length > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "Machines"
					}),
					how && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-foreground",
							children: "Local"
						}), ": answers"]
					}),
					state.machines.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: m.label
							}),
							": ",
							m.status === "reachable" ? "answers" : m.error ?? m.status
						]
					}, m.label))
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "Each bot reaches every machine unless you pick its machines, under herdr in its settings."
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: "Waiting for an answer"
				}), state.watches.length ? state.watches.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "text-muted-foreground",
					children: [
						w.agent,
						" on ",
						w.machine,
						", since ",
						new Date(w.started_at).toLocaleTimeString()
					]
				}, w.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Nothing."
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: "justify-self-start",
				onClick: load,
				children: "Check again"
			})
		]
	});
}
function BotMachines({ bot }) {
	const [data, setData] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => call(`bots/${bot.id}`).then(setData, (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), [bot.id]);
	if (!data) return error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-destructive",
		children: error
	}) : null;
	const save = (body) => (setError(""), call(`bots/${bot.id}`, "PUT", body).then(load, (e) => setError(e.message)));
	const toggle = (machine, on) => save({ machines: on ? [...data.machines, machine] : data.machines.filter((m) => m !== machine) });
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "herdr",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "herdr"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"The machines ",
					bot.name,
					" reaches through herdr. On the others, it can't see agents, send them work, or start them."
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Checkbox, {
					checked: data.all,
					onCheckedChange: (on) => save(on === true ? { all: true } : { machines: data.available })
				}), "Every machine, and any herdr adds later"]
			}),
			!data.all && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "grid gap-2 pl-6",
				children: data.available.map((machine) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Checkbox, {
						checked: data.machines.includes(machine),
						onCheckedChange: (on) => toggle(machine, on === true)
					}), machine || "Local"]
				}, machine || "local"))
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
function setup(app) {
	app.fold({ message: (id) => /^herdr-watch-\d+$/.test(id) ? { fold: "message" } : void 0 });
	app.botSettings(BotMachines);
	app.toolView("agents", Agents, { open: true });
	app.toolView("prompt", Sent, { open: true });
	app.toolView("start", Sent, { open: true });
	app.settings(Tab);
	app.nav({
		label: "herdr",
		path: "/agents",
		icon: TerminalIcon
	});
	app.route("/agents", AgentsScreen);
	app.route("/agents/:machine/:pane", Terminal);
	app.mention?.({ search });
	app.said(herdrTag, Tag);
}
module.exports = setup;
