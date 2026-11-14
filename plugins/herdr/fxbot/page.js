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
function Table({ rows, here }) {
	const machines = [...new Set(rows.map((r) => r.machine))];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "grid gap-3",
		children: machines.map((machine) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "grid gap-1",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium text-muted-foreground",
				children: machine === "here" && here ? `${here} (this machine)` : machine
			}), rows.filter((r) => r.machine === machine).map((r, i) => r.unreachable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-xs text-destructive",
				children: ["Didn't answer: ", r.unreachable]
			}, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-2 text-xs",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `size-2 shrink-0 rounded-full ${dot[r.status] ?? dot.unknown}` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "shrink-0 font-mono",
						children: r.target
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
			}, r.target))]
		}, machine))
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
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Table, {
				rows: now.rows,
				here: now.here
			})] }) : !tool.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
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
	blocked: "Waiting for you, in herdr",
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
	const who = `${input.agent ?? input.name ?? "An agent"}${input.machine ? ` on ${input.machine}` : ""}`;
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
			(state.here || state.machines.length > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "Machines"
					}),
					state.here && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: state.here
							}),
							" (this machine, where fxbot runs): ",
							how ? "answers" : "doesn't answer"
						]
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
					}), machine || `This machine${data.here ? `, ${data.here}` : ""}, where fxbot runs`]
				}, machine || "here"))
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
function setup(app) {
	app.botSettings(BotMachines);
	app.toolView("agents", Agents, { open: true });
	app.toolView("prompt", Sent, { open: true });
	app.toolView("start", Sent, { open: true });
	app.settings(Tab);
}
module.exports = setup;
