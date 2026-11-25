let react = require("react");
let _fxbot_app = require("@fxbot/app");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/talk.jsx
const store = {
	now: null,
	listeners: /* @__PURE__ */ new Set()
};
const set = (next) => (store.now = next && {
	...store.now ?? {},
	...next
}, store.listeners.forEach((listen) => listen()));
const useTalk = () => (0, react.useSyncExternalStore)((listen) => (store.listeners.add(listen), () => store.listeners.delete(listen)), () => store.now);
const on = () => store.now && store.now.status !== "ended";
async function audio(socket, quiet) {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true
	} });
	const context = new AudioContext();
	await Promise.race([context.resume(), new Promise((resolve) => setTimeout(resolve, 3e3))]);
	if (context.state !== "running") {
		stream.getTracks().forEach((t) => t.stop());
		context.close().catch(() => {});
		throw Object.assign(/* @__PURE__ */ new Error("The browser didn't start its audio for this page."), { said: true });
	}
	await context.audioWorklet.addModule("/api/plugins/phone/worklet.js");
	const mic = new AudioWorkletNode(context, "fxbot-mic");
	const player = new AudioWorkletNode(context, "fxbot-player");
	context.createMediaStreamSource(stream).connect(mic);
	player.connect(context.destination);
	let muted = false;
	mic.port.onmessage = (e) => !muted && socket.readyState === WebSocket.OPEN && socket.send(e.data);
	let queued = 0;
	let marks = [];
	player.port.onmessage = (e) => {
		const { played, cleared } = e.data;
		if (cleared) marks = [], queued = played;
		while (marks.length && played >= marks[0].at) socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ played: marks.shift().n }));
		const busy = Boolean(e.data.busy);
		if (store.now?.speaking && !busy) quiet();
		if (store.now && store.now.speaking !== busy) set({ speaking: busy });
	};
	return {
		track: stream.getAudioTracks()[0],
		play(buffer) {
			queued += buffer.byteLength / 2;
			player.port.postMessage(buffer, [buffer]);
		},
		mark: (n) => marks.push({
			n,
			at: queued
		}),
		clear: () => player.port.postMessage("clear"),
		mute(on) {
			muted = on;
			stream.getAudioTracks().forEach((t) => t.enabled = !on);
		},
		stop() {
			stream.getTracks().forEach((t) => t.stop());
			if (context.state !== "closed") context.close().catch(() => {});
		}
	};
}
async function deviceEars(socket, track, google, speaking) {
	const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (!Recognition) return { error: "This browser has no speech recognition: pick a voice provider in phone's tab." };
	const r = new Recognition();
	r.continuous = true;
	r.interimResults = true;
	r.lang = navigator.language || "en-US";
	if (typeof Recognition.available === "function") {
		if (await Recognition.available({
			langs: [r.lang],
			processLocally: true
		}).catch(() => "unavailable") === "available") r.processLocally = true;
		else if (!google) return { error: "Chrome would send what you say to Google. Turn on googleListening in phone's settings, or pick a voice provider." };
	}
	let alive = true;
	let withTrack = true;
	const send = (heard) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ heard }));
	r.onresult = (e) => {
		for (let i = e.resultIndex; i < e.results.length; i++) send({ [e.results[i].isFinal ? "final" : "partial"]: e.results[i][0].transcript });
	};
	const start = () => {
		if (!alive || !withTrack && speaking()) return;
		try {
			if (withTrack) r.start(track);
			else r.start();
		} catch {
			if (!withTrack) return;
			withTrack = false;
			start();
		}
	};
	r.onend = () => alive && setTimeout(start, 100);
	start();
	return {
		hush: () => !withTrack && r.abort(),
		resume: () => !withTrack && start(),
		stop: () => (alive = false, r.abort())
	};
}
function deviceMouth(socket, done) {
	const voice = () => speechSynthesis.getVoices().find((v) => v.localService && v.lang?.startsWith((navigator.language || "en").slice(0, 2))) ?? null;
	return {
		say(n, text) {
			const u = new SpeechSynthesisUtterance(text);
			const v = voice();
			if (v) u.voice = v;
			u.onend = () => (socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ played: n })), done());
			speechSynthesis.speak(u);
		},
		clear: () => speechSynthesis.cancel()
	};
}
async function talk(target, label) {
	if (on()) return;
	set(null);
	set({
		target,
		label,
		status: "starting",
		at: Date.now(),
		muted: false,
		speaking: false,
		who: "",
		error: ""
	});
	if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
	const path = target.room !== void 0 ? `talk/room/${target.room}` : `talk/${target.bot}`;
	const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/plugins/phone/${path}`);
	socket.binaryType = "arraybuffer";
	let sound = null;
	let ears = null;
	let mouth = null;
	let lock = null;
	const early = [];
	let ready = false;
	const end = (why) => {
		if (!store.now || store.now.status === "ended") return;
		set({
			status: "ended",
			error: why && why !== "hung up" ? why : ""
		});
		ears?.stop();
		mouth?.clear();
		sound?.stop();
		lock?.release?.().catch(() => {});
		document.removeEventListener("visibilitychange", hidden);
		if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ end: true })), socket.close();
	};
	const hidden = () => document.visibilityState === "hidden" && end("The app went to the background.");
	document.addEventListener("visibilitychange", hidden);
	set({
		end,
		mute: (muted) => (set({ muted }), sound?.mute(muted), socket.send(JSON.stringify({ mute: muted })))
	});
	socket.onmessage = (e) => ready ? void handle(e.data) : early.push(e.data);
	socket.onclose = (e) => end(store.now?.status === "starting" && e.reason ? e.reason : "");
	const over = () => store.now?.socket !== socket || store.now.status === "ended";
	set({ socket });
	try {
		sound = await audio(socket, () => ears?.resume());
	} catch (error) {
		return end(error?.name === "NotAllowedError" ? "The microphone isn't allowed for this page." : error?.said ? error.message : `The microphone didn't open: ${error?.message ?? error}`);
	}
	if (over()) return sound.stop();
	navigator.wakeLock?.request("screen").then((l) => over() ? void l.release().catch(() => {}) : lock = l, () => {});
	const handle = async (message) => {
		if (over()) return;
		if (typeof message !== "string") return ears?.hush(), sound.play(message);
		const m = JSON.parse(message);
		if (m.state === "starting") {
			if (m.speak === "device") mouth = deviceMouth(socket, () => ears?.resume());
			if (m.listen === "device") {
				const got = await deviceEars(socket, sound.track, m.google, () => store.now?.speaking);
				if (got.error) return end(got.error);
				ears = got;
			}
		} else if (m.state === "on") set({
			status: "on",
			at: Date.now()
		});
		else if (typeof m.mark === "number") sound.mark(m.mark);
		else if (typeof m.say === "number") ears?.hush(), mouth?.say(m.say, m.text);
		else if (m.clear) sound.clear(), mouth?.clear(), ears?.resume();
		else if (typeof m.who === "string") set({ who: m.who });
		else if (m.ended) end(m.ended === true ? "" : m.ended);
	};
	while (early.length && !over()) await handle(early.shift());
	ready = true;
}
const Mic = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
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
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
			x1: "12",
			x2: "12",
			y1: "19",
			y2: "22"
		})
	]
});
const clock$1 = (from) => {
	const s = Math.max(0, Math.floor((Date.now() - from) / 1e3));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const mine = (now, target) => now && (target.room !== void 0 ? now.target.room === target.room : now.target.bot === target.bot);
function TalkButton({ bot }) {
	const now = useTalk();
	const busy = now && now.status !== "ended";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
		type: "button",
		variant: "ghost",
		size: "icon-sm",
		className: "rounded-full",
		"aria-label": `Talk with ${bot.name} by voice, here`,
		title: busy ? "A call is on" : `Talk with ${bot.name} by voice, here`,
		disabled: Boolean(busy),
		onClick: () => void talk({ bot: bot.id }, bot.name),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Mic, {})
	});
}
function useWorking(bots) {
	const [names, setNames] = (0, react.useState)([]);
	const key = bots.join(",");
	(0, react.useEffect)(() => {
		let alive = true;
		const look = () => Promise.all(bots.map((bot) => fetch(`/api/plugins/subagents/bots/${bot}`).then((r) => r.ok ? r.json() : { subagents: [] }, () => ({ subagents: [] })))).then((lists) => alive && setNames(lists.flatMap((l) => (l.subagents ?? []).filter((s) => s.state === "working").map((s) => s.name))));
		look();
		const timer = setInterval(look, 3e3);
		return () => (alive = false, clearInterval(timer));
	}, [key]);
	return names;
}
function Bar({ now, title, bots = [] }) {
	const [, tick] = (0, react.useState)(0);
	const working = useWorking(bots);
	(0, react.useEffect)(() => {
		const timer = setInterval(() => tick((n) => n + 1), 1e3);
		return () => clearInterval(timer);
	}, []);
	const doing = now.status === "starting" ? "Starting…" : now.speaking ? `${now.whoName || now.label} is speaking` : now.muted ? "Muted" : "Listening";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 pl-3 text-sm",
		"aria-label": title,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Mic, {})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1 truncate",
				children: [
					title,
					" · ",
					clock$1(now.at),
					" · ",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: doing
					}),
					working.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "text-muted-foreground",
						children: [
							" · ",
							working.join(", "),
							" ",
							working.length === 1 ? "is" : "are",
							" working"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				"aria-pressed": now.muted,
				onClick: () => now.mute(!now.muted),
				children: now.muted ? "Unmute" : "Mute"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
				type: "button",
				size: "sm",
				variant: "destructive",
				onClick: () => now.end("hung up"),
				children: "End"
			})
		]
	});
}
function TalkBar({ bot }) {
	const now = useTalk();
	if (!mine(now, { bot: bot.id })) return null;
	if (now.status === "ended") return now.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "rounded-lg border p-2 text-sm text-destructive",
		children: ["The call ended: ", now.error]
	}) : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
		now,
		title: `Talking with ${bot.name}`,
		bots: [bot.id]
	});
}
function RoomTalk({ room }) {
	const now = useTalk();
	if (!room?.members?.length || mine(now, { room: room.id }) && now.status !== "ended") return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.Button, {
		type: "button",
		size: "sm",
		variant: "ghost",
		disabled: Boolean(on()),
		title: on() ? "A call is on" : `Talk with ${room.name}'s bots by voice`,
		onClick: () => void talk({ room: room.id }, room.name),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Mic, {}), " Talk"]
	});
}
function RoomTalkBar({ room }) {
	const now = useTalk();
	const bots = (0, _fxbot_app.useBots)() ?? [];
	if (!room || !mine(now, { room: room.id })) return null;
	if (now.status === "ended") return now.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
		className: "rounded-lg border p-2 text-sm text-destructive",
		children: ["The call ended: ", now.error]
	}) : null;
	const who = bots.find((b) => b.id === now.who);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 items-center gap-2",
		children: [who && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
			...who,
			size: 28,
			busy: now.speaking,
			className: "shrink-0"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "grid min-w-0 flex-1",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
				now: {
					...now,
					whoName: who?.name
				},
				title: `A call with ${room.name}`,
				bots: room.members
			})
		})]
	});
}
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
const settingsTab = "/settings/plugins/phone";
const live = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Map();
const timers = /* @__PURE__ */ new Map();
async function read(bot) {
	clearTimeout(timers.get(bot));
	if (document.visibilityState === "visible") {
		const next = await call(`calls/live?bot=${bot}`).then((answer) => ({
			call: answer.call,
			button: answer.button !== false
		}), () => live.get(bot) ?? null);
		live.set(bot, next);
		listeners.get(bot)?.forEach((listen) => listen());
	}
	timers.set(bot, listeners.get(bot)?.size ? setTimeout(() => read(bot), live.get(bot)?.call ? 2e3 : 15e3) : null);
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
	const state = useLive(bot.id);
	const now = state?.call ?? null;
	const [error, setError] = (0, react.useState)("");
	const ring = () => {
		setError("");
		call("calls", "POST", { bot: bot.id }).then(() => void read(bot.id), (e) => e.answer?.missing || /confirm/i.test(e.message) ? (0, _fxbot_app.go)(settingsTab) : setError(e.message));
	};
	if (state && !state.button) return null;
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
	const now = useLive(bot.id)?.call ?? null;
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
		className: "flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 pl-3 text-sm",
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
function Providers({ status, onPick }) {
	const running = status.providers.filter((p) => p.running);
	if (!status.providers.length) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-muted-foreground",
		children: "Add a provider plugin from Plugins, such as phone-signalwire: it carries the calls."
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
				className: "font-medium",
				children: "Ways to call"
			}),
			status.providers.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "flex flex-wrap items-center gap-x-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: p.label }), !p.running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: "is off. Plugins says why."
				}) : p.missing.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						"needs ",
						p.missing.join(", "),
						"."
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					type: "button",
					size: "xs",
					variant: "ghost",
					onClick: () => (0, _fxbot_app.go)(`/settings/plugins/${p.name}`),
					children: "Its settings"
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						"is ready",
						running.length > 1 && status.provider === p.name ? ", and calls go through it unless a bot has its own" : "",
						"."
					]
				})]
			}, p.name)),
			running.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Calls go through" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelect, {
					"aria-label": "The default provider",
					value: status.provider ?? "",
					onChange: (e) => onPick(e.target.value),
					children: running.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: p.name,
						children: p.label
					}, p.name))
				})]
			})
		]
	});
}
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
	const pick = (provider) => (setError(""), call("provider", "PUT", { provider }).then(load, (e) => setError(e.message)));
	const ring = () => (setError(""), setNote(""), call("confirm", "POST").then(() => setNote(`Calling ${status.to}. Type the code it reads.`), (e) => setError(e.message)));
	const check = () => (setError(""), call("confirm/code", "POST", { code }).then(() => (setNote("Your number is confirmed."), setCode(""), load()), (e) => setError(e.message)));
	const using = status.providers.find((p) => p.name === status.provider);
	const ready = using && using.running && !using.missing.length;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "Your phone",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VoiceSection, {}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Your phone"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Providers, {
				status,
				onPick: pick
			}),
			status.missing.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"Set ",
					status.missing.join(", "),
					" above, then confirm your number here."
				]
			}) : !ready ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "Once a way to call is ready, confirm your number here."
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
						" before a bot calls it: fxbot calls it through ",
						using.label,
						" and reads a code, which you type here."
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
						status.providers.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: c.providerLabel
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
function VoiceSection() {
	const [voice, setVoice] = (0, react.useState)(null);
	const [voices, setVoices] = (0, react.useState)([]);
	const [error, setError] = (0, react.useState)("");
	const load = () => call("voice").then((v) => (setVoice(v), v.speak.provider !== "device" ? call("voice/voices").then(setVoices, () => setVoices([])) : setVoices([])), (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), []);
	if (!voice) return error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-destructive",
		children: error
	}) : null;
	const save = (patch) => {
		const next = {
			listenProvider: voice.listen.provider,
			listenModel: voice.listen.model,
			speakProvider: voice.speak.provider,
			speakModel: voice.speak.model,
			speakVoice: voice.speak.voice,
			...patch
		};
		setError("");
		call("voice", "PUT", next).then(load, (e) => setError(e.message));
	};
	const listener = voice.listeners.find((p) => p.id === voice.listen.provider);
	const speaker = voice.speakers.find((p) => p.id === voice.speak.provider);
	const models = (p, model, onPick, label) => p && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
		className: "grid gap-1",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
				list: `models-${label}`,
				value: model,
				placeholder: p.models[0] ?? "A model",
				onChange: (e) => onPick(e.target.value),
				onBlur: (e) => onPick(e.target.value, true)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
				id: `models-${label}`,
				children: p.models.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: m }, m))
			})
		]
	});
	const [listenModel, setListenModel] = [voice.listen.model, (model, done) => (setVoice({
		...voice,
		listen: {
			...voice.listen,
			model
		}
	}), done && save({ listenModel: model }))];
	const [speakModel, setSpeakModel] = [voice.speak.model, (model, done) => (setVoice({
		...voice,
		speak: {
			...voice.speak,
			model
		}
	}), done && save({ speakModel: model }))];
	const hears = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3",
		"aria-label": "Voice",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Voice"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "How bots hear you and speak on a call in the app: Talk, beside the message box. Add voice providers in Settings › Providers: ElevenLabs and Deepgram, under For phone, or a speech server on your machine. A Mistral, Groq, OpenAI, or Cloudflare login listens too."
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Listening" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
					"aria-label": "Listening",
					className: "w-full",
					value: voice.listen.provider,
					onChange: (e) => save({
						listenProvider: e.target.value,
						listenModel: ""
					}),
					children: [voice.listeners.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelectOption, {
						value: p.id,
						children: [p.name, p.streams ? "" : ", one stretch at a time"]
					}, p.id)), (hears || voice.listen.provider === "device") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: "device",
						children: hears ? "This device: the browser's own" : "This device: not in this browser"
					})]
				})]
			}),
			models(listener, listenModel, setListenModel, "Listening model"),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Speaking" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
					"aria-label": "Speaking",
					className: "w-full",
					value: voice.speak.provider,
					onChange: (e) => save({
						speakProvider: e.target.value,
						speakModel: "",
						speakVoice: ""
					}),
					children: [voice.speakers.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: p.id,
						children: p.name
					}, p.id)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: "device",
						children: "This device: the browser's own"
					})]
				})]
			}),
			models(speaker, speakModel, setSpeakModel, "Speaking model"),
			speaker && voices.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Voice" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
						"aria-label": "Voice",
						className: "w-full",
						value: voice.speak.voice,
						onChange: (e) => save({ speakVoice: e.target.value }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelectOption, {
							value: "",
							children: [voices[0].label, ", the first"]
						}), grouped(voices).map(([group, list]) => group ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOptGroup, {
							label: group,
							children: list.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
								value: v.value,
								children: v.label
							}, v.value))
						}, group) : list.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: v.value,
							children: v.label
						}, v.value)))]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "Each bot can have its own, in its Phone section. In a room, a bot with none gets one no other bot there has."
					})
				]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
function Toggle({ checked, label, hint, onChange }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Switch, {
				checked,
				onCheckedChange: onChange,
				"aria-label": label
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground",
			children: hint
		})]
	});
}
function grouped(voices) {
	const groups = /* @__PURE__ */ new Map();
	for (const v of voices) groups.set(v.group ?? "", [...groups.get(v.group ?? "") ?? [], v]);
	return [...groups];
}
function BotSection({ bot }) {
	const [state, setState] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => call(`bots/${bot.id}`).then(setState, (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), [bot.id]);
	if (!state) return null;
	const save = (patch) => (setError(""), call(`bots/${bot.id}`, "PUT", patch).then((next) => (setState(next), void read(bot.id)), (e) => setError(e.message)));
	const chosen = state.voices.find((v) => v.value === state.voice);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "Phone",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Phone"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				checked: state.button,
				label: "Call me",
				hint: "The button beside the message box rings your phone.",
				onChange: (button) => save({ button })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				checked: state.asked,
				label: "Calls when you ask",
				hint: `${bot.name} calls when you ask it to, now or when something is done.`,
				onChange: (asked) => save({ asked })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				checked: state.own,
				label: "Calls on its own",
				hint: `When ${bot.name} decides to, at most ${state.perDay} ${state.perDay === 1 ? "time" : "times"} a day, and never in your quiet hours, ${state.quiet}.`,
				onChange: (own) => save({ own })
			}),
			state.providers.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Calls go through" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
					"aria-label": "Its provider",
					className: "w-full",
					value: state.provider ?? "",
					onChange: (e) => save({ provider: e.target.value || null }),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: "",
						children: "The default"
					}), state.providers.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
						value: p.name,
						children: p.label
					}, p.name))]
				})]
			}),
			state.using && state.voices.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Voice" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
						"aria-label": "Its voice",
						className: "w-full",
						value: state.voice ?? "",
						onChange: (e) => save({ voice: e.target.value || null }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: "",
							children: "The voice in phone's Voice section"
						}), grouped(state.voices).map(([group, voices]) => group ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOptGroup, {
							label: group,
							children: voices.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
								value: v.value,
								children: v.label
							}, v.value))
						}, group) : voices.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: v.value,
							children: v.label
						}, v.value)))]
					}),
					chosen?.group && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: chosen.group
					})
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
	app.composer(TalkButton);
	app.composer(CallButton);
	app.chat(TalkBar);
	app.chat(CallBar);
	app.slot?.("chat-rooms.room-header", RoomTalk);
	app.slot?.("chat-rooms.room-box", RoomTalkBar);
	app.toolView("call", CallCard, { open: true });
	app.settings(Tab);
	app.botSettings(BotSection);
}
module.exports = setup;
