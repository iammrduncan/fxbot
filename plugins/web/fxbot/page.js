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
const wraps = { overflowWrap: "anywhere" };
const jobs = [
	{
		job: "search",
		label: "Search with"
	},
	{
		job: "read",
		label: "Read pages with"
	},
	{
		job: "research",
		label: "Research with"
	}
];
function Job({ job, label, config, save }) {
	const [trying, setTrying] = (0, react.useState)(false);
	const [said, setSaid] = (0, react.useState)(null);
	const can = config.providers.filter((p) => p.can.includes(job));
	if (job === "research" && !can.length) return null;
	const picked = config.picks[job] ?? (job === "read" ? "" : can[0]?.id ?? "");
	const none = job === "search" && !can.length;
	const tryIt = () => {
		setTrying(true);
		setSaid(null);
		call("try", "POST", {
			job,
			provider: picked || null
		}).then((r) => setSaid({
			ok: true,
			text: r.said
		}), (e) => setSaid({
			ok: false,
			text: e.message
		})).finally(() => setTrying(false));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
			className: "grid gap-1",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.NativeSelect, {
					"aria-label": label,
					className: "w-full",
					value: picked,
					disabled: none,
					onChange: (e) => save({ [job]: e.target.value || null }),
					children: [
						job === "read" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: "",
							children: "fxbot itself"
						}),
						none && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: "",
							children: config.freeSearch ? "Parallel's free search" : "Nothing: add a provider"
						}),
						can.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.NativeSelectOption, {
							value: p.id,
							children: p.name
						}, p.id))
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					variant: "outline",
					size: "sm",
					disabled: trying || none && !config.freeSearch,
					onClick: tryIt,
					children: trying ? "Trying…" : "Try it"
				})]
			})]
		}), said && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: said.ok ? "text-muted-foreground" : "text-destructive",
			style: wraps,
			children: said.text
		})]
	});
}
function WebSection() {
	const [config, setConfig] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => void call("config").then(setConfig, (e) => setError(e.message)), []);
	if (!config) return error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-destructive",
		children: error
	}) : null;
	const save = (patch) => (setError(""), call("config", "PUT", patch).then(setConfig, (e) => setError(e.message)));
	const searches = config.providers.some((p) => p.can.includes("search"));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-3 text-sm",
		"aria-label": "Web",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Web"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: ["Which provider does each job. A bot can ask another you added for one call. Add web providers in Settings › Providers, under For web.", config.computer ? " With the computer on for a bot, it can also read a page in its own browser." : ""]
			}),
			!config.providers.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				children: [
					"No web provider is added yet. ",
					config.freeSearch ? "Bots search with Parallel's free search, which needs no key and gets each query, and read pages themselves." : "Free search is off, so bots can't search until you add one. They read pages themselves.",
					" ",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "underline",
						onClick: () => (0, _fxbot_app.go)("/settings/providers"),
						children: "Add a provider"
					})
				]
			}),
			config.providers.length > 0 && !searches && config.freeSearch && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "None of these searches, so bots search with Parallel's free search."
			}),
			jobs.map((j) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Job, {
				...j,
				config,
				save
			}, j.job)),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
function useView(tool) {
	const [view, setView] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		if (!tool.done || tool.error || !tool.id) return;
		call(`calls/${encodeURIComponent(tool.id)}`).then(setView, () => setView(null));
	}, [
		tool.id,
		tool.done,
		tool.error
	]);
	return view;
}
const short = (url) => {
	try {
		const u = new URL(url);
		return `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
	} catch {
		return url;
	}
};
function Links({ items }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
		className: "grid gap-1.5",
		children: items.map((item, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
			className: "grid",
			style: { gridTemplateColumns: "minmax(0, 1fr)" },
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				href: item.url,
				target: "_blank",
				rel: "noreferrer noopener",
				className: "font-medium underline",
				style: wraps,
				children: item.title || short(item.url)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "truncate text-xs text-muted-foreground",
				children: [short(item.url), item.published ? ` · ${item.published}` : ""]
			})]
		}, `${item.url}-${i}`))
	});
}
function Failed({ tool }) {
	return tool.done && tool.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		className: "text-destructive",
		style: wraps,
		children: tool.output
	}) : null;
}
function SearchView({ call: tool }) {
	const view = useView(tool);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				style: wraps,
				children: [tool.input?.query ? `“${tool.input.query}”` : "", view?.by ? `, with ${view.by}` : ""]
			}),
			view?.results?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Links, { items: view.results }) : tool.done && !tool.error && view && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "No results."
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Failed, { tool })
		]
	});
}
function FetchView({ call: tool }) {
	const view = useView(tool);
	const url = view?.final ?? tool.input?.url;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1 text-sm",
		children: [
			url && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				href: url,
				target: "_blank",
				rel: "noreferrer noopener",
				className: "font-medium underline",
				style: wraps,
				children: view?.title || short(url)
			}),
			view && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "text-xs text-muted-foreground",
				children: [
					"Read by ",
					view.by,
					view.library ? `, saved to the library as library:${view.library}` : ""
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Failed, { tool })
		]
	});
}
function ResearchView({ call: tool }) {
	const view = useView(tool);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2 text-sm",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "text-muted-foreground",
				style: wraps,
				children: [tool.input?.question ? `“${tool.input.question}”` : "", view?.by ? `, with ${view.by}` : ""]
			}),
			view?.sources?.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Links, { items: view.sources }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Failed, { tool })
		]
	});
}
function setup(app) {
	app.settings(WebSection);
	app.toolView("search", SearchView);
	app.toolView("fetch", FetchView);
	app.toolView("research", ResearchView);
}
module.exports = setup;
