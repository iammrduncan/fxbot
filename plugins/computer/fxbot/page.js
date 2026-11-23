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
const settingUp = (status) => ["asked", "working"].includes(status?.setup?.state) && status.engine.state !== "ready";
function useStatus() {
	const [status, setStatus] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => call("status").then((next) => (setStatus(next), setError("")), (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), []);
	const waiting = Boolean(status?.building) || settingUp(status);
	(0, react.useEffect)(() => {
		if (!waiting) return;
		const timer = setInterval(load, 2e3);
		return () => clearInterval(timer);
	}, [waiting]);
	const act = (path, method = "POST") => call(path, method).then(setStatus, (e) => setError(e.message));
	return {
		status,
		error,
		act
	};
}
function useComputer(key, every) {
	const [state, setState] = (0, react.useState)(null);
	const load = () => key ? call(`computers/${key}/state`).then(setState, () => {}) : Promise.resolve();
	(0, react.useEffect)(() => {
		load();
		if (!key) return;
		const timer = setInterval(() => document.visibilityState === "visible" && void load(), every);
		return () => clearInterval(timer);
	}, [key, every]);
	return [state, load];
}
const size = (n) => n == null ? "" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.ceil(n / 1e3)} kB`;
const ago = (at) => {
	const minutes = Math.round((Date.now() - at) / 6e4);
	return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
};
const Code = ({ children }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
	className: "overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap",
	children
});
const screenOf = (key) => `/computer/computers/${key}`;
const socketOf = (kind, key) => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/plugins/computer/${kind}/${key}`;
const colors = {
	black: "#1f1f1f",
	brown: "#9b6a3f",
	red: "#e5484d",
	orange: "#f06b2b",
	amber: "#ec9a2e",
	green: "#56bf73",
	teal: "#4fb3a2",
	blue: "#3b82f6",
	purple: "#8b5cf6",
	pink: "#e64ba0",
	gray: "#9a9a9a"
};
const since = (at) => {
	const s = Math.round((Date.now() - at) / 1e3);
	return s < 60 ? `${Math.max(1, s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`;
};
const pill = {
	background: "rgba(20,20,20,.82)",
	color: "#fff",
	fontSize: 11,
	lineHeight: "16px",
	padding: "1px 6px",
	borderRadius: 8,
	whiteSpace: "nowrap"
};
function Cursors({ computer, hidden }) {
	const box = (0, react.useRef)(null);
	const [data, setData] = (0, react.useState)(null);
	const [size, setSize] = (0, react.useState)(null);
	const bots = (0, _fxbot_app.useBots)();
	(0, react.useEffect)(() => {
		if (hidden) return;
		let stopped = false;
		const read = () => document.visibilityState === "visible" && call(`computers/${computer}/cursors`).then((next) => !stopped && setData(next), () => {});
		read();
		const timer = setInterval(read, 1e3);
		return () => (stopped = true, clearInterval(timer));
	}, [computer, hidden]);
	(0, react.useEffect)(() => {
		const watch = new ResizeObserver(() => box.current && setSize([box.current.clientWidth, box.current.clientHeight]));
		watch.observe(box.current);
		return () => watch.disconnect();
	}, []);
	const marks = data?.marks ?? [];
	const newest = Math.max(0, ...marks.map((m) => m.at));
	const botOf = (id) => bots?.find((b) => b.id === id);
	const nameOf = (m) => `${botOf(m.bot)?.name ?? "A bot"}${m.label ? ` · ${m.label}` : ""}`;
	const [w, h] = data?.screen ?? [1, 1];
	const scale = size ? Math.min(size[0] / w, size[1] / h) : 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		ref: box,
		"aria-hidden": "true",
		style: {
			position: "absolute",
			inset: 0,
			pointerEvents: "none",
			overflow: "hidden"
		},
		children: [size && marks.filter((m) => m.x !== void 0 && m.x !== null).map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			"data-bot": m.bot,
			style: {
				position: "absolute",
				left: (size[0] - w * scale) / 2 + m.x * scale - 1,
				top: (size[1] - h * scale) / 2 + m.y * scale - 1,
				opacity: m.at === newest ? 1 : .45,
				display: "flex",
				gap: 2
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				style: {
					display: "block",
					flex: "none"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.5 10 L13 10 Z",
					fill: colors[botOf(m.bot)?.color] ?? "#3b82f6",
					stroke: "#fff",
					strokeWidth: "1.2",
					strokeLinejoin: "round"
				})
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: {
					...pill,
					marginTop: 12
				},
				children: [
					nameOf(m),
					" · ",
					m.what,
					" · ",
					since(m.at)
				]
			})]
		}, m.id ?? m.bot)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: {
				position: "absolute",
				top: 6,
				left: 6,
				display: "flex",
				gap: 4,
				flexWrap: "wrap"
			},
			children: marks.filter((m) => m.x === void 0 || m.x === null).map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: {
					...pill,
					opacity: m.at === newest ? 1 : .6
				},
				children: [
					nameOf(m),
					" · ",
					m.what
				]
			}, m.id ?? m.bot))
		})]
	});
}
let version = "";
let xterm;
const loadXterm = () => xterm ??= (0, _fxbot_app.api)(`xterm.js?v=${encodeURIComponent(version)}`).then((res) => res.ok ? res.text() : Promise.reject(/* @__PURE__ */ new Error(`xterm.js didn't load: HTTP ${res.status}`))).then((code) => {
	const module = { exports: {} };
	new Function("module", "exports", code)(module, module.exports);
	return module.exports;
}).catch((error) => (xterm = void 0, Promise.reject(error)));
let novnc;
const load = (url) => import(url);
const loadRFB = () => novnc ??= load(new URL("/api/plugins/computer/novnc.js", location.href).href).then((module) => module.default);
const pane = {
	position: "relative",
	flex: 1,
	minHeight: 0,
	background: "#1e1e1e",
	borderRadius: 8,
	overflow: "hidden"
};
const cover = {
	position: "absolute",
	inset: 0,
	display: "grid",
	placeContent: "center",
	gap: 8,
	justifyItems: "center",
	color: "#ccc",
	fontSize: 14
};
function Desktop({ computer, control, hidden, peek, onGone, children }) {
	const box = (0, react.useRef)(null);
	const rfb = (0, react.useRef)(null);
	const [problem, setProblem] = (0, react.useState)("Connecting…");
	const [attempt, setAttempt] = (0, react.useState)(0);
	(0, react.useEffect)(() => {
		let gone = false;
		setProblem("Connecting…");
		loadRFB().then((RFB) => {
			if (gone) return;
			const view = new RFB(box.current, socketOf("desktop", computer) + (peek ? "?peek" : ""));
			view.viewOnly = !control;
			view.scaleViewport = true;
			view.resizeSession = false;
			view.background = "#1e1e1e";
			view.addEventListener("connect", () => setProblem(""));
			view.addEventListener("disconnect", (event) => !gone && (peek ? onGone?.() : setProblem(event.detail?.clean ? "Disconnected." : "The connection dropped.")));
			rfb.current = view;
		}, (error) => setProblem(`The desktop's viewer didn't load: ${error.message}`));
		return () => {
			gone = true;
			rfb.current?.disconnect();
			rfb.current = null;
		};
	}, [computer, attempt]);
	(0, react.useEffect)(() => {
		if (rfb.current) rfb.current.viewOnly = !control;
	}, [control]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			...peek ? {
				position: "absolute",
				inset: 0
			} : pane,
			display: hidden ? "none" : "block"
		},
		"aria-label": peek ? "The computer's screen" : "The computer's desktop",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: box,
				style: {
					position: "absolute",
					inset: 0
				}
			}),
			!problem && children,
			problem && !peek && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: cover,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: problem }), problem !== "Connecting…" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					size: "sm",
					variant: "secondary",
					onClick: () => setAttempt((n) => n + 1),
					children: "Connect again"
				})]
			})
		]
	});
}
function TerminalView({ computer, hidden }) {
	const box = (0, react.useRef)(null);
	const [problem, setProblem] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		let gone = false;
		let stop = () => {};
		loadXterm().then(({ Terminal, FitAddon }) => void (gone || (stop = start(Terminal, FitAddon))), (error) => setProblem(error.message));
		return () => (gone = true, stop());
	}, [computer]);
	function start(Terminal, FitAddon) {
		const term = new Terminal({
			fontSize: 13,
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			cursorBlink: true,
			theme: { background: "#1e1e1e" }
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(box.current);
		const socket = new WebSocket(socketOf("terminal", computer));
		socket.binaryType = "arraybuffer";
		const resize = () => {
			if (!box.current?.offsetWidth) return;
			fit.fit();
			if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
				cols: term.cols,
				rows: term.rows
			}));
		};
		socket.onopen = () => (setProblem(""), resize());
		socket.onmessage = (event) => term.write(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
		socket.onclose = () => setProblem("Disconnected.");
		const typing = term.onData((data) => socket.readyState === WebSocket.OPEN && socket.send(new TextEncoder().encode(data)));
		const watch = new ResizeObserver(resize);
		watch.observe(box.current);
		return () => {
			watch.disconnect();
			typing.dispose();
			socket.close();
			term.dispose();
		};
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			...pane,
			display: hidden ? "none" : "block"
		},
		"aria-label": "The computer's terminal",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			ref: box,
			style: {
				position: "absolute",
				inset: 8
			}
		}), problem && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: {
				...cover,
				inset: "auto 0 8px 0"
			},
			children: problem
		})]
	});
}
function ComputerScreen({ params }) {
	const { Button, Header } = _fxbot_app.ui;
	const key = params.key ?? params.id;
	const bot = (0, _fxbot_app.useBots)()?.find((b) => b.id === key);
	const [state, reload] = useComputer(key, 3e3);
	const [tab, setTab] = (0, react.useState)("desktop");
	const [error, setError] = (0, react.useState)("");
	const act = (path, body) => call(`computers/${key}/${path}`, "POST", body).then(() => reload(), (e) => setError(e.message));
	const owner = state?.owner;
	const name = state?.name ?? bot?.name ?? "This bot";
	const asker = owner?.bot ?? name;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			minHeight: 0
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
			title: `${name}'s computer`,
			children: state?.running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: owner ? "default" : "outline",
				onClick: () => act("takeover", { on: !owner }),
				children: owner ? "Hand back" : "Take over"
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
				owner?.reason && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "rounded-md border px-3 py-2 text-sm",
					children: state?.shared ? `${asker} asked you: ${owner.reason}. Hand it back when you're done, then tell ${asker} to go on.` : `${name} asked you: ${owner.reason}. Hand it back when you're done, and ${name} carries on.`
				}),
				owner && !owner.reason && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground",
					children: [
						"You have the mouse and keyboard. ",
						state?.shared ? "The bots'" : `${name}'s`,
						" desktop and terminal tools wait until you hand back."
					]
				}),
				state && !state.ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm",
					children: "The computer isn't set up on this machine yet: see its section in Settings."
				}),
				state?.ready && !state.running && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "grid justify-items-start gap-2 text-sm",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: state.exists ? `${name}'s computer is stopped.` : `${name} has no computer yet.` }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => act("start"),
						children: "Start it"
					})]
				}),
				state?.running && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "tablist",
						style: {
							display: "flex",
							gap: 4
						},
						children: [["desktop", "Desktop"], ["terminal", "Terminal"]].map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							role: "tab",
							"aria-selected": tab === key,
							size: "sm",
							variant: tab === key ? "secondary" : "ghost",
							onClick: () => setTab(key),
							children: label
						}, key))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Desktop, {
						computer: key,
						control: Boolean(owner),
						hidden: tab !== "desktop",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Cursors, {
							computer: key,
							hidden: tab !== "desktop"
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TerminalView, {
						computer: key,
						hidden: tab !== "terminal"
					})
				] }),
				error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				})
			]
		})]
	});
}
function Engine({ status, act }) {
	const { Button } = _fxbot_app.ui;
	const [script, setScript] = (0, react.useState)(null);
	const { engine, command, setup } = status;
	if (engine.state === "ready") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "text-sm",
		children: [
			engine.name,
			" ",
			engine.version,
			", rootless, at ",
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "font-mono text-xs break-all",
				children: engine.socket
			}),
			"."
		]
	});
	if (engine.state !== "rootful" && settingUp(status)) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2 text-sm",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
			"Setting up the computer on this machine: a user of its own, which runs its podman or docker rootless, and a firewall that keeps its computers to the internet. It takes a minute or two",
			setup.lines ? "" : ", and fxbot starts again when it's done",
			"."
		] }), setup.lines?.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Code, { children: setup.lines.join("\n") })]
	});
	const read = () => script ? setScript(null) : (0, _fxbot_app.api)("script").then((res) => res.text()).then(setScript);
	const failed = engine.state !== "rootful" && setup?.state === "failed";
	const missing = engine.state !== "rootful" && setup?.state === "done";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2",
		children: [
			(failed || missing) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid justify-items-start gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "text-destructive",
						children: failed ? "Setting up the computer on this machine failed:" : `The computer was set up, but fxbot can't reach its engine at ${engine.socket}.`
					}),
					failed && setup.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Code, { children: setup.error }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => act("setup"),
						children: "Try again"
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: engine.state === "rootful" ? "This engine runs as root, so the computer won't use it. Run the setup script on the machine, as root:" : failed || missing ? "Or run it on the machine yourself, as root:" : "The computer's engine isn't set up on this machine yet. Run this on the machine, once, as root:"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Code, { children: command }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "It makes a user of its own that runs this machine's podman or docker rootless, and a firewall that keeps its computers to the internet. Read it before you run it."
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "outline",
				className: "justify-self-start",
				onClick: read,
				children: script ? "Hide the script" : "Read the script"
			}),
			script && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: "max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs",
				children: script
			})
		]
	});
}
const describe = (c) => [
	c.running ? "Running" : "Stopped",
	c.owner ? c.owner.reason ? "asking for you" : "yours now" : "",
	c.used ? `used ${ago(c.used)}` : "",
	c.home != null ? `home ${size(c.home)}` : ""
].filter(Boolean).join(", ");
function SettingsSection() {
	const { Button } = _fxbot_app.ui;
	const { status, error, act } = useStatus();
	const ready = status?.engine.state === "ready";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3",
		"aria-label": "Computer",
		children: [
			status && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Engine, {
				status,
				act
			}),
			ready && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1.5 text-sm",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
						"Image ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs",
							children: status.image.tag.split(":")[1]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: status.image.size ? `, ${size(status.image.size)}` : status.building ? ", building" : ", made on a bot's first call"
						})
					] }),
					status.building && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Code, { children: status.building.join("\n") }),
					status.buildError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "text-destructive",
						children: status.buildError
					})
				]
			}),
			ready && status.computers.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "divide-y rounded-xl border text-sm",
				children: status.computers.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 px-3 py-2",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "min-w-0 flex-1 truncate font-medium",
							children: [c.name, c.by && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "font-normal text-muted-foreground",
								children: [" · ", c.by]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: describe(c)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => (0, _fxbot_app.go)(screenOf(c.key)),
							children: "Open"
						})
					]
				}, c.key))
			}),
			ready && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: Boolean(status.building),
					onClick: () => act("rebuild"),
					children: "Rebuild image"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: !status.computers.length,
					onClick: () => confirm("Delete every computer, with its home and what it installed?") && act("computers", "DELETE"),
					children: "Delete all computers"
				})]
			}),
			ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Removing the plugin keeps the computers and their homes. Delete all computers removes them."
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-sm text-destructive",
				children: error
			})
		]
	});
}
function BotSection({ bot }) {
	const { Button } = _fxbot_app.ui;
	const { status, error, act } = useStatus();
	if (!status || status.engine.state !== "ready") return null;
	const mine = status.computers.find((c) => c.bot === bot.id);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
		className: "grid gap-2",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
				className: "mb-1.5 text-sm font-medium",
				children: "Computer"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: !mine ? "None yet: it starts on the bot's first call." : `${describe(mine)}.`
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => (0, _fxbot_app.go)(screenOf(bot.id)),
					children: "Open computer"
				}), mine && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					disabled: !mine.running,
					onClick: () => act(`computers/${bot.id}/stop`),
					children: "Stop"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => confirm(`Reset ${bot.name}'s computer? Its home and what it installed are deleted.`) && act(`computers/${bot.id}/reset`),
					children: "Reset"
				})] })]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-sm text-destructive",
				children: error
			})
		]
	});
}
function DesktopCall({ call }) {
	const [whole, setWhole] = (0, react.useState)(false);
	const [gone, setGone] = (0, react.useState)(false);
	const shot = /^Screenshot ([0-9a-f]{8})\./.exec(call.output ?? "")?.[1];
	const { action, coordinate, text } = call.input ?? {};
	const what = [
		action,
		Array.isArray(coordinate) ? `(${coordinate.join(", ")})` : "",
		action === "type" || action === "key" ? JSON.stringify(text) : ""
	].filter(Boolean).join(" ");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid justify-items-start gap-1.5 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"Computer: ",
					what || "the desktop",
					call.done ? "" : "…"
				]
			}),
			call.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: call.output
			}),
			shot && !gone && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setWhole((on) => !on),
				"aria-label": whole ? "Show the screenshot small" : "Show the screenshot whole",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: `/api/plugins/computer/shots/${shot}`,
					alt: "The screen after the action",
					onError: () => setGone(true),
					style: {
						maxWidth: whole ? "100%" : 320,
						borderRadius: 6,
						border: "1px solid rgba(127,127,127,0.3)"
					}
				})
			})
		]
	});
}
let plugins;
async function onFor(bot) {
	for (;;) try {
		const mine = (await (plugins ??= _fxbot_app.client.plugins.list())).find((p) => p.name === "computer");
		return Boolean(mine?.enabled && (mine.bots === "all" || mine.on?.includes(bot)));
	} catch {
		plugins = void 0;
		await new Promise((done) => setTimeout(done, 3e3));
	}
}
const Monitor = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
			width: "20",
			height: "14",
			x: "2",
			y: "3",
			rx: "2"
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "8",
			x2: "16",
			y1: "21",
			y2: "21"
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "12",
			x2: "12",
			y1: "17",
			y2: "21"
		})
	]
});
function ComputerButton({ bot, setDraft }) {
	const [on, setOn] = (0, react.useState)(false);
	(0, react.useEffect)(() => void onFor(bot.id).then(setOn, () => {}), [bot.id]);
	const [state] = useComputer(on ? bot.id : null, 15e3);
	if (!on) return null;
	const add = () => setDraft((draft) => /(^|\s)\$computer\b/.test(draft) ? draft : `$computer ${draft}`);
	const asking = state?.owner?.reason;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
			type: "button",
			variant: "ghost",
			size: "icon-sm",
			className: "rounded-full",
			"aria-label": "Use the computer",
			title: "Use the computer: adds $computer to the message",
			onClick: add,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Monitor, {})
		}), state?.running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => (0, _fxbot_app.go)(screenOf(bot.id)),
			"aria-label": asking ? `${bot.name} needs you on its computer: ${asking}` : `Open ${bot.name}'s computer`,
			title: asking ? `${bot.name} needs you: ${asking}` : `Open ${bot.name}'s computer`,
			style: {
				position: "absolute",
				top: 2,
				right: 2,
				width: 9,
				height: 9,
				borderRadius: 9,
				border: "2px solid var(--background, #fff)",
				background: asking ? "#f59e0b" : "#22c55e",
				padding: 0
			}
		})]
	});
}
const Play = () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
	xmlns: "http://www.w3.org/2000/svg",
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "currentColor",
	"aria-hidden": "true",
	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" })
});
function BotScreen({ bot }) {
	const [on, setOn] = (0, react.useState)(false);
	(0, react.useEffect)(() => void onFor(bot.id).then(setOn, () => {}), [bot.id]);
	const [state, reload] = useComputer(on ? bot.id : null, 5e3);
	const [starting, setStarting] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	if (!on || !state?.ready) return null;
	const start = () => {
		setStarting(true);
		setError("");
		call(`computers/${bot.id}/start`, "POST").then(() => reload(), (e) => setError(e.message)).finally(() => setStarting(false));
	};
	const asking = state.owner?.reason;
	const says = state.running ? state.owner ? asking ? "Needs you" : "Yours now" : "Running" : starting ? "Starting…" : "Idle";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		"aria-label": `${bot.name}'s computer`,
		className: "grid gap-1.5",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Computer" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: asking ? "text-amber-600" : void 0,
					children: says
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					position: "relative",
					aspectRatio: "16 / 10",
					borderRadius: 8,
					overflow: "hidden",
					background: "#1e1e1e"
				},
				children: state.running ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Desktop, {
					computer: bot.id,
					peek: true,
					onGone: reload
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => (0, _fxbot_app.go)(screenOf(bot.id)),
					"aria-label": `Open ${bot.name}'s computer`,
					title: "Open the computer",
					style: {
						position: "absolute",
						inset: 0,
						background: "transparent",
						border: 0,
						cursor: "pointer"
					}
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						...cover,
						padding: 12,
						textAlign: "center",
						fontSize: 13
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: starting ? "Starting… The first start makes its image, which takes a minute or two." : "Idle" }), !starting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
						type: "button",
						size: "icon-sm",
						variant: "secondary",
						className: "rounded-full",
						"aria-label": `Start ${bot.name}'s computer`,
						title: "Start the computer",
						onClick: start,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Play, {})
					})]
				})
			}),
			asking && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-xs text-amber-600",
				children: [
					bot.name,
					" needs you: ",
					asking
				]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs text-destructive",
				children: error
			})
		]
	});
}
const ScreenIcon = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
		x: "2",
		y: "3",
		width: "20",
		height: "14",
		rx: "2"
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 21h8M12 17v4" })]
});
function RoomComputer({ room }) {
	const { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Switch } = _fxbot_app.ui;
	const [state, setState] = (0, react.useState)(null);
	const [open, setOpen] = (0, react.useState)(false);
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => void call(`rooms/${room.id}`).then(setState, () => {}), [room.id]);
	async function turn(on) {
		setBusy(true);
		setError("");
		try {
			const next = await call(`rooms/${room.id}`, "PUT", { on });
			if (!on && next.key) await call(`computers/${next.key}/stop`, "POST").catch(() => {});
			setState(next);
		} catch (e) {
			setError(e.message);
		}
		setBusy(false);
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Button, {
		variant: "ghost",
		size: "icon-sm",
		"aria-label": `${room.name}'s computer`,
		title: `${room.name}'s computer`,
		onClick: () => setOpen(true),
		style: { position: "relative" },
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ScreenIcon, {}), state?.on && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			"aria-hidden": "true",
			style: {
				position: "absolute",
				top: 4,
				right: 4,
				width: 6,
				height: 6,
				borderRadius: 3,
				background: "#22c55e"
			}
		})]
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DialogContent, {
			className: "sm:max-w-lg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DialogTitle, { children: [room.name, "'s computer"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DialogDescription, { children: [
					"Give ",
					room.name,
					" a computer of its own. Its bots share it in this room, taking turns, and keep their own computers for their own chats."
				] })] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "flex items-center justify-between gap-3 text-sm font-medium",
					children: ["Computer", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
						checked: Boolean(state?.on),
						disabled: busy || !state,
						onCheckedChange: turn
					})]
				}),
				state?.on && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => (0, _fxbot_app.go)(`/computer/computers/${state.key}`),
						children: "Open"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Turning it off stops it and keeps its files."
					})]
				}),
				error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				})
			]
		})
	})] });
}
function setup(app) {
	version = app.version;
	app.route("/computers/:key", ComputerScreen);
	app.route("/bots/:id", ComputerScreen);
	app.botPanel(BotScreen);
	app.settings(SettingsSection);
	app.botSettings(BotSection);
	app.toolView("desktop", DesktopCall);
	app.composer(ComputerButton);
	app.slot("chat-rooms.room-header", RoomComputer);
}
module.exports = setup;
