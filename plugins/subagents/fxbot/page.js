let react = require("react");
let _fxbot_app = require("@fxbot/app");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/page.jsx
async function call(path, method = "GET") {
	const res = await (0, _fxbot_app.api)(path, { method });
	const answer = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(answer.error ?? `HTTP ${res.status}`), { status: res.status });
	return answer;
}
const changed = () => window.dispatchEvent(new Event("subagents-changed"));
const screenOf = (s) => `/subagents/${s.bot}/${s.id}`;
const minutes = (from, to = Date.now()) => {
	const m = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 6e4);
	return m < 1 ? "<1 min" : `${m} min`;
};
const word = {
	working: "Working",
	done: "Done",
	failed: "Failed",
	stopped: "Stopped"
};
const stop = (s) => call(`runs/${s.id}/stop`, "POST").then(changed, (e) => alert(e.message));
function usePoll(path, working, { busy = 5e3, idle = 3e4 } = {}) {
	const [value, setValue] = (0, react.useState)(void 0);
	(0, react.useEffect)(() => {
		if (!path) return;
		let gone = false;
		let timer;
		const read = () => {
			clearTimeout(timer);
			call(path).then((answer) => !gone && (setValue(answer), timer = setTimeout(read, working(answer) ? busy : idle)), (error) => !gone && (setValue(error.status === 404 ? null : (value) => value), timer = setTimeout(read, idle)));
		};
		read();
		addEventListener("subagents-changed", read);
		return () => (gone = true, clearTimeout(timer), removeEventListener("subagents-changed", read));
	}, [path]);
	return value;
}
function Row({ s }) {
	const { Button } = _fxbot_app.ui;
	const calls = s.calls ? `${s.calls} ${s.calls === 1 ? "call" : "calls"}` : "";
	const detail = s.state === "working" ? [s.tool, calls].filter(Boolean).join(" · ") : s.state === "done" ? "" : s.ended;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "subagents-row",
		"data-state": s.state,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "subagents-open",
			onClick: () => (0, _fxbot_app.go)(screenOf(s)),
			title: `Open ${s.title}`,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "subagents-dot",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "block truncate text-sm",
						children: s.title
					}), detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "block truncate text-xs text-muted-foreground",
						children: detail
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "subagents-state text-xs",
					children: [s.state === "working" ? "" : `${word[s.state]} · `, minutes(s.startedAt, s.endedAt ?? Date.now())]
				})
			]
		}), s.state === "working" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
			type: "button",
			size: "xs",
			variant: "ghost",
			onClick: () => stop(s),
			"aria-label": `Stop ${s.title}`,
			children: "Stop"
		})]
	});
}
function Panel({ bot }) {
	const answer = usePoll(`bots/${bot.id}`, (a) => a.subagents.some((s) => s.state === "working"));
	const [unfolded, setUnfolded] = (0, react.useState)(false);
	const list = answer?.subagents ?? [];
	if (!list.length) return null;
	const working = list.filter((s) => s.state === "working");
	const ended = list.filter((s) => s.state !== "working");
	const shown = [...working, ...unfolded ? ended : ended.slice(0, 3)];
	const folded = unfolded ? 0 : ended.length - 3;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		"aria-label": `${bot.name}'s subagents`,
		className: "subagents-panel",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Subagents" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: working.length ? `${working.length} working` : "" })]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "subagents-list",
				children: shown.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, { s }, s.id))
			}),
			folded > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "subagents-more text-xs text-muted-foreground",
				onClick: () => setUnfolded(true),
				children: [folded, " earlier"]
			})
		]
	});
}
function useThread(id, started) {
	const [turns, setTurns] = (0, react.useState)([]);
	const [tokens, setTokens] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		if (!started) return;
		const stop = new AbortController();
		(async () => {
			while (!stop.signal.aborted) {
				try {
					const res = await (0, _fxbot_app.api)(`runs/${id}/stream`, { signal: stop.signal });
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
							next = (0, _fxbot_app.applyLine)(next, line);
							if (line.type === "turn_end" && line.usage) setTokens((line.usage.inputTokens ?? 0) + (line.usage.outputTokens ?? 0));
						}
						setTurns(next);
					}
				} catch {
					if (stop.signal.aborted) return;
				}
				await new Promise((r) => setTimeout(r, 2e3));
			}
		})();
		return () => stop.abort();
	}, [id, started]);
	return {
		turns,
		tokens
	};
}
const back = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
	width: "16",
	height: "16",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m15 18-6-6 6-6" })
});
function Thread({ params }) {
	const { Header, Blob, Button, Message, MessageContent, Bubble, BubbleContent, Reply, MessageScroller, MessageScrollerProvider, MessageScrollerViewport, MessageScrollerContent, MessageScrollerButton } = _fxbot_app.ui;
	const bot = (0, _fxbot_app.useBots)()?.find((b) => b.id === params.bot);
	const found = usePoll(`runs/${params.id}`, (r) => r.state === "working", {
		busy: 3e3,
		idle: 3e4
	});
	const run = found && found.bot !== params.bot ? null : found;
	const { turns, tokens } = useThread(params.id, Boolean(run));
	const chat = () => (0, _fxbot_app.go)(`/profiles/${params.bot}`);
	const lead = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size: "icon-sm",
		"aria-label": bot ? `Back to ${bot.name}'s chat` : "Back",
		onClick: chat,
		children: back
	});
	if (run === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
		title: "Subagent",
		lead
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "subagents-gone grid gap-3 text-sm",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
			"This subagent is gone",
			bot ? `, or isn't ${bot.name}'s` : "",
			"."
		] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: "outline",
			size: "sm",
			className: "justify-self-start",
			onClick: chat,
			children: bot ? `Back to ${bot.name}'s chat` : "Back"
		})]
	})] });
	if (!run) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
		title: "Subagent",
		lead
	});
	const took = minutes(run.startedAt, run.endedAt ?? Date.now()).replace("min", "minutes").replace("<1 minutes", "under a minute");
	const used = [...run.calls ? [`${run.calls} ${run.calls === 1 ? "call" : "calls"}`] : [], ...tokens ? [`${tokens.toLocaleString()} tokens`] : []].join(" and ");
	const end = {
		done: `Done in ${took}${used ? `, with ${used},` : ""} and reported to ${bot?.name ?? "its bot"}.`,
		failed: `Failed after ${took}: ${run.ended}`,
		stopped: `Stopped after ${took}: ${run.ended}`
	}[run.state];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Header, {
				title: run.title,
				lead,
				children: run.state === "working" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => stop(run),
					children: "Stop"
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "subagents-status text-xs text-muted-foreground",
				"data-state": run.state,
				children: [
					bot && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Blob, {
						...bot,
						size: 18
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "subagents-dot",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						bot ? `${bot.name}'s subagent · ` : "",
						word[run.state],
						" · ",
						took,
						run.state === "working" && run.tool ? ` · ${run.tool}` : ""
					] })
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageScrollerProvider, {
				autoScroll: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(MessageScroller, {
					className: "flex-1",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageScrollerViewport, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(MessageScrollerContent, {
						className: "mx-auto w-full max-w-3xl gap-6 px-4 py-4",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Message, {
								align: "end",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(MessageContent, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "text-right text-xs text-muted-foreground",
									children: bot ? `${bot.name}'s task` : "Its task"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bubble, {
									align: "end",
									variant: "muted",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BubbleContent, {
										className: "whitespace-pre-wrap",
										children: run.task
									})
								})] })
							}),
							turns.map((turn) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Message, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageContent, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Reply, { turn }) }) }, turn.messageId)),
							end && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: `text-sm ${run.state === "failed" ? "text-destructive" : "text-muted-foreground"}`,
								children: end
							})
						]
					}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageScrollerButton, {})]
				})
			})
		]
	});
}
function Started({ call: started }) {
	const { Button } = _fxbot_app.ui;
	const id = /\bs:(\d+)\b/.exec(typeof started.output === "string" ? started.output : "")?.[1];
	const run = usePoll(id ? `runs/${id}` : null, (r) => r.state === "working");
	(0, react.useEffect)(() => void (id && changed()), [id]);
	if (!started.done) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Starting a subagent…"
	});
	if (!id) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: started.error ?? started.output
	});
	const title = run?.title ?? started.input?.title ?? "A subagent";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "subagents-card",
		"data-state": run?.state ?? "working",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "subagents-dot",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1 truncate text-sm",
				children: ["Started subagent: ", title]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "text-xs text-muted-foreground",
				children: run === null ? "Gone" : word[run?.state ?? "working"]
			}),
			run && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "xs",
				variant: "outline",
				onClick: () => (0, _fxbot_app.go)(screenOf(run)),
				children: "Open"
			})
		]
	});
}
function setup(app) {
	app.botPanel(Panel);
	app.route("/:bot/:id", Thread);
	app.toolView("start", Started, { open: true });
}
module.exports = setup;
