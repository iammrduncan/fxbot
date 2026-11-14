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
	if (!res.ok) throw Object.assign(new Error(answer.error ?? `HTTP ${res.status}`), { answer });
	return answer;
}
const settingsTab = "/settings/plugins/phone-signalwire";
const live = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Map();
const timers = /* @__PURE__ */ new Map();
async function read(bot) {
	clearTimeout(timers.get(bot));
	if (document.visibilityState === "visible") {
		const next = await call(`calls/live?bot=${bot}`).then((answer) => answer.call, () => live.get(bot) ?? null);
		live.set(bot, next);
		listeners.get(bot)?.forEach((listen) => listen());
	}
	timers.set(bot, listeners.get(bot)?.size ? setTimeout(() => read(bot), live.get(bot) ? 2e3 : 15e3) : null);
}
function useLive(bot) {
	return (0, react.useSyncExternalStore)((listen) => {
		if (!listeners.has(bot)) listeners.set(bot, /* @__PURE__ */ new Set());
		listeners.get(bot).add(listen);
		if (!timers.get(bot)) read(bot);
		return () => void listeners.get(bot).delete(listen);
	}, () => live.get(bot) ?? null);
}
const Phone = () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
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
	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" })
});
function CallButton({ bot }) {
	const now = useLive(bot.id);
	const [error, setError] = (0, react.useState)("");
	const ring = () => {
		setError("");
		call("calls", "POST", { bot: bot.id }).then(() => void read(bot.id), (e) => e.answer?.missing || /confirm/i.test(e.message) ? (0, _fxbot_app.go)(settingsTab) : setError(e.message));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
		type: "button",
		variant: "ghost",
		size: "icon-sm",
		className: "rounded-full",
		"aria-label": error || `Call me: ${bot.name} rings your phone`,
		title: error || `Call me: ${bot.name} rings your phone`,
		disabled: Boolean(now),
		onClick: ring,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Phone, {})
	});
}
const clock = (from) => {
	const s = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1e3));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function CallBar({ bot }) {
	const now = useLive(bot.id);
	const [, tick] = (0, react.useState)(0);
	const [ending, setEnding] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		if (!now) return setEnding(false);
		const timer = setInterval(() => tick((n) => n + 1), 1e3);
		return () => clearInterval(timer);
	}, [now?.id]);
	if (!now) return null;
	const end = () => (setEnding(true), call(`calls/${now.id}/end`, "POST").finally(() => void read(bot.id)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "flex items-center gap-2 rounded-lg border bg-background p-2 pl-3 text-sm",
		"aria-label": `Your call with ${bot.name}`,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Phone, {})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "min-w-0 flex-1 truncate",
				children: now.status === "on" && now.answeredAt ? `On the phone with ${bot.name} · ${clock(now.answeredAt)}` : `Ringing your phone…`
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
				type: "button",
				size: "sm",
				variant: "destructive",
				disabled: ending,
				onClick: end,
				children: "End call"
			})
		]
	});
}
function CallCard({ call: tool }) {
	const reason = typeof tool.input?.reason === "string" ? tool.input.reason : "";
	const later = tool.input?.later === true;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: later ? "A call-back for later" : "A call to your phone"
			}),
			reason && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: reason
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: /failed|didn't|isn't|not set up/i.test(tool.output ?? "") ? "text-destructive" : "text-muted-foreground",
				children: tool.done ? tool.output : later ? "Keeping it…" : "Ringing…"
			})
		]
	});
}
const outcome = {
	ringing: "Ringing",
	on: "On",
	ended: "Ended",
	voicemail: "Voicemail",
	missed: "Missed",
	busy: "Busy",
	failed: "Failed"
};
const length = (seconds) => seconds == null ? "" : seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
function Tab() {
	const [status, setStatus] = (0, react.useState)(null);
	const [calls, setCalls] = (0, react.useState)([]);
	const [code, setCode] = (0, react.useState)("");
	const [note, setNote] = (0, react.useState)("");
	const [error, setError] = (0, react.useState)("");
	const load = () => {
		call("status").then(setStatus, (e) => setError(e.message));
		call("calls").then(setCalls, () => {});
	};
	(0, react.useEffect)(load, []);
	if (!status) return error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-destructive",
		children: error
	}) : null;
	const ring = () => (setError(""), setNote(""), call("confirm", "POST").then(() => setNote(`Calling ${status.to}. Type the code it reads.`), (e) => setError(e.message)));
	const check = () => (setError(""), call("confirm/code", "POST", { code }).then(() => (setNote("Your number is confirmed."), setCode(""), load()), (e) => setError(e.message)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "Your phone",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Your phone"
			}),
			status.missing.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"Set ",
					status.missing.join(", "),
					" above, then confirm your number here."
				]
			}) : status.confirmed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"Bots call ",
					status.to,
					", and only it. Change the number above, and it needs confirming again."
				]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "text-muted-foreground",
					children: [
						"Confirm ",
						status.to,
						" before a bot calls it: fxbot calls it and reads a code, which you type here."
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: ring,
							children: "Call me to confirm"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
							"aria-label": "The code",
							placeholder: "The code",
							inputMode: "numeric",
							value: code,
							maxLength: 8,
							style: { width: "8rem" },
							onChange: (e) => setCode(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
							type: "button",
							size: "sm",
							disabled: !code.trim(),
							onClick: check,
							children: "Confirm"
						})
					]
				})]
			}),
			note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: note }),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			}),
			calls.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: "font-medium",
					children: "Last calls"
				}), calls.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "flex flex-wrap gap-x-2 text-xs",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: c.name }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: new Date(c.at).toLocaleString()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: outcome[c.status] ?? c.status }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: length(c.seconds)
						}),
						c.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-destructive",
							children: c.error
						})
					]
				}, c.id))]
			})
		]
	});
}
function BotSection({ bot }) {
	const [state, setState] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => call(`bots/${bot.id}`).then(setState, (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), [bot.id]);
	if (!state) return null;
	const own = (onItsOwn) => call(`bots/${bot.id}`, "PUT", { onItsOwn }).then(() => load(), (e) => setError(e.message));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-2 text-sm",
		"aria-label": "Phone",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Phone"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Switch, {
					checked: state.onItsOwn,
					onCheckedChange: own,
					"aria-label": "May call me on its own"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "May call me on its own" })]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					bot.name,
					" calls when you ask it to. With this on, it may also call when it decides to, at most ",
					state.perDay,
					" ",
					state.perDay === 1 ? "time" : "times",
					" a day, and never in your quiet hours, ",
					state.quiet,
					"."
				]
			}),
			state.callback && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					"A call-back until ",
					new Date(state.callback.until).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit"
					}),
					": ",
					state.callback.reason
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					type: "button",
					size: "xs",
					variant: "ghost",
					onClick: () => call(`bots/${bot.id}/callback`, "DELETE").then(load, (e) => setError(e.message)),
					children: "Remove"
				})]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
function setup(app) {
	app.composer(CallButton);
	app.chat(CallBar);
	app.toolView("call", CallCard, { open: true });
	app.settings(Tab);
	app.botSettings(BotSection);
}
module.exports = setup;
