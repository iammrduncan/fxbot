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
const dayOf = (at) => new Date(at).toLocaleDateString(void 0, {
	month: "short",
	day: "numeric"
});
function Meeting({ bot, reload }) {
	const asked = (0, react.useRef)("");
	(0, react.useEffect)(() => {
		if (bot.sessionId || !bot.provider || asked.current === bot.id) return;
		asked.current = bot.id;
		call(`souls/${bot.id}/meet`, "POST").then((answer) => answer.started && reload?.(), () => {});
	}, [
		bot.id,
		bot.sessionId,
		bot.provider
	]);
	return null;
}
function SoulBox({ bot }) {
	const { Button, Textarea } = _fxbot_app.ui;
	const [data, setData] = (0, react.useState)(null);
	const [draft, setDraft] = (0, react.useState)("");
	const [versions, setVersions] = (0, react.useState)(null);
	const [saving, setSaving] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	const load = () => call(`souls/${bot.id}`).then((next) => (setData(next), setDraft(next.text), setError("")), (e) => setError(e.message));
	const history = () => call(`souls/${bot.id}/versions`).then(setVersions, (e) => setError(e.message));
	(0, react.useEffect)(() => void (setVersions(null), load()), [bot.id]);
	if (!data) return error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-sm text-destructive",
		children: error
	}) : null;
	const who = (by) => by === "bot" ? bot.name : "you";
	const after = () => (load(), versions && history());
	const save = () => {
		setSaving(true);
		call(`souls/${bot.id}`, "PUT", { text: draft }).then(after, (e) => setError(e.message)).finally(() => setSaving(false));
	};
	const restore = (version) => call(`souls/${bot.id}/versions/${version.id}/restore`, "POST").then(after, (e) => setError(e.message));
	const about = !data.on ? "soul is off for this bot, so its soul isn't in its chats." : data.text ? `Written by ${bot.name}, with you. Your instructions above come first.` : `${bot.name} hasn't written its soul yet. Ask it to, in its chat, or write one here.`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "Soul",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Soul"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: about
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Textarea, {
				rows: 6,
				className: "max-h-[50dvh]",
				maxLength: 4e3,
				value: draft,
				onChange: (e) => setDraft(e.target.value),
				"aria-label": `${bot.name}'s soul`
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "flex-1 text-muted-foreground",
						children: data.savedAt ? `Saved by ${who(data.savedBy)}, ${dayOf(data.savedAt)}` : ""
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: () => versions ? setVersions(null) : history(),
						children: versions ? "Hide history" : "History"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: saving || draft.trim() === data.text,
						onClick: save,
						children: "Save soul"
					})
				]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			}),
			versions && (versions.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "divide-y",
				children: versions.map((version, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: "grid gap-1 py-2",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "flex-1 text-muted-foreground",
							children: [
								dayOf(version.at),
								" · by ",
								who(version.by),
								i === 0 ? " · now" : ""
							]
						}), i > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => restore(version),
							children: "Restore"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap break-words",
						children: version.text || "(empty)"
					})]
				}, version.id))
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "No versions yet."
			}))
		]
	});
}
function Saved({ call: tool }) {
	const text = typeof tool.input?.text === "string" ? tool.input.text.trim() : "";
	const saved = tool.done && /^Saved your soul/.test(tool.output ?? "");
	if (tool.done && !saved) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "rounded-xl border px-3 py-2 text-sm",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
			className: "font-medium",
			children: saved ? "Updated its soul" : "Writing its soul…"
		}), text && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "pt-2 whitespace-pre-wrap text-muted-foreground",
			children: text
		})]
	});
}
function setup(app) {
	app.chat(Meeting);
	app.botSettings(SoulBox);
	app.toolView("save", Saved, { open: true });
}
module.exports = setup;
